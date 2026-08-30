"""Helpers for building API Gateway proxy responses."""

import os
import json
from typing import Any, Dict, Optional
from decimal import Decimal


"""
CRITICAL SECURITY & CORS NOTE FOR DEVELOPERS:
--------------------------------------------------------------------------------
Do NOT use wildcard '*' for Access-Control-Allow-Origin or Access-Control-Allow-Methods!

Reason:
Frontend sends credentials (cookies/auth headers) using `credentials: 'include'`.
According to W3C CORS Specifications, when `Access-Control-Allow-Credentials` is `true`,
browsers STRICTLY REJECT responses containing wildcard '*' origins or methods for security reasons.
Origin must strictly match the requesting frontend client.
--------------------------------------------------------------------------------
"""

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://team3-frontend-bucket.s3-website.eu-west-3.amazonaws.com,http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,https://bilgeozcan.github.io"
    ).split(",")
    if origin.strip()
]


DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": (
        "Content-Type,X-Amz-Date,Authorization,"
        "X-Api-Key,X-Amz-Security-Token"
    ),
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Accept-Version": "*",
}


def _decimal_default(obj):
    """DynamoDB'den gelen Decimal degerlerini JSON'a cevirir.

    boto3, DynamoDB'nin N tipini float degil Decimal olarak dondurur;
    json.dumps bu tipi tanimaz. Tam sayi ise int, degilse float dondurulur.
    """
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

def build_response(
    status_code: int,
    body: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None,
    event: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a Lambda proxy integration response with dynamic CORS origin handling."""

    response_headers = dict(DEFAULT_HEADERS)

    request_origin = None
    if event and isinstance(event, dict):
        req_headers = event.get("headers") or {}
        request_origin = req_headers.get("origin") or req_headers.get("Origin")

    if request_origin and request_origin in ALLOWED_ORIGINS:
        response_headers["Access-Control-Allow-Origin"] = request_origin
    else:
        response_headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGINS[0]

    if headers:
        response_headers.update(headers)

    return {
        "statusCode": status_code,
        "headers": response_headers,
        "body": json.dumps(
            body,
            ensure_ascii=False,
            default=_decimal_default,
            separators=(",", ":"),
        ),
    }