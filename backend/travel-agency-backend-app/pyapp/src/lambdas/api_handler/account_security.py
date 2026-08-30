"""Signed-in password and verified email change operations."""
import base64
import json
import re
import time
from typing import Any, Dict

import boto3
import os
from botocore.exceptions import BotoCoreError, ClientError

from commons.api_response import build_response
from commons.auth.authorization import require_roles
from commons.auth.errors import (
    AuthenticationError,
    AuthenticationServiceError,
    AuthenticationValidationError,
    ExpiredConfirmationCodeError,
    InvalidConfirmationCodeError,
    InvalidCredentialsError,
    PasswordPolicyViolationError,
    TooManyRequestsError,
    UnauthorizedError,
    EmailAlreadyInUseError,
    EmailChangeNotPendingError,
    EmailChangeResendCooldownError,
)
from commons.log_helper import get_logger

_LOG = get_logger(__name__)
_REGION = __import__("os").environ.get("region", "eu-west-3")
_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_SYMBOL = re.compile(r"[^A-Za-z0-9]")
_ALLOWED_ROLES = ["CUSTOMER", "TRAVEL_AGENT", "ADMIN"]
_resend_times: Dict[str, float] = {}
cognito_client = boto3.client("cognito-idp", region_name=_REGION)


def _body(event: Dict[str, Any], allowed: set[str]) -> Dict[str, Any]:
    raw = event.get("body")
    try:
        if isinstance(raw, str) and event.get("isBase64Encoded"):
            raw = base64.b64decode(raw).decode("utf-8")
        data = raw if isinstance(raw, dict) else json.loads(raw or "{}")
    except (ValueError, TypeError, UnicodeDecodeError):
        raise AuthenticationValidationError(details={"field": "body"})
    if not isinstance(data, dict) or not data:
        raise AuthenticationValidationError(details={"field": "body"})
    unknown = sorted(set(data) - allowed)
    if unknown:
        raise AuthenticationValidationError(details={"fields": unknown})
    return data


def _access_token(event: Dict[str, Any]) -> str:
    if isinstance(event.get("accessToken"), str) and event["accessToken"].strip():
        return event["accessToken"].strip()

    auth_user = event.get("authenticatedUser")
    if isinstance(auth_user, dict) and isinstance(auth_user.get("accessToken"), str) and auth_user["accessToken"].strip():
        return auth_user["accessToken"].strip()

    headers = event.get("headers") or {}
    value = next((v for k, v in headers.items() if k.lower() == "authorization"), "")
    if not isinstance(value, str) or not value.startswith("Bearer ") or not value[7:].strip():
        raise UnauthorizedError()
    return value[7:].strip()


def _authorize(event: Dict[str, Any]) -> str:
    require_roles(event, _ALLOWED_ROLES)
    return _access_token(event)


def _password_error(value: Any) -> str | None:
    if value is None: return "New password is required"
    if not isinstance(value, str): return "New password must be a string"
    if len(value) < 8: return "New password must be at least 8 characters"
    if len(value) > 64: return "New password must be at most 64 characters"
    if not re.search(r"[A-Z]", value): return "New password must include an uppercase letter"
    if not re.search(r"[a-z]", value): return "New password must include a lowercase letter"
    if not re.search(r"\d", value): return "New password must include a number"
    if not _SYMBOL.search(value): return "New password must include a special character"
    return None


def _map(exc: ClientError) -> AuthenticationError:
    code = exc.response.get("Error", {}).get("Code", "")
    if code in {"NotAuthorizedException", "UserNotFoundException"}:
        return InvalidCredentialsError()
    if code == "InvalidPasswordException":
        return PasswordPolicyViolationError()
    if code == "CodeMismatchException":
        return InvalidConfirmationCodeError()
    if code == "ExpiredCodeException":
        return ExpiredConfirmationCodeError()
    if code in {"TooManyRequestsException", "TooManyFailedAttemptsException", "LimitExceededException"}:
        return TooManyRequestsError()
    if code in {"AliasExistsException", "UsernameExistsException"}:
        return EmailAlreadyInUseError()
    if code == "CodeDeliveryFailureException":
        return AuthenticationServiceError("Verification code delivery failed")
    return AuthenticationServiceError()


def _call(operation, **kwargs):
    try: return operation(**kwargs)
    except ClientError as exc: raise _map(exc) from exc
    except BotoCoreError as exc: raise AuthenticationServiceError() from exc


def change_password(event: Dict[str, Any]) -> Dict[str, Any]:
    require_roles(event, _ALLOWED_ROLES)
    data = _body(event, {"oldPassword", "newPassword"})
    old = data.get("oldPassword")
    if not isinstance(old, str) or not old:
        raise AuthenticationValidationError(details={"field": "oldPassword"})
    error = _password_error(data.get("newPassword"))
    if error: raise AuthenticationValidationError(details={"newPassword": error})
    token = _access_token(event)
    _call(cognito_client.change_password, PreviousPassword=old, ProposedPassword=data["newPassword"], AccessToken=token)
    return {"message": "Password changed successfully"}


