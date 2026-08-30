"""Password reset endpoint for the verified recovery flow."""

from typing import Any, Dict

from botocore.exceptions import BotoCoreError, ClientError

from commons.api_response import build_response
from commons.auth.errors import (
    AuthenticationError,
    AuthenticationServiceError,
    AuthenticationValidationError,
    ExpiredConfirmationCodeError,
    InvalidConfirmationCodeError,
)
from commons.log_helper import get_logger
from commons.password_recovery_session import (
    validate_password_recovery_session,
)
try:
    from lambdas.api_handler.forgot_password import (
        _PASSWORD_RESET_SUCCESS_MESSAGE,
        _NO_STORE_HEADERS,
        _cognito_client,
        _map_confirmation_error,
        _parse_request_body,
        _validate_confirmation_payload,
        _validate_email,
    )
except ImportError:
    from forgot_password import (
        _PASSWORD_RESET_SUCCESS_MESSAGE,
        _NO_STORE_HEADERS,
        _cognito_client,
        _map_confirmation_error,
        _parse_request_body,
        _validate_confirmation_payload,
        _validate_email,
    )


_LOG = get_logger(__name__)


def _validate_recovery_session(
    payload: Dict[str, Any],
) -> str:
    email = _validate_email(payload)
    recovery_session = payload.get(
        "verificationSession"
    )

    if recovery_session is None:
        raise AuthenticationValidationError(
            details={
                "verificationSession": (
                    "Verification session is required"
                )
            }
        )

    if (
        not isinstance(recovery_session, str)
        or not recovery_session.strip()
    ):
        raise AuthenticationValidationError(
            details={
                "verificationSession": (
                    "Verification session is invalid"
                )
            }
        )

    try:
        validate_password_recovery_session(
            recovery_session,
            email,
        )
    except ValueError as exc:
        if "expired" in str(exc).lower():
            raise ExpiredConfirmationCodeError(
                "Password recovery session has expired"
            ) from exc

        # Do not disclose whether the token was tampered with,
        # belongs to a different email, or is otherwise invalid.
        raise InvalidConfirmationCodeError() from exc
    except RuntimeError as exc:
        raise AuthenticationServiceError() from exc

    return recovery_session


def handle_reset_password(
    event: Dict[str, Any],
) -> Dict[str, Any]:
    """Validate the recovery session and reset the password in Cognito."""

    try:
        payload = _parse_request_body(event)

        _validate_recovery_session(payload)

        (
            email,
            confirmation_code,
            new_password,
        ) = _validate_confirmation_payload(payload)

        cognito_client, client_id = _cognito_client()

        try:
            cognito_client.confirm_forgot_password(
                ClientId=client_id,
                Username=email,
                ConfirmationCode=confirmation_code,
                Password=new_password,
            )
        except ClientError as exc:
            raise _map_confirmation_error(exc) from exc
        except BotoCoreError as exc:
            raise AuthenticationServiceError() from exc

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
            "Password reset failed: %s",
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
            "Unexpected password reset error"
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
