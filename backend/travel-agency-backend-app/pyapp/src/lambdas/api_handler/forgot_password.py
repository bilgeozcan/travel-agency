# cspell:ignore pwnedpasswords
"""Forgot-password and password-reset confirmation endpoints."""

import base64
import binascii
import json
import os
import re
from typing import Any, Dict, Tuple

import boto3
import pwnedpasswords
from botocore.exceptions import BotoCoreError, ClientError

from commons.api_response import build_response
from commons.auth.errors import (
    AuthenticationError,
    AuthenticationServiceError,
    AuthenticationValidationError,
    ExpiredConfirmationCodeError,
    InvalidConfirmationCodeError,
    PasswordPolicyViolationError,
    TooManyRequestsError,
)
from commons.log_helper import get_logger
from commons.password_recovery_session import issue_password_recovery_session


_LOG = get_logger(__name__)

_EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+"
    r"(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$"
)

_SYMBOL_PATTERN = re.compile(
    r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]"
)

_CONFIRMATION_CODE_PATTERN = re.compile(
    r"^\S{1,2048}$"
)

_GENERIC_FORGOT_PASSWORD_MESSAGE = (
    "If an account exists for this email, "
    "a password reset code has been sent."
)

_PASSWORD_RESET_SUCCESS_MESSAGE = (
    "Password reset successfully"
)

_NO_STORE_HEADERS = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
}


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
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise AuthenticationValidationError(
            details={
                "body": (
                    "Request body contains invalid JSON"
                )
            }
        ) from exc

    if not isinstance(payload, dict):
        raise AuthenticationValidationError(
            details={
                "body": (
                    "Request body must be a JSON object"
                )
            }
        )

    return payload


def _validate_email(
    payload: Dict[str, Any],
) -> str:
    email = payload.get("email")
    error = None

    if email is None:
        error = "Email is required"
    elif not isinstance(email, str):
        error = "Email must be a string"
    else:
        email = email.strip().lower()

        if not email:
            error = "Email must not be empty"
        elif (
            len(email) > 254
            or not _EMAIL_PATTERN.fullmatch(email)
        ):
            error = "Email format is invalid"

    if error:
        raise AuthenticationValidationError(
            details={
                "email": error
            }
        )

    return email


def _password_policy_error(
    password: Any,
) -> str:
    if password is None:
        return "New password is required"

    if not isinstance(password, str):
        return "New password must be a string"

    requirements = []

    if len(password) < 8 or len(password) > 64:
        requirements.append(
            "be between 8 and 64 characters"
        )

    if not re.search(r"[A-Z]", password):
        requirements.append(
            "contain an uppercase letter"
        )

    if not re.search(r"[a-z]", password):
        requirements.append(
            "contain a lowercase letter"
        )

    if not re.search(r"\d", password):
        requirements.append(
            "contain a number"
        )

    if not _SYMBOL_PATTERN.search(password):
        requirements.append(
            "contain a symbol"
        )

    if not requirements:
        return ""

    return (
        "New password must "
        + ", ".join(requirements)
    )


def _check_password_breach(
    password: str,
) -> None:
    try:
        if pwnedpasswords.check(password) > 0:
            raise PasswordPolicyViolationError(
                (
                    "This password has appeared in a "
                    "data breach. Please choose a "
                    "different one."
                )
            )
    except PasswordPolicyViolationError:
        raise
    except Exception:
        # This matches the existing registration flow.
        # The password itself is never logged.
        _LOG.warning(
            "Password breach check is "
            "temporarily unavailable"
        )


def _validate_confirmation_payload(
    payload: Dict[str, Any],
) -> Tuple[str, str, str]:
    email = _validate_email(payload)

    confirmation_code = payload.get(
        "confirmationCode"
    )
    new_password = payload.get(
        "newPassword"
    )

    errors: Dict[str, str] = {}

    if confirmation_code is None:
        errors["confirmationCode"] = (
            "Confirmation code is required"
        )
    elif not isinstance(
        confirmation_code,
        str,
    ):
        errors["confirmationCode"] = (
            "Confirmation code must be a string"
        )
    elif not _CONFIRMATION_CODE_PATTERN.fullmatch(
        confirmation_code
    ):
        errors["confirmationCode"] = (
            "Confirmation code is invalid"
        )

    password_error = _password_policy_error(
        new_password
    )

    if errors:
        if password_error:
            errors["newPassword"] = password_error

        raise AuthenticationValidationError(
            details=errors
        )

    if password_error:
        raise PasswordPolicyViolationError(
            details={
                "newPassword": password_error
            }
        )

    _check_password_breach(
        new_password
    )

    return (
        email,
        confirmation_code,
        new_password,
    )