def _ensure_email_available(email: str) -> None:
    pool_id = os.environ.get("cup_id", "").strip()
    if not pool_id:
        return
    filter_expression = "email = " + json.dumps(email)
    try:
        result = cognito_client.list_users(
            UserPoolId=pool_id,
            Filter=filter_expression,
            Limit=2,
        )
    except ClientError as exc:
        raise _map(exc) from exc
    except BotoCoreError as exc:
        raise AuthenticationServiceError() from exc
    if result.get("Users"):
        raise EmailAlreadyInUseError()

def _delivery(response: Dict[str, Any]) -> Dict[str, str] | None:
    details = response.get("CodeDeliveryDetailsList") or []
    if not details and isinstance(response.get("CodeDeliveryDetails"), dict):
        details = [response["CodeDeliveryDetails"]]
    if not details:
        return None
    first = details[0]
    return {"medium": str(first.get("DeliveryMedium") or ""), "destination": str(first.get("Destination") or "")}

def initiate_email_change(event: Dict[str, Any]) -> Dict[str, Any]:
    token = _authorize(event)
    data = _body(event, {"newEmail", "currentPassword"})
    email = data.get("newEmail")
    password = data.get("currentPassword")
    if not isinstance(email, str) or not _EMAIL.fullmatch(email.strip()):
        raise AuthenticationValidationError(details={"field": "newEmail"})
    email = email.strip().lower()
    current = str(event["authenticatedUser"].get("email") or "").strip().lower()
    if email == current:
        raise AuthenticationValidationError("New email must differ from current email", {"field": "newEmail"})
    if not isinstance(password, str) or not password:
        raise AuthenticationValidationError(details={"field": "currentPassword"})
    username = event["authenticatedUser"].get("username") or current
    client_id = os.environ.get("cup_client_id", "")
    _call(cognito_client.initiate_auth, ClientId=client_id, AuthFlow="USER_PASSWORD_AUTH", AuthParameters={"USERNAME": username, "PASSWORD": password})
    _ensure_email_available(email)
    result = _call(cognito_client.update_user_attributes, AccessToken=token, UserAttributes=[{"Name": "email", "Value": email}]) or {}
    _resend_times[str(event["authenticatedUser"].get("sub"))] = time.time()
    response = {"message": "Verification code sent", "pendingEmail": email}
    delivery = _delivery(result)
    if delivery:
        response["delivery"] = delivery
    return response


def confirm_email_change(event: Dict[str, Any]) -> Dict[str, Any]:
    token = _authorize(event)
    data = _body(event, {"code"})
    code = data.get("code")
    if not isinstance(code, str) or not code.strip():
        raise AuthenticationValidationError(details={"field": "code"})
    try:
        cognito_client.verify_user_attribute(
            AccessToken=token,
            AttributeName="email",
            Code=code.strip(),
        )
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code == "InvalidParameterException":
            raise EmailChangeNotPendingError() from exc
        raise _map(exc) from exc
    except BotoCoreError as exc:
        raise AuthenticationServiceError() from exc
    _resend_times.pop(str(event["authenticatedUser"].get("sub")), None)
    return {"message": "Email changed successfully"}


def resend_email_change(event: Dict[str, Any]) -> Dict[str, Any]:
    token = _authorize(event)
    key = str(event["authenticatedUser"].get("sub"))
    last = _resend_times.get(key)
    now = time.time()
    if last is not None and now - last < 60:
        raise EmailChangeResendCooldownError()
    try:
        result = cognito_client.get_user_attribute_verification_code(
            AccessToken=token,
            AttributeName="email",
        ) or {}
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code == "InvalidParameterException":
            raise EmailChangeNotPendingError() from exc
        raise _map(exc) from exc
    except BotoCoreError as exc:
        raise AuthenticationServiceError() from exc
    _resend_times[key] = now
    response = {"message": "Verification code resent"}
    delivery = _delivery(result)
    if delivery:
        response["delivery"] = delivery
    return response


def _handle(action, event):
    try: return build_response(200, action(event), event=event)
    except AuthenticationError as exc:
        _LOG.warning("Account security request rejected: %s", exc.error_code)
        return build_response(exc.status_code, exc.to_body(), event=event)
    except Exception:
        _LOG.exception("Unexpected account security error")
        return build_response(500, {"code": "INTERNAL_SERVER_ERROR", "message": "Internal server error"}, event=event)


def handle_change_password(event): return _handle(change_password, event)
def handle_initiate_email_change(event): return _handle(initiate_email_change, event)
def handle_confirm_email_change(event): return _handle(confirm_email_change, event)
def handle_resend_email_change(event): return _handle(resend_email_change, event)
