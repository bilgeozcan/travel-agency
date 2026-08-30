"""Tests for Cognito sign-out and session revocation."""

import json
from unittest.mock import Mock, patch

from botocore.exceptions import ClientError

from lambdas.api_handler import handler
from lambdas.api_handler import sign_in
from lambdas.api_handler import sign_out


_REFRESH_TOKEN = "refresh-token-value"
_ALLOWED_ORIGIN = "https://travel.example.com"


def _event(
    cookie: str | None = None,
    origin: str | None = _ALLOWED_ORIGIN,
) -> dict:
    headers = {}

    if cookie is not None:
        headers["Cookie"] = cookie

    if origin is not None:
        headers["Origin"] = origin

    return {
        "httpMethod": "POST",
        "path": "/auth/sign-out",
        "headers": headers,
    }


def _cookie(
    refresh_token: str = _REFRESH_TOKEN,
) -> str:
    return (
        "other=value; "
        f"__Host-refreshToken={refresh_token}"
    )


@patch.dict(
    "os.environ",
    {
        "cup_client_id": "client-id",
        "region": "eu-west-3",
        "CORS_ALLOWED_ORIGINS": _ALLOWED_ORIGIN,
    },
    clear=True,
)
@patch(
    "lambdas.api_handler.sign_out.boto3.client"
)
def test_sign_out_revokes_token_and_clears_cookie(
    mock_boto_client,
):
    cognito_client = Mock()
    mock_boto_client.return_value = cognito_client

    response = sign_out.handle_sign_out(
        _event(
            cookie=_cookie(),
        )
    )

    assert response["statusCode"] == 200

    assert json.loads(response["body"]) == {
        "message": "Signed out successfully",
    }

    cognito_client.revoke_token.assert_called_once_with(
        Token=_REFRESH_TOKEN,
        ClientId="client-id",
    )

    expired_cookie = response["headers"]["Set-Cookie"]

    assert expired_cookie.startswith(
        "__Host-refreshToken=;"
    )
    assert "Max-Age=0" in expired_cookie
    assert (
        "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
        in expired_cookie
    )
    assert "Path=/" in expired_cookie
    assert "Secure" in expired_cookie
    assert "HttpOnly" in expired_cookie
    assert "SameSite=Strict" in expired_cookie
    assert "Domain=" not in expired_cookie

    assert (
        response["headers"]
        ["Access-Control-Allow-Origin"]
        == _ALLOWED_ORIGIN
    )
    assert (
        response["headers"]
        ["Access-Control-Allow-Credentials"]
        == "true"
    )

    assert _REFRESH_TOKEN not in response["body"]


@patch.dict(
    "os.environ",
    {},
    clear=True,
)
@patch(
    "lambdas.api_handler.sign_out.boto3.client"
)
def test_missing_cookie_is_idempotent(
    mock_boto_client,
):
    response = sign_out.handle_sign_out(
        _event(
            cookie=None,
            origin=None,
        )
    )

    assert response["statusCode"] == 200
    assert "Max-Age=0" in response["headers"]["Set-Cookie"]

    mock_boto_client.assert_not_called()


@patch.dict(
    "os.environ",
    {
        "cup_client_id": "client-id",
        "region": "eu-west-3",
    },
    clear=True,
)
@patch(
    "lambdas.api_handler.sign_out.boto3.client"
)
def test_revoked_token_is_idempotent(
    mock_boto_client,
):
    cognito_client = Mock()

    cognito_client.revoke_token.side_effect = ClientError(
        {
            "Error": {
                "Code": "NotAuthorizedException",
                "Message": "Token has already expired",
            },
        },
        "RevokeToken",
    )

    mock_boto_client.return_value = cognito_client

    response = sign_out.handle_sign_out(
        _event(
            cookie=_cookie(),
            origin=None,
        )
    )

    assert response["statusCode"] == 200
    assert "Max-Age=0" in response["headers"]["Set-Cookie"]


@patch.dict(
    "os.environ",
    {
        "cup_client_id": "client-id",
        "region": "eu-west-3",
    },
    clear=True,
)
@patch(
    "lambdas.api_handler.sign_out.boto3.client"
)
def test_invalid_token_is_idempotent(
    mock_boto_client,
):
    cognito_client = Mock()

    cognito_client.revoke_token.side_effect = ClientError(
        {
            "Error": {
                "Code": "InvalidParameterException",
                "Message": "Invalid token",
            },
        },
        "RevokeToken",
    )

    mock_boto_client.return_value = cognito_client

    response = sign_out.handle_sign_out(
        _event(
            cookie=_cookie(),
            origin=None,
        )
    )

    assert response["statusCode"] == 200


