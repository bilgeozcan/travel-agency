"""Authenticated user context extracted from API Gateway claims."""

from typing import Any, Dict, List, Optional

from commons.auth.errors import UnauthorizedError


def _get_claims(event: Dict[str, Any]) -> Dict[str, Any]:
    request_context = event.get("requestContext") or {}
    authorizer = request_context.get("authorizer") or {}

    # REST API Cognito User Pool authorizer format.
    claims = authorizer.get("claims")

    if isinstance(claims, dict):
        return claims

    # HTTP API JWT authorizer compatibility.
    jwt = authorizer.get("jwt") or {}
    claims = jwt.get("claims")

    if isinstance(claims, dict):
        return claims

    raise UnauthorizedError()


def _parse_groups(value: Any) -> List[str]:
    if isinstance(value, list):
        return [
            str(item)
            for item in value
            if item
        ]

    if not isinstance(value, str) or not value.strip():
        return []

    cleaned_value = value.strip().strip("[]")

    return [
        item.strip().strip('"').strip("'")
        for item in cleaned_value.split(",")
        if item.strip()
    ]


def get_authenticated_user(
    event: Dict[str, Any],
) -> Dict[str, Any]:
    """Return normalized authenticated user information."""

    if not isinstance(event, dict):
        raise UnauthorizedError()

    claims = _get_claims(event)

    user_id = claims.get("sub")

    if not user_id:
        raise UnauthorizedError()

    email = claims.get("email")

    username = (
        claims.get("cognito:username")
        or claims.get("username")
        or email
    )

    groups = _parse_groups(
        claims.get("cognito:groups")
    )

    role: Optional[str] = claims.get("custom:role")

    if not role and groups:
        role = groups[0]

    return {
        "sub": user_id,
        "user_id": user_id,
        "email": email,
        "username": username,
        "role": role or "USER",
        "groups": groups,
    }
