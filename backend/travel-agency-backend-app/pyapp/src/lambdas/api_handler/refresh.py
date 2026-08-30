"""POST /auth/refresh implementation."""

from http.cookies import CookieError, SimpleCookie
import os
from typing import Any, Dict, Iterable

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from commons.api_response import build_response
from commons.auth.errors import (
    AuthenticationError,
    AuthenticationServiceError,
    TooManyRequestsError,
)
from commons.log_helper import get_logger


_LOG = get_logger(__name__)

_REFRESH_COOKIE_NAME = "__Host-refreshToken"
_NO_STORE_HEADERS = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
}


class InvalidRefreshTokenError(AuthenticationError):
    """Raised when the refresh session is missing, invalid or expired."""

    status_code = 401
    error_code = "INVALID_REFRESH_TOKEN"
    default_message = "Refresh session is invalid or expired"


def _expired_refresh_cookie() -> str:
    return (
        f"{_REFRESH_COOKIE_NAME}=; "
        "Max-Age=0; Path=/; Secure; HttpOnly; SameSite=None"
    )


def _cookie_headers(
    event: Dict[str, Any],
) -> Iterable[str]:
    cookies = event.get("cookies")

    if isinstance(cookies, list):
        joined = "; ".join(
            value
            for value in cookies
            if isinstance(value, str) and value
        )

        if joined:
            yield joined

    headers = event.get("headers") or {}

    if isinstance(headers, dict):
        for key, value in headers.items():
            if (
                isinstance(key, str)
                and key.lower() == "cookie"
                and isinstance(value, str)
                and value
            ):
                yield value

    multi_value_headers = (
        event.get("multiValueHeaders") or {}
    )

    if isinstance(multi_value_headers, dict):
        for key, values in multi_value_headers.items():
            if (
                not isinstance(key, str)
                or key.lower() != "cookie"
            ):
                continue

            if isinstance(values, list):
                for value in values:
                    if isinstance(value, str) and value:
                        yield value
            elif isinstance(values, str) and values:
                yield values


def _extract_refresh_token(
    event: Dict[str, Any],
) -> str:
    if not isinstance(event, dict):
        raise InvalidRefreshTokenError()

    for cookie_header in _cookie_headers(event):
        parsed_cookie = SimpleCookie()

        try:
            parsed_cookie.load(cookie_header)
        except CookieError:
            continue

        morsel = parsed_cookie.get(
            _REFRESH_COOKIE_NAME
        )

        if morsel is None:
            continue

        refresh_token = morsel.value

        if (
            refresh_token
            and not any(
                character in refresh_token
                for character in ("\r", "\n", ";")
            )
        ):
            return refresh_token

    raise InvalidRefreshTokenError()


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
        return InvalidRefreshTokenError()

    if error_code in {
        "TooManyRequestsException",
        "LimitExceededException",
    }:
        return TooManyRequestsError()

    return AuthenticationServiceError()


def _refresh_session(
    refresh_token: str,
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
            AuthFlow="REFRESH_TOKEN_AUTH",
            ClientId=client_id,
            AuthParameters={
                "REFRESH_TOKEN": refresh_token,
            },
        )
    except ClientError as exc:
        raise _map_cognito_error(exc) from exc
    except BotoCoreError as exc:
        raise AuthenticationServiceError() from exc

    authentication_result = response.get(
        "AuthenticationResult"
    )

    required_fields = (
        "AccessToken",
        "IdToken",
        "ExpiresIn",
        "TokenType",
    )

    if (
        not isinstance(authentication_result, dict)
        or any(
            field not in authentication_result
            for field in required_fields
        )
    ):
        raise AuthenticationServiceError()

    access_token = authentication_result[
        "AccessToken"
    ]

    return {
        "accessToken": access_token,
        # Backward-compatible alias for existing clients.
        "token": access_token,
        "expiresIn": authentication_result[
            "ExpiresIn"
        ],
        "tokenType": authentication_result[
            "TokenType"
        ],
    }


def handle_refresh(
    event: Dict[str, Any],
) -> Dict[str, Any]:
    """Refresh the access token using the HttpOnly cookie."""

    try:
        refresh_token = _extract_refresh_token(event)
        result = _refresh_session(refresh_token)

        return build_response(
            200,
            result,
            headers=_NO_STORE_HEADERS,
            event=event,
        )

    except InvalidRefreshTokenError as exc:
        headers = {
            **_NO_STORE_HEADERS,
            "Set-Cookie": _expired_refresh_cookie(),
        }

        return build_response(
            exc.status_code,
            exc.to_body(),
            headers=headers,
            event=event,
        )

    except AuthenticationError as exc:
        _LOG.warning(
            "Refresh request failed: %s",
            exc.error_code,
        )

        return build_response(
            exc.status_code,
            exc.to_body(),
            headers=_NO_STORE_HEADERS,
            event=event,
        )

    except Exception:
        _LOG.exception(
            "Unexpected refresh-session error"
        )

        return build_response(
            500,
            {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Internal server error",
            },
            headers=_NO_STORE_HEADERS,
            event=event,
        )
