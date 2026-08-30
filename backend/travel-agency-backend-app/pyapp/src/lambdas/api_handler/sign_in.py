"""POST /auth/sign-in implementation."""

import base64
import binascii
import json
import os
import re
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from commons.api_response import build_response
from commons.auth.errors import (
    AuthenticationChallengeError,
    AuthenticationError,
    AuthenticationServiceError,
    AuthenticationValidationError,
    InvalidCredentialsError,
    PasswordResetRequiredError,
    TooManyRequestsError,
    UserNotConfirmedError,
)
from commons.log_helper import get_logger


_LOG = get_logger(__name__)

_EMAIL_PATTERN = re.compile(
    r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
)

_INVALID_CREDENTIALS_MESSAGE = (
    "Incorrect email or password. "
    "Try again or create an account."
)


_REFRESH_COOKIE_NAME = "__Host-refreshToken"
_REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60


def _build_refresh_cookie(
    refresh_token: str,
) -> str:
    """Build a secure cookie for the Cognito refresh token."""

    if (
        not isinstance(refresh_token, str)
        or not refresh_token
    ):
        raise AuthenticationServiceError(
            "Cognito refresh token is missing"
        )

    if any(
        character in refresh_token
        for character in ("\r", "\n", ";")
    ):
        raise AuthenticationServiceError(
            "Cognito refresh token is invalid"
        )

    return (
        f"{_REFRESH_COOKIE_NAME}={refresh_token}; "
        f"Max-Age={_REFRESH_COOKIE_MAX_AGE_SECONDS}; "
        "Path=/; Secure; HttpOnly; SameSite=Strict"
    )


def _parse_request_body(
    event: Dict[str, Any],
) -> Dict[str, Any]:
    if not isinstance(event, dict):
        raise AuthenticationValidationError(
            details={
                "body": "Request event must be an object"
            }
        )

    body = event.get("body")

    if body is None:
        raise AuthenticationValidationError(
            details={
                "body": "Request body is required"
            }
        )

    if event.get("isBase64Encoded") is True:
        if not isinstance(body, str):
            raise AuthenticationValidationError(
                details={
                    "body": (
                        "Base64 request body must be a string"
                    )
                }
            )

        try:
            body = base64.b64decode(
                body,
                validate=True,
            ).decode("utf-8")
        except (
            ValueError,
            binascii.Error,
            UnicodeDecodeError,
        ) as exc:
            raise AuthenticationValidationError(
                details={
                    "body": (
                        "Request body contains invalid base64"
                    )
                }
            ) from exc

    if isinstance(body, dict):
        return body

    if not isinstance(body, str):
        raise AuthenticationValidationError(
            details={
                "body": (
                    "Request body must be a JSON object"
                )
            }
        )

    try:
        parsed_body = json.loads(body)
    except json.JSONDecodeError as exc:
        raise AuthenticationValidationError(
            details={
                "body": (
                    "Request body contains invalid JSON"
                )
            }
        ) from exc

    if not isinstance(parsed_body, dict):
        raise AuthenticationValidationError(
            details={
                "body": (
                    "Request body must be a JSON object"
                )
            }
        )

    return parsed_body


def _validate_credentials(
    payload: Dict[str, Any],
) -> Dict[str, str]:
    errors: Dict[str, str] = {}

    email = payload.get("email")
    password = payload.get("password")

    if email is None:
        errors["email"] = "Email is required"
    elif not isinstance(email, str):
        errors["email"] = "Email must be a string"
    elif not email.strip():
        errors["email"] = "Email must not be empty"
    elif not _EMAIL_PATTERN.fullmatch(
        email.strip()
    ):
        errors["email"] = "Email format is invalid"

    if password is None:
        errors["password"] = "Password is required"
    elif not isinstance(password, str):
        errors["password"] = "Password must be a string"
    elif password == "":
        errors["password"] = (
            "Password must not be empty"
        )

    if errors:
        raise AuthenticationValidationError(
            details=errors
        )

    return {
        "email": email.strip().lower(),
        "password": password,
    }


def _map_cognito_error(
    exception: ClientError,
) -> AuthenticationError:
    error_code = (
        exception.response
        .get("Error", {})
        .get("Code")
    )

    if error_code in {
        "NotAuthorizedException",
        "UserNotFoundException",
    }:
        return InvalidCredentialsError(
            _INVALID_CREDENTIALS_MESSAGE
        )

    if error_code == "UserNotConfirmedException":
        return UserNotConfirmedError()

    if error_code == (
        "PasswordResetRequiredException"
    ):
        return PasswordResetRequiredError()

    if error_code in {
        "TooManyRequestsException",
        "LimitExceededException",
    }:
        return TooManyRequestsError()

    return AuthenticationServiceError()


def _decode_jwt_claims(
    token: Optional[str],
) -> Dict[str, Any]:
    if not isinstance(token, str):
        return {}

    parts = token.split(".")

    if len(parts) < 2:
        return {}

    encoded_payload = parts[1]
    padding = "=" * (-len(encoded_payload) % 4)

    try:
        decoded_payload = (
            base64.urlsafe_b64decode(
                encoded_payload + padding
            )
            .decode("utf-8")
        )

        claims = json.loads(decoded_payload)
    except (
        ValueError,
        binascii.Error,
        UnicodeDecodeError,
        json.JSONDecodeError,
    ):
        return {}

    if not isinstance(claims, dict):
        return {}

    return claims


