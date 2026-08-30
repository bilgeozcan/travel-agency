"""
Secure booking state token utilities.

Issues and validates HMAC-SHA256 signed tokens that carry the validated booking
state (packageId, dates, pricing) between the /bookings/validate step and the
/bookings submission step.  This prevents client-side tampering with the
selected package after server-side validation has taken place.

Required environment variable:
    BOOKING_TOKEN_SECRET   – A sufficiently long random secret string.

Optional environment variable:
    BOOKING_TOKEN_TTL_SECONDS  – Token lifetime in seconds (default: 900 = 15 min).
"""

import base64
import hashlib
import hmac
import json
import os
import sys
import time
from typing import Dict, Any

_DEFAULT_TTL_SECONDS = 900  # 15 minutes


# ===================================================================
# PRODUCTION VALIDATION: Lambda deployment should fail immediately
# if BOOKING_TOKEN_SECRET is not configured. Skip this check if
# running under pytest (test environment).
# ===================================================================
if 'pytest' not in sys.modules and 'BOOKING_TOKEN_SECRET' not in os.environ:
    raise RuntimeError(
        'BOOKING_TOKEN_SECRET environment variable must be configured for Lambda deployment. '
        'Provide it via: lambda_config.json env_variables["BOOKING_TOKEN_SECRET"] → ${booking_token_secret} '
        'or equivalent deployment configuration.'
    )


def _get_secret() -> bytes:
    # Runtime check to handle test scenarios where environment is patched
    secret = os.environ.get('BOOKING_TOKEN_SECRET', '')
    if not secret:
        raise RuntimeError('BOOKING_TOKEN_SECRET environment variable is not configured')
    return secret.encode('utf-8')


def _sign(payload_b64: str) -> str:
    return hmac.new(_get_secret(), payload_b64.encode('utf-8'), hashlib.sha256).hexdigest()


def issue_booking_token(
    package_id: str,
    start_date: str,
    duration: str,
    guest_count: int,
    current_total: float,
    currency: str,
    meal_plan: str = '',
) -> str:
    """
    Create a signed booking state token embedding the validated booking details.

    Returns:
        A string of the form ``<base64url-payload>.<hmac-hex-signature>``.
    """
    ttl = int(os.environ.get('BOOKING_TOKEN_TTL_SECONDS', _DEFAULT_TTL_SECONDS))
    now = int(time.time())

    payload: Dict[str, Any] = {
        'packageId': package_id,
        'startDate': start_date,
        'duration': duration,
        'guestCount': guest_count,
        'currentTotal': current_total,
        'currency': currency,
        'mealPlan': meal_plan,
        'iat': now,
        'exp': now + ttl,
    }

    payload_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).rstrip(b'=').decode('ascii')
    signature = _sign(payload_b64)
    return f'{payload_b64}.{signature}'


def validate_booking_token(token: str) -> Dict[str, Any]:
    """
    Verify and decode a booking state token.

    Raises:
        ValueError: if the token is malformed, has been tampered with, or has
                    expired.

    Returns:
        The decoded payload dict on success.
    """
    if not token or '.' not in token:
        raise ValueError('Malformed booking token')

    # Split at the first dot so the payload segment cannot contain dots
    parts = token.split('.', 1)
    if len(parts) != 2:
        raise ValueError('Malformed booking token')

    payload_b64, received_sig = parts[0], parts[1]

    # --- Signature verification (constant-time compare to prevent timing attacks) ---
    expected_sig = _sign(payload_b64)
    if not hmac.compare_digest(expected_sig, received_sig):
        raise ValueError('Invalid booking token signature')

    # --- Payload decoding ---
    # Restore stripped base64 padding
    padding_needed = (4 - len(payload_b64) % 4) % 4
    try:
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + '=' * padding_needed)
        payload: Dict[str, Any] = json.loads(payload_bytes.decode('utf-8'))
    except Exception:
        raise ValueError('Malformed booking token payload')

    # --- Expiry check ---
    exp = payload.get('exp')
    if exp is None or int(time.time()) > int(exp):
        raise ValueError('Booking token has expired')

    return payload
