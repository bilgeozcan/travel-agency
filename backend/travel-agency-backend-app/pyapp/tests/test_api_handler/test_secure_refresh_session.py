"""Tests for secure Cognito refresh-token handling."""

import json
from unittest.mock import Mock, patch

import pytest
from botocore.exceptions import ClientError

from lambdas.api_handler import sign_in


def _event() -> dict:
    return {
        "httpMethod": "POST",
        "path": "/auth/sign-in",
        "body": json.dumps(
            {
                "email": "customer@example.com",
                "password": "ValidPass123!",
            }
        ),
    }


def _cognito_response(
    refresh_token: str = "refresh-token-value",
) -> dict:
    return {
        "AuthenticationResult": {
            "AccessToken": "access-token-value",
            "IdToken": "id-token-value",
            "RefreshToken": refresh_token,
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
    "lambdas.api_handler.sign_in.boto3.client"
)
def test_refresh_token_is_only_returned_in_secure_cookie(
    mock_boto_client,
):
    cognito_client = Mock()
    cognito_client.initiate_auth.return_value = (
        _cognito_response()
    )
    mock_boto_client.return_value = cognito_client

    user = {
        "id": "user-123",
        "email": "customer@example.com",
        "firstName": "Customer",
        "lastName": "Example",
        "role": "CUSTOMER",
    }

    with patch.object(
        sign_in,
        "_get_user_profile",
        return_value=user,
    ):
        response = sign_in.handle_sign_in(_event())

    assert response["statusCode"] == 200

    body = json.loads(response["body"])

    assert body == {
        "accessToken": "access-token-value",
        "token": "access-token-value",
        "idToken": "id-token-value",
        "expiresIn": 3600,
        "tokenType": "Bearer",
        "user": user,
    }

    assert "refreshToken" not in body
    assert body["accessToken"] == "access-token-value"
    assert body["token"] == body["accessToken"]
    assert body["idToken"] == "id-token-value"
    assert "refresh-token-value" not in response["body"]

    cookie = response["headers"]["Set-Cookie"]

    assert cookie.startswith(
        "__Host-refreshToken=refresh-token-value;"
    )
    assert "Max-Age=2592000" in cookie
    assert "Path=/" in cookie
    assert "Secure" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=Strict" in cookie
    assert "Domain=" not in cookie

    assert response["headers"]["Cache-Control"] == "no-store"
    assert response["headers"]["Pragma"] == "no-cache"

    cognito_client.initiate_auth.assert_called_once_with(
        AuthFlow="USER_PASSWORD_AUTH",
        ClientId="client-id",
        AuthParameters={
            "USERNAME": "customer@example.com",
            "PASSWORD": "ValidPass123!",
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
    "lambdas.api_handler.sign_in.boto3.client"
)
def test_missing_refresh_token_fails_closed(
    mock_boto_client,
):
    response_data = _cognito_response()

    del response_data[
        "AuthenticationResult"
    ]["RefreshToken"]

    cognito_client = Mock()
    cognito_client.initiate_auth.return_value = response_data
    mock_boto_client.return_value = cognito_client

    response = sign_in.handle_sign_in(_event())

    assert response["statusCode"] == 503
    assert "Set-Cookie" not in response["headers"]

    body = json.loads(response["body"])

    assert body == {
        "code": "AUTHENTICATION_SERVICE_UNAVAILABLE",
        "message": (
            "Authentication service is temporarily unavailable"
        ),
    }


def test_invalid_cookie_values_are_rejected():
    invalid_values = (
        "",
        "token\r\nInjected-Header: value",
        "token; Domain=example.com",
    )

    for value in invalid_values:
        with pytest.raises(
            sign_in.AuthenticationServiceError
        ):
            sign_in._build_refresh_cookie(value)


def test_cookie_satisfies_host_prefix_requirements():
    cookie = sign_in._build_refresh_cookie(
        "refresh-token-value"
    )

    assert cookie.startswith("__Host-")
    assert "Secure" in cookie
    assert "Path=/" in cookie
    assert "Domain=" not in cookie


@patch.dict(
    "os.environ",
    {
        "cup_client_id": "client-id",
        "region": "eu-west-3",
    },
    clear=False,
)
@patch(
    "lambdas.api_handler.sign_in.boto3.client"
)
def test_cognito_error_does_not_set_cookie(
    mock_boto_client,
):
    cognito_client = Mock()

    cognito_client.initiate_auth.side_effect = ClientError(
        {
            "Error": {
                "Code": "NotAuthorizedException",
                "Message": "Incorrect username or password",
            }
        },
        "InitiateAuth",
    )

    mock_boto_client.return_value = cognito_client

    response = sign_in.handle_sign_in(_event())

    assert response["statusCode"] == 401
    assert "Set-Cookie" not in response["headers"]
    assert "refreshToken" not in response["body"]