@patch.dict(
    "os.environ",
    {
        "cup_client_id": "client-id",
        "region": "eu-west-3",
    },
    clear=True,
)
@patch(
    "lambdas.api_handler.sign_out.boto3.client"
)
def test_unexpected_cognito_error_returns_503(
    mock_boto_client,
):
    cognito_client = Mock()

    cognito_client.revoke_token.side_effect = ClientError(
        {
            "Error": {
                "Code": "InternalErrorException",
                "Message": "Internal service error",
            },
        },
        "RevokeToken",
    )

    mock_boto_client.return_value = cognito_client

    response = sign_out.handle_sign_out(
        _event(
            cookie=_cookie(),
            origin=None,
        )
    )

    assert response["statusCode"] == 503

    assert json.loads(response["body"]) == {
        "code": "AUTHENTICATION_SERVICE_UNAVAILABLE",
        "message": (
            "Authentication service is temporarily "
            "unavailable"
        ),
    }

    assert "Max-Age=0" in response["headers"]["Set-Cookie"]
    assert _REFRESH_TOKEN not in response["body"]


@patch.dict(
    "os.environ",
    {
        "cup_client_id": "client-id",
        "region": "eu-west-3",
    },
    clear=True,
)
@patch(
    "lambdas.api_handler.sign_out.boto3.client"
)
def test_http_api_cookie_list_is_supported(
    mock_boto_client,
):
    cognito_client = Mock()
    mock_boto_client.return_value = cognito_client

    event = {
        "httpMethod": "POST",
        "path": "/auth/sign-out",
        "cookies": [
            "other=value",
            (
                "__Host-refreshToken="
                f"{_REFRESH_TOKEN}"
            ),
        ],
    }

    response = sign_out.handle_sign_out(event)

    assert response["statusCode"] == 200

    cognito_client.revoke_token.assert_called_once_with(
        Token=_REFRESH_TOKEN,
        ClientId="client-id",
    )


@patch.dict(
    "os.environ",
    {},
    clear=True,
)
@patch(
    "lambdas.api_handler.sign_out.boto3.client"
)
def test_malformed_cookie_is_idempotent(
    mock_boto_client,
):
    response = sign_out.handle_sign_out(
        _event(
            cookie=(
                '__Host-refreshToken="unterminated'
            ),
            origin=None,
        )
    )

    assert response["statusCode"] == 200
    assert "Max-Age=0" in response["headers"]["Set-Cookie"]

    mock_boto_client.assert_not_called()


@patch.dict(
    "os.environ",
    {
        "CORS_ALLOWED_ORIGINS": _ALLOWED_ORIGIN,
    },
    clear=True,
)
def test_unapproved_origin_does_not_enable_credentials():
    response = sign_out.handle_sign_out(
        _event(
            cookie=None,
            origin="https://malicious.example.com",
        )
    )

    assert response["statusCode"] == 200

    assert (
        "Access-Control-Allow-Credentials"
        not in response["headers"]
    )

    assert (
        response["headers"].get(
            "Access-Control-Allow-Origin"
        )
        != "https://malicious.example.com"
    )


def test_handler_routes_post_sign_out():
    event = {
        "httpMethod": "POST",
        "path": "/auth/sign-out",
    }

    expected_response = {
        "statusCode": 200,
        "body": "sign-out-response",
    }

    with (
        patch.object(
            handler,
            "handle_sign_out",
            return_value=expected_response,
        ) as sign_out_handler,
        patch.object(
            handler.HANDLER,
            "lambda_handler",
        ) as downstream_handler,
    ):
        response = handler.lambda_handler(
            event,
            context=None,
        )

    assert response == expected_response

    sign_out_handler.assert_called_once_with(event)
    downstream_handler.assert_not_called()


def test_cookie_clear_attributes_match_sign_in():
    active_cookie = sign_in._build_refresh_cookie(
        _REFRESH_TOKEN
    )

    expired_cookie = (
        sign_out._build_expired_refresh_cookie()
    )

    for attribute in (
        "Path=/",
        "Secure",
        "HttpOnly",
        "SameSite=Strict",
    ):
        assert attribute in active_cookie
        assert attribute in expired_cookie

    assert "Domain=" not in active_cookie
    assert "Domain=" not in expired_cookie


def test_openapi_defines_idempotent_sign_out_route():
    from pathlib import Path

    openapi_path = (
        Path(__file__).resolve().parents[3]
        / "openapi_travel_agency_sprint1_v1_oas_v3.json"
    )

    document = json.loads(
        openapi_path.read_text(
            encoding="utf-8-sig"
        )
    )

    operation = (
        document["paths"]
        ["/auth/sign-out"]
        ["post"]
    )

    assert operation["security"] == []
    assert operation["operationId"] == "signOut"
    assert "requestBody" not in operation

    responses = operation["responses"]

    assert "200" in responses
    assert "503" in responses
    assert "500" in responses

    sign_in_integration = (
        document["paths"]
        ["/auth/sign-in"]
        ["post"]
        ["x-amazon-apigateway-integration"]
    )

    assert (
        operation["x-amazon-apigateway-integration"]
        == sign_in_integration
    )
