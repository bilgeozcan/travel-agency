import base64
import json
import os
import re
from typing import Any, Dict

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from commons.api_response import build_response
from commons.auth.authorization import require_roles
from commons.auth.errors import (
    AuthenticationError,
    AuthenticationServiceError,
    AuthenticationValidationError,
    EmailChangeNotAllowedError,
)
from commons.log_helper import get_logger


_LOG = get_logger(__name__)
_REGION = os.environ.get("region", "eu-west-3")
_CUP_ID = os.environ.get("cup_id", "").strip()
_ALLOWED_ROLES = ["CUSTOMER", "TRAVEL_AGENT", "ADMIN"]
_ALLOWED_FIELDS = frozenset({"firstName", "lastName", "email", "profilePhoto"})
_NAME_PATTERN = re.compile(r"^[A-Za-z\'-]{1,50}$")

cognito_client = boto3.client(
    "cognito-idp",
    region_name=_REGION,
)


def _attribute_map(attributes: Any) -> Dict[str, str]:
    if not isinstance(attributes, list):
        return {}
    return {
        item["Name"]: item.get("Value", "")
        for item in attributes
        if isinstance(item, dict) and item.get("Name")
    }


def get_profile(event: Dict[str, Any]) -> Dict[str, Any]:
    require_roles(event, _ALLOWED_ROLES)
    principal = _principal(event)
    username = principal.get("username") or principal.get("email")
    if not username:
        raise AuthenticationValidationError("Authenticated username is missing")
    if not _CUP_ID:
        raise AuthenticationServiceError("Cognito User Pool is not configured")
    try:
        response = cognito_client.admin_get_user(
            UserPoolId=_CUP_ID,
            Username=str(username),
        )
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code == "UserNotFoundException":
            from commons.auth.errors import UnauthorizedError

            raise UnauthorizedError("Authenticated user no longer exists") from exc
        raise AuthenticationServiceError() from exc
    except BotoCoreError as exc:
        raise AuthenticationServiceError() from exc

    attrs = _attribute_map(response.get("UserAttributes"))
    user = {
        "email": attrs.get("email") or principal.get("email"),
        "firstName": attrs.get("given_name", ""),
        "lastName": attrs.get("family_name", ""),
        "role": principal.get("role"),
    }
    if attrs.get("picture"):
        user["profilePhoto"] = attrs["picture"]
    return {"user": user}


