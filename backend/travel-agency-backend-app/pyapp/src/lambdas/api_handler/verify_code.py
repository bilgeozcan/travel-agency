"""Password recovery code pre-verification endpoint.

Amazon Cognito does not expose a non-mutating API that validates a
ForgotPassword confirmation code by itself. Therefore this endpoint validates
the request, code shape, and the server-issued 15-minute recovery session.
The confirmation code is authoritatively validated by Cognito during the
subsequent password reset operation.
"""

import re
from typing import Any, Dict

from commons.api_response import build_response
from commons.auth.errors import AuthenticationError, AuthenticationValidationError
from commons.log_helper import get_logger
from commons.password_recovery_session import validate_password_recovery_session
try:
    from lambdas.api_handler.forgot_password import _parse_request_body, _validate_email
except ImportError:
    from forgot_password import _parse_request_body, _validate_email

_LOG = get_logger(__name__)
_CODE_PATTERN = re.compile(r"^\S{1,2048}$")
_NO_STORE_HEADERS = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
}


def _validate_verify_payload(payload: Dict[str, Any]):
    email = _validate_email(payload)
    code = payload.get("confirmationCode")
    session = payload.get("verificationSession")
    errors: Dict[str, str] = {}

    if code is None:
        errors["confirmationCode"] = "Confirmation code is required"
    elif not isinstance(code, str):
        errors["confirmationCode"] = "Confirmation code must be a string"
    elif not _CODE_PATTERN.fullmatch(code):
        errors["confirmationCode"] = "Confirmation code is invalid"

    if session is None:
        errors["verificationSession"] = "Verification session is required"
    elif not isinstance(session, str) or not session.strip():
        errors["verificationSession"] = "Verification session is invalid"

    if errors:
        raise AuthenticationValidationError(details=errors)

    try:
        validate_password_recovery_session(session, email)
    except ValueError as exc:
        raise AuthenticationValidationError(
            details={"verificationSession": str(exc)}
        ) from exc

    return email, code, session


def handle_verify_code(event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        payload = _parse_request_body(event)
        _validate_verify_payload(payload)

        return build_response(
            200,
            {
                "message": "Verification request accepted",
                "verificationStatus": "PENDING_COGNITO_CONFIRMATION",
            },
            headers=_NO_STORE_HEADERS,
            event=event,
        )
    except AuthenticationError as exc:
        _LOG.warning("Verification request rejected: %s", exc.error_code)
        return build_response(
            exc.status_code,
            exc.to_body(),
            headers=_NO_STORE_HEADERS,
            event=event,
        )
    except Exception:
        _LOG.exception("Unexpected verification request error")
        return build_response(
            500,
            {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Internal server error",
            },
            headers=_NO_STORE_HEADERS,
            event=event,
        )
