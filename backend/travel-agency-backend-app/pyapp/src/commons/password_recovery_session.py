"""Signed password-recovery session utilities.

The session token is intentionally separate from the Cognito confirmation
code. It only proves that the server initiated a recovery request recently
and enforces the Jira-required 15-minute application-side window. Cognito
remains the authoritative validator of the confirmation code when the
password is actually reset.
"""

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Dict

_DEFAULT_TTL_SECONDS = 900
_PURPOSE = "password-recovery"


def _root_secret() -> bytes:
    secret = (
        os.environ.get("PASSWORD_RECOVERY_TOKEN_SECRET")
        or os.environ.get("BOOKING_TOKEN_SECRET")
        or ""
    )
    if not secret:
        raise RuntimeError(
            "PASSWORD_RECOVERY_TOKEN_SECRET or BOOKING_TOKEN_SECRET "
            "must be configured"
        )
    return secret.encode("utf-8")


def _sign(payload_b64: str) -> str:
    domain_key = hmac.new(
        _root_secret(),
        b"password-recovery-session-v1",
        hashlib.sha256,
    ).digest()
    return hmac.new(
        domain_key,
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()


def _encode_payload(payload: Dict[str, Any]) -> str:
    raw = json.dumps(
        payload,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _decode_payload(payload_b64: str) -> Dict[str, Any]:
    padding = "=" * ((4 - len(payload_b64) % 4) % 4)
    try:
        raw = base64.urlsafe_b64decode(payload_b64 + padding)
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise ValueError("Invalid password recovery session") from exc
    if not isinstance(payload, dict):
        raise ValueError("Invalid password recovery session")
    return payload


def issue_password_recovery_session(email: str) -> str:
    ttl = int(
        os.environ.get(
            "PASSWORD_RECOVERY_SESSION_TTL_SECONDS",
            str(_DEFAULT_TTL_SECONDS),
        )
    )
    now = int(time.time())
    payload = {
        "purpose": _PURPOSE,
        "email": email,
        "iat": now,
        "exp": now + ttl,
    }
    payload_b64 = _encode_payload(payload)
    return f"{payload_b64}.{_sign(payload_b64)}"


def validate_password_recovery_session(
    token: str,
    email: str,
) -> Dict[str, Any]:
    if not isinstance(token, str) or "." not in token:
        raise ValueError("Invalid password recovery session")

    payload_b64, received_signature = token.split(".", 1)
    if not payload_b64 or not received_signature:
        raise ValueError("Invalid password recovery session")

    expected_signature = _sign(payload_b64)
    if not hmac.compare_digest(
        expected_signature,
        received_signature,
    ):
        raise ValueError("Invalid password recovery session")

    payload = _decode_payload(payload_b64)

    if payload.get("purpose") != _PURPOSE:
        raise ValueError("Invalid password recovery session")

    if payload.get("email") != email:
        raise ValueError("Password recovery session does not match email")

    try:
        expires_at = int(payload["exp"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid password recovery session") from exc

    if int(time.time()) > expires_at:
        raise ValueError("Password recovery session has expired")

    return payload
