"""Tests for POST /auth/refresh."""

import json
from unittest.mock import Mock, patch

from botocore.exceptions import ClientError

from lambdas.api_handler import refresh


def _event(cookie_header: str | None = None) -> dict:
    event = {
        "httpMethod": "POST",
        "path": "/auth/refresh",
    }

    if cookie_header is not None:
        event["headers"] = {
            "Cookie": cookie_header,
        }

    return event


def _cognito_response() -> dict:
    return {
        "AuthenticationResult": {
            "AccessToken": "new-access-token",
            "IdToken": "new-id-token",
            "ExpiresIn": 3600,
            "TokenType": "Bearer",
        }
    }


@patch.dict(
    "os.environ",
    {
        "cup_client_id": "client-id",
        "region": "eu-west-3",
    },
    clear=False,
)
@patch(
    "lambdas.api_handler.refresh.boto3.client"
)
def test_refresh_uses_httponly_cookie(
    mock_boto_client,
):
    cognito_client = Mock()
    cognito_client.initiate_auth.return_value = (
        _cognito_response()
    )
    mock_boto_client.return_value = cognito_client

    response = refresh.handle_refresh(
        _event(
            "__Host-refreshToken=refresh-token; "
            "other=value"
        )
    )

    assert response["statusCode"] == 200
    assert json.loads(response["body"]) == {
        "accessToken": "new-access-token",
        "token": "new-access-token",
        "expiresIn": 3600,
        "tokenType": "Bearer",
    }
    assert response["headers"]["Cache-Control"] == (
        "no-store"
    )
    assert response["headers"]["Pragma"] == "no-cache"
    assert "Set-Cookie" not in response["headers"]

    cognito_client.initiate_auth.assert_called_once_with(
        AuthFlow="REFRESH_TOKEN_AUTH",
        ClientId="client-id",
        AuthParameters={
            "REFRESH_TOKEN": "refresh-token",
        },
    )


@patch.dict(
    "os.environ",
    {
        "cup_client_id": "client-id",
        "region": "eu-west-3",
    },
    clear=False,
)
@patch(
    "lambdas.api_handler.refresh.boto3.client"
)
def test_http_api_cookie_list_is_supported(
    mock_boto_client,
):
    cognito_client = Mock()
    cognito_client.initiate_auth.return_value = (
        _cognito_response()
    )
    mock_boto_client.return_value = cognito_client

    response = refresh.handle_refresh(
        {
            "requestContext": {
                "http": {
                    "method": "POST",
                }
            },
            "rawPath": "/auth/refresh",
            "cookies": [
                "theme=dark",
                "__Host-refreshToken=refresh-token",
            ],
        }
    )

    assert response["statusCode"] == 200


def test_missing_cookie_returns_401_and_expires_cookie():
    response = refresh.handle_refresh(_event())

    assert response["statusCode"] == 401
    assert json.loads(response["body"]) == {
        "code": "INVALID_REFRESH_TOKEN",
        "message": (
            "Refresh session is invalid or expired"
        ),
    }

    cookie = response["headers"]["Set-Cookie"]

    assert cookie.startswith(
        "__Host-refreshToken=;"
    )
    assert "Max-Age=0" in cookie
    assert "Secure" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=Strict" in cookie


@patch.dict(
    "os.environ",
    {
        "cup_client_id": "client-id",
        "region": "eu-west-3",
    },
    clear=False,
)
@patch(
    "lambdas.api_handler.refresh.boto3.client"
)
def test_invalid_cognito_refresh_token_returns_401(
    mock_boto_client,
):
    cognito_client = Mock()
    cognito_client.initiate_auth.side_effect = (
        ClientError(
            {
                "Error": {
                    "Code": "NotAuthorizedException",
                    "Message": "Invalid Refresh Token",
                }
            },
            "InitiateAuth",
        )
    )
    mock_boto_client.return_value = cognito_client

    response = refresh.handle_refresh(
        _event(
            "__Host-refreshToken=expired-token"
        )
    )

    assert response["statusCode"] == 401
    assert (
        json.loads(response["body"])["code"]
        == "INVALID_REFRESH_TOKEN"
    )
    assert "Max-Age=0" in (
        response["headers"]["Set-Cookie"]
    )


@patch.dict(
    "os.environ",
    {
        "cup_client_id": "client-id",
        "region": "eu-west-3",
    },
    clear=False,
)
@patch(
    "lambdas.api_handler.refresh.boto3.client"
)
def test_incomplete_cognito_response_returns_503(
    mock_boto_client,
):
    cognito_client = Mock()
    cognito_client.initiate_auth.return_value = {
        "AuthenticationResult": {
            "AccessToken": "new-access-token",
        }
    }
    mock_boto_client.return_value = cognito_client

    response = refresh.handle_refresh(
        _event(
            "__Host-refreshToken=refresh-token"
        )
    )

    assert response["statusCode"] == 503
    assert (
        json.loads(response["body"])["code"]
        == "AUTHENTICATION_SERVICE_UNAVAILABLE"
    )