def _cognito_configuration(
) -> Tuple[str, str]:
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

    return client_id, region


def _cognito_client(
) -> Tuple[Any, str]:
    client_id, region = (
        _cognito_configuration()
    )

    return (
        boto3.client(
            "cognito-idp",
            region_name=region,
        ),
        client_id,
    )


def _cognito_error_code(
    exception: ClientError,
) -> str:
    return str(
        exception.response
        .get("Error", {})
        .get("Code", "")
    )


def _map_forgot_password_error(
    exception: ClientError,
) -> AuthenticationError:
    error_code = _cognito_error_code(
        exception
    )

    if error_code in {
        "TooManyRequestsException",
        "LimitExceededException",
        "TooManyFailedAttemptsException",
    }:
        return TooManyRequestsError(
            (
                "Too many password reset requests. "
                "Please try again later."
            )
        )

    return AuthenticationServiceError()


def _map_confirmation_error(
    exception: ClientError,
) -> AuthenticationError:
    error_code = _cognito_error_code(
        exception
    )

    if error_code == "ExpiredCodeException":
        return ExpiredConfirmationCodeError()

    if error_code in {
        "CodeMismatchException",
        "NotAuthorizedException",
        "UserNotFoundException",
        "UserNotConfirmedException",
        "InvalidParameterException",
    }:
        return InvalidConfirmationCodeError()

    if error_code in {
        "InvalidPasswordException",
        "PasswordHistoryPolicyViolationException",
    }:
        return PasswordPolicyViolationError()

    if error_code in {
        "TooManyRequestsException",
        "LimitExceededException",
        "TooManyFailedAttemptsException",
    }:
        return TooManyRequestsError(
            (
                "Too many password reset attempts. "
                "Please try again later."
            )
        )

    return AuthenticationServiceError()


def handle_forgot_password(
    event: Dict[str, Any],
) -> Dict[str, Any]:
    """Request Cognito's default password-reset email."""

    try:
        payload = _parse_request_body(
            event
        )
        email = _validate_email(
            payload
        )

        cognito_client, client_id = (
            _cognito_client()
        )

        try:
            cognito_client.forgot_password(
                ClientId=client_id,
                Username=email,
            )
        except ClientError as exc:
            error_code = _cognito_error_code(
                exc
            )

            # Do not reveal whether the account exists
            # or has a verified recovery attribute.
            if error_code not in {
                "UserNotFoundException",
                "InvalidParameterException",
                "NotAuthorizedException",
            }:
                raise _map_forgot_password_error(
                    exc
                ) from exc
        except BotoCoreError as exc:
            raise AuthenticationServiceError(
            ) from exc

        recovery_session = issue_password_recovery_session(email)
        success_headers = {
            **_NO_STORE_HEADERS,
            "X-Password-Recovery-Session": recovery_session,
            "Access-Control-Expose-Headers": (
                "X-Password-Recovery-Session"
            ),
        }

        return build_response(
            200,
            {
                "message": (
                    _GENERIC_FORGOT_PASSWORD_MESSAGE
                )
            },
            headers=success_headers,
            event=event,
        )

    except AuthenticationError as exc:
        _LOG.warning(
            "Forgot-password request failed: %s",
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
            "Unexpected forgot-password error"
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


def handle_confirm_forgot_password(
    event: Dict[str, Any],
) -> Dict[str, Any]:
    """Confirm a reset code and set a new password."""

    try:
        payload = _parse_request_body(
            event
        )

        (
            email,
            confirmation_code,
            new_password,
        ) = _validate_confirmation_payload(
            payload
        )

        cognito_client, client_id = (
            _cognito_client()
        )

        try:
            cognito_client.confirm_forgot_password(
                ClientId=client_id,
                Username=email,
                ConfirmationCode=(
                    confirmation_code
                ),
                Password=new_password,
            )
        except ClientError as exc:
            raise _map_confirmation_error(
                exc
            ) from exc
        except BotoCoreError as exc:
            raise AuthenticationServiceError(
            ) from exc

        return build_response(
            200,
            {
                "message": (
                    _PASSWORD_RESET_SUCCESS_MESSAGE
                )
            },
            headers=_NO_STORE_HEADERS,
            event=event,
        )

    except AuthenticationError as exc:
        _LOG.warning(
            (
                "Password-reset confirmation "
                "failed: %s"
            ),
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
            (
                "Unexpected password-reset "
                "confirmation error"
            )
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