def handle_get_profile(event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return build_response(200, get_profile(event), event=event)
    except AuthenticationError as exc:
        _LOG.warning("Profile retrieval rejected: %s", exc.error_code)
        return build_response(exc.status_code, exc.to_body(), event=event)
    except Exception:
        _LOG.exception("Unexpected profile retrieval error")
        return build_response(
            500,
            {"code": "INTERNAL_SERVER_ERROR", "message": "Internal server error"},
            event=event,
        )


def _parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
    raw_body = event.get("body")

    if isinstance(raw_body, dict):
        payload = raw_body
    elif isinstance(raw_body, str):
        body_text = raw_body

        if event.get("isBase64Encoded"):
            try:
                body_text = base64.b64decode(raw_body).decode("utf-8")
            except (ValueError, UnicodeDecodeError) as exc:
                raise AuthenticationValidationError(details={"field": "body"}) from exc

        try:
            payload = json.loads(body_text or "{}")
        except (TypeError, ValueError) as exc:
            raise AuthenticationValidationError(details={"field": "body"}) from exc
    else:
        raise AuthenticationValidationError(details={"field": "body"})

    if not isinstance(payload, dict) or not payload:
        raise AuthenticationValidationError(details={"field": "body"})

    unknown_fields = sorted(set(payload) - _ALLOWED_FIELDS)

    if unknown_fields:
        raise AuthenticationValidationError(details={"fields": unknown_fields})

    return payload


def _principal(event: Dict[str, Any]) -> Dict[str, Any]:
    principal = event.get("authenticatedUser")

    if not isinstance(principal, dict):
        raise AuthenticationValidationError("Authenticated user context is missing")

    return principal


def _normalize_email(value: Any) -> str:
    if not isinstance(value, str):
        raise AuthenticationValidationError(details={"field": "email"})

    normalized = value.strip().lower()

    if not normalized:
        raise AuthenticationValidationError(details={"field": "email"})

    return normalized


def _validate_name(
    payload: Dict[str, Any],
    field_name: str,
) -> str | None:
    if field_name not in payload:
        return None

    value = payload.get(field_name)

    if not isinstance(value, str):
        raise AuthenticationValidationError(details={"field": field_name})

    normalized = value.strip()

    if not _NAME_PATTERN.fullmatch(normalized):
        raise AuthenticationValidationError(details={"field": field_name})

    return normalized


def _validate_email_immutability(
    payload: Dict[str, Any],
    principal: Dict[str, Any],
) -> str | None:
    raw_current_email = principal.get("email")

    if "email" not in payload:
        return (
            _normalize_email(raw_current_email)
            if isinstance(raw_current_email, str) and raw_current_email.strip()
            else None
        )

    current_email = _normalize_email(raw_current_email)

    requested_email = _normalize_email(payload.get("email"))

    if requested_email != current_email:
        raise EmailChangeNotAllowedError()

    return current_email


def _validate_profile_photo(
    payload: Dict[str, Any],
) -> str | None:
    if "profilePhoto" not in payload:
        return None

    value = payload.get("profilePhoto")
    if not isinstance(value, str):
        raise AuthenticationValidationError(details={"field": "profilePhoto"})

    normalized = value.strip()
    if not normalized or len(normalized) > 2048:
        raise AuthenticationValidationError(details={"field": "profilePhoto"})

    return normalized


def update_profile(
    event: Dict[str, Any],
) -> Dict[str, Any]:
    require_roles(
        event,
        _ALLOWED_ROLES,
    )
    payload = _parse_body(event)
    principal = _principal(event)
    _validate_email_immutability(
        payload,
        principal,
    )

    first_name = _validate_name(
        payload,
        "firstName",
    )
    last_name = _validate_name(
        payload,
        "lastName",
    )
    profile_photo = _validate_profile_photo(payload)

    attributes = []
    if first_name is not None:
        attributes.append(
            {
                "Name": "given_name",
                "Value": first_name,
            }
        )
    if last_name is not None:
        attributes.append(
            {
                "Name": "family_name",
                "Value": last_name,
            }
        )
    if profile_photo is not None:
        attributes.append(
            {
                "Name": "picture",
                "Value": profile_photo,
            }
        )

    username = principal.get("username") or principal.get("email")
    if not username:
        raise AuthenticationValidationError("Authenticated username is missing")

    if attributes:
        if not _CUP_ID:
            raise AuthenticationServiceError("Cognito User Pool is not configured")

        try:
            cognito_client.admin_update_user_attributes(
                UserPoolId=_CUP_ID,
                Username=str(username),
                UserAttributes=attributes,
            )
        except (ClientError, BotoCoreError) as exc:
            raise AuthenticationServiceError() from exc

        # Return the complete authoritative profile
        # after the successful update.
        updated_user = get_profile(event)["user"]
    else:
        # Same-email-only requests remain a safe
        # backwards-compatible no-op.
        updated_user = {
            "email": _normalize_email(principal.get("email")),
            "firstName": str(principal.get("firstName") or ""),
            "lastName": str(principal.get("lastName") or ""),
            "role": principal.get("role"),
        }
        if principal.get("profilePhoto"):
            updated_user["profilePhoto"] = str(principal["profilePhoto"])

    return {
        "message": ("Profile updated successfully"),
        "user": updated_user,
    }


def handle_update_profile(
    event: Dict[str, Any],
) -> Dict[str, Any]:
    try:
        result = update_profile(event)

        return build_response(
            200,
            result,
            event=event,
        )

    except AuthenticationError as exc:
        _LOG.warning(
            "Profile update rejected: %s",
            exc.error_code,
        )

        return build_response(
            exc.status_code,
            exc.to_body(),
            event=event,
        )

    except Exception:
        _LOG.exception("Unexpected profile update error")

        return build_response(
            500,
            {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Internal server error",
            },
            event=event,
        )
