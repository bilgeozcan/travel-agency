"""Cognito sign-out and refresh-session revocation."""

import os
from http.cookies import CookieError, SimpleCookie
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from commons.api_response import build_response
from commons.auth.errors import (
    AuthenticationError,
    AuthenticationServiceError,
)
from commons.log_helper import get_logger


_LOG = get_logger(__name__)

_REFRESH_COOKIE_NAME = "__Host-refreshToken"

_IDEMPOTENT_COGNITO_ERRORS = {
    "InvalidParameterException",
    "NotAuthorizedException",
}


def _get_header(
    event: Dict[str, Any],
    name: str,
) -> Optional[str]:
    if not isinstance(event, dict):
        return None

    headers = event.get("headers") or {}

    if not isinstance(headers, dict):
        return None

    normalized_name = name.lower()

    for header_name, value in headers.items():
        if str(header_name).lower() != normalized_name:
            continue

        if value is None:
            return None

        return str(value)

    return None


def _get_cookie_headers(
    event: Dict[str, Any],
) -> List[str]:
    values: List[str] = []

    cookie_header = _get_header(
        event,
        "cookie",
    )

    if cookie_header:
        values.append(cookie_header)

    if not isinstance(event, dict):
        return values

    cookies = event.get("cookies") or []

    if isinstance(cookies, list):
        values.extend(
            str(cookie)
            for cookie in cookies
            if cookie
        )

    return values


def _get_refresh_token(
    event: Dict[str, Any],
) -> Optional[str]:
    for cookie_header in _get_cookie_headers(event):
        cookie = SimpleCookie()

        try:
            cookie.load(cookie_header)
        except CookieError:
            continue

        morsel = cookie.get(_REFRESH_COOKIE_NAME)

        if morsel is None:
            continue

        refresh_token = morsel.value.strip()

        if (
            not refresh_token
            or any(
                character in refresh_token
                for character in (
                    "\r",
                    "\n",
                    ";",
                )
            )
        ):
            return None

        return refresh_token

    return None


def _build_expired_refresh_cookie() -> str:
    return (
        f"{_REFRESH_COOKIE_NAME}=; "
        "Max-Age=0; "
        "Expires=Thu, 01 Jan 1970 00:00:00 GMT; "
        "Path=/; Secure; HttpOnly; SameSite=None"
    )


def _get_allowed_origins() -> List[str]:
    configured_origins = (
        os.environ.get("CORS_ALLOWED_ORIGINS")
        or os.environ.get("cors_allowed_origins")
        or ""
    )

    return [
        origin.strip()
        for origin in configured_origins.split(",")
        if origin.strip()
    ]


def _build_response_headers(
    event: Dict[str, Any],
) -> Dict[str, str]:
    headers = {
        "Set-Cookie": _build_expired_refresh_cookie(),
        "Cache-Control": "no-store",
        "Pragma": "no-cache",
    }

    request_origin = _get_header(
        event,
        "origin",
    )

    if (
        request_origin
        and request_origin in _get_allowed_origins()
    ):
        headers.update(
            {
                "Access-Control-Allow-Origin": (
                    request_origin
                ),
                "Access-Control-Allow-Credentials": (
                    "true"
                ),
                "Vary": "Origin",
            }
        )

    return headers


def _revoke_refresh_token(
    refresh_token: str,
) -> None:
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

    try:
        cognito_client = boto3.client(
            "cognito-idp",
            region_name=region,
        )

        cognito_client.revoke_token(
            Token=refresh_token,
            ClientId=client_id,
        )

    except ClientError as exc:
        error_code = (
            exc.response
            .get("Error", {})
            .get("Code", "")
        )

        if error_code in _IDEMPOTENT_COGNITO_ERRORS:
            return

        # Never include the token in logs.
        _LOG.warning(
            "Cognito session revocation failed: %s",
            error_code or "UNKNOWN_COGNITO_ERROR",
        )

        raise AuthenticationServiceError() from exc

    except BotoCoreError as exc:
        _LOG.warning(
            "Cognito session revocation request failed"
        )

        raise AuthenticationServiceError() from exc


def _build_sign_out_response(
    status_code: int,
    body: Dict[str, Any],
    response_headers: Dict[str, str],
    event: Dict[str, Any],
) -> Dict[str, Any]:
    """Build a sign-out response with strict origin handling."""

    response = build_response(
        status_code,
        body,
        headers=response_headers,
        event=event,
    )

    final_headers = response.get("headers")

    if not isinstance(final_headers, dict):
        return response

    request_origin = _get_header(
        event,
        "origin",
    )

    origin_is_allowed = bool(
        request_origin
        and request_origin in _get_allowed_origins()
    )

    if not origin_is_allowed:
        # The shared response builder can add credentialed CORS
        # headers. Sign-out must never expose them to an origin
        # that is not explicitly allowlisted.
        final_headers.pop(
            "Access-Control-Allow-Credentials",
            None,
        )

        if (
            request_origin
            and final_headers.get(
                "Access-Control-Allow-Origin"
            )
            == request_origin
        ):
            final_headers.pop(
                "Access-Control-Allow-Origin",
                None,
            )

        if final_headers.get("Vary") == "Origin":
            final_headers.pop(
                "Vary",
                None,
            )

    return response


def handle_sign_out(
    event: Dict[str, Any],
) -> Dict[str, Any]:
    """Revoke the refresh session and expire its cookie."""

    response_headers = _build_response_headers(event)

    try:
        refresh_token = _get_refresh_token(event)

        if refresh_token:
            _revoke_refresh_token(refresh_token)

        return _build_sign_out_response(
            200,
            {
                "message": "Signed out successfully",
            },
            response_headers=response_headers,
            event=event,
        )

    except AuthenticationError as exc:
        _LOG.warning(
            "Sign-out request failed: %s",
            exc.error_code,
        )

        return _build_sign_out_response(
            exc.status_code,
            exc.to_body(),
            response_headers=response_headers,
            event=event,
        )

    except Exception:
        # Do not log the request event or authentication tokens.
        _LOG.exception(
            "Unexpected sign-out error"
        )

        return _build_sign_out_response(
            500,
            {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Internal server error",
            },
            response_headers=response_headers,
            event=event,
        )