def _parse_groups(
    value: Any,
) -> List[str]:
    if isinstance(value, list):
        return [
            str(item)
            for item in value
            if item
        ]

    if not isinstance(value, str):
        return []

    normalized = value.strip()

    if not normalized:
        return []

    normalized = normalized.strip("[]")

    return [
        item.strip().strip("'\"")
        for item in normalized.split(",")
        if item.strip()
    ]


def _get_user_profile(
    cognito_client: Any,
    authentication_result: Dict[str, Any],
    fallback_email: str,
) -> Dict[str, Any]:
    access_token = authentication_result[
        "AccessToken"
    ]

    try:
        user_response = cognito_client.get_user(
            AccessToken=access_token
        )
    except (
        ClientError,
        BotoCoreError,
    ) as exc:
        raise AuthenticationServiceError() from exc

    attributes: Dict[str, str] = {}

    for attribute in (
        user_response.get("UserAttributes") or []
    ):
        if not isinstance(attribute, dict):
            continue

        name = attribute.get("Name")
        value = attribute.get("Value")

        if name and value is not None:
            attributes[str(name)] = str(value)

    claims = _decode_jwt_claims(
        authentication_result.get("IdToken")
    )

    if not claims:
        claims = _decode_jwt_claims(
            access_token
        )

    groups = _parse_groups(
        claims.get("cognito:groups")
    )

    user_id = (
        attributes.get("sub")
        or claims.get("sub")
        or user_response.get("Username")
        or fallback_email
    )

    email = (
        attributes.get("email")
        or claims.get("email")
        or fallback_email
    )

    first_name = (
        attributes.get("given_name")
        or claims.get("given_name")
        or ""
    )

    last_name = (
        attributes.get("family_name")
        or claims.get("family_name")
        or ""
    )

    user: Dict[str, Any] = {
        "id": str(user_id),
        "email": str(email).strip().lower(),
        "firstName": str(first_name),
        "lastName": str(last_name),
    }

    if groups:
        user["role"] = groups[0]

    return user


def _authenticate(
    email: str,
    password: str,
) -> Dict[str, Any]:
    client_id = os.environ.get(
        "cup_client_id",
        "",
    ).strip()

    region = (
        os.environ.get("region")
        or os.environ.get("AWS_REGION")
        or "eu-west-3"
    )

    if not client_id:
        raise AuthenticationServiceError(
            "Cognito App Client is not configured"
        )

    cognito_client = boto3.client(
        "cognito-idp",
        region_name=region,
    )

    try:
        response = cognito_client.initiate_auth(
            AuthFlow="USER_PASSWORD_AUTH",
            ClientId=client_id,
            AuthParameters={
                "USERNAME": email,
                "PASSWORD": password,
            },
        )
    except ClientError as exc:
        raise _map_cognito_error(exc) from exc
    except BotoCoreError as exc:
        raise AuthenticationServiceError() from exc

    authentication_result = response.get(
        "AuthenticationResult"
    )

    if not authentication_result:
        challenge_name = response.get(
            "ChallengeName"
        )

        if challenge_name:
            details: Dict[str, Any] = {
                "challengeName": challenge_name,
            }

            if response.get("Session"):
                details["session"] = (
                    response["Session"]
                )

            raise AuthenticationChallengeError(
                details=details
            )

        raise AuthenticationServiceError()

    required_fields = (
        "AccessToken",
        "IdToken",
        "RefreshToken",
        "ExpiresIn",
        "TokenType",
    )

    if any(
        field not in authentication_result
        for field in required_fields
    ):
        raise AuthenticationServiceError()

    user = _get_user_profile(
        cognito_client,
        authentication_result,
        email,
    )

    # Keep the existing API contract used by develop/frontend.
    # The refresh token is returned only to handle_sign_in so it
    # can be moved into the secure HttpOnly cookie.
    access_token = authentication_result[
        "AccessToken"
    ]

    result: Dict[str, Any] = {
        "accessToken": access_token,
        # Backward-compatible alias for existing clients.
        "token": access_token,
        "idToken": authentication_result[
            "IdToken"
        ],
        "expiresIn": authentication_result[
            "ExpiresIn"
        ],
        "tokenType": authentication_result[
            "TokenType"
        ],
        "user": user,
        "refreshToken": authentication_result[
            "RefreshToken"
        ],
    }

    return result


def handle_sign_in(
    event: Dict[str, Any],
) -> Dict[str, Any]:
    """Handle POST /auth/sign-in."""

    try:
        payload = _parse_request_body(event)
        credentials = _validate_credentials(payload)

        authentication_result = _authenticate(
            credentials["email"],
            credentials["password"],
        )


        # Remove the refresh token from the JSON response body; it must
        # be set as a secure HttpOnly cookie instead. Do NOT remove
        # `idToken` from the returned JSON body because the OpenAPI
        # schema uses it for client-side identity information. Protected API
        # requests must use `accessToken`, never `idToken`.
        refresh_token = authentication_result.pop("refreshToken", None)

        response_headers = {
            "Set-Cookie": _build_refresh_cookie(refresh_token),
            "Cache-Control": "no-store",
            "Pragma": "no-cache",
        }

        return build_response(
            200,
            authentication_result,
            headers=response_headers,
            event=event,
        )

    except AuthenticationError as exc:
        # Never log request bodies, passwords or tokens.
        _LOG.warning(
            "Authentication request failed: %s",
            exc.error_code,
        )

        return build_response(
            exc.status_code,
            exc.to_body(),
            event=event,
        )

    except Exception:
        # Do not include request events or credentials.
        _LOG.exception(
            "Unexpected authentication error"
        )

        return build_response(
            500,
            {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Internal server error",
            },
            event=event,
        )
