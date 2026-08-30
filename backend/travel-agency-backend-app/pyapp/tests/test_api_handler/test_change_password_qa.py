import json
import logging
from unittest.mock import patch

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError
from lambdas.api_handler import account_security as security


OLD = "OldSecret1!"; NEW = "NewSecret2@"
def event(body=None, authenticated=True):
    value = {"resource": "/profile/change-password", "path": "/profile/change-password", "httpMethod": "POST",
             "headers": {"Authorization": "Bearer access-token"}, "body": json.dumps(body if body is not None else {"oldPassword": OLD, "newPassword": NEW})}
    if authenticated: value["authenticatedUser"] = {"sub": "mine", "role": "CUSTOMER"}
    return value


def test_successful_password_change_has_safe_response():
    with patch.object(security.cognito_client, "change_password") as change:
        response = security.handle_change_password(event())
    assert response["statusCode"] == 200 and OLD not in response["body"] and NEW not in response["body"]
    change.assert_called_once_with(PreviousPassword=OLD, ProposedPassword=NEW, AccessToken="access-token")


@pytest.mark.parametrize("body", [
    {"newPassword": NEW}, {"oldPassword": OLD}, {"oldPassword": OLD, "newPassword": "Short1!"},
    {"oldPassword": OLD, "newPassword": "A" * 64 + "a1!"}, {"oldPassword": OLD, "newPassword": "lowercase1!"},
    {"oldPassword": OLD, "newPassword": "UPPERCASE1!"}, {"oldPassword": OLD, "newPassword": "NoNumber!"},
    {"oldPassword": OLD, "newPassword": "NoSpecial1"},
])
def test_local_password_validation_prevents_cognito(body):
    with patch.object(security.cognito_client, "change_password") as change:
        response = security.handle_change_password(event(body))
    assert response["statusCode"] == 400; change.assert_not_called()


@pytest.mark.parametrize("code,status", [("NotAuthorizedException", 401), ("InvalidPasswordException", 400), ("TooManyRequestsException", 429)])
def test_cognito_password_errors_are_safely_mapped(code, status, caplog, capsys):
    error = ClientError({"Error": {"Code": code, "Message": f"failure {OLD} {NEW}"}}, "ChangePassword")
    with caplog.at_level(logging.DEBUG), patch.object(security.cognito_client, "change_password", side_effect=error):
        response = security.handle_change_password(event())
    output = response["body"] + caplog.text + capsys.readouterr().out + capsys.readouterr().err
    assert response["statusCode"] == status and OLD not in output and NEW not in output


def test_invalid_token_and_service_failure_are_mapped_without_secret_leak(caplog):
    with patch.object(security.cognito_client, "change_password", side_effect=EndpointConnectionError(endpoint_url="x")):
        response = security.handle_change_password(event())
    assert response["statusCode"] == 503 and OLD not in response["body"] + caplog.text and NEW not in response["body"] + caplog.text


def test_unauthenticated_password_change_never_calls_cognito():
    with patch.object(security.cognito_client, "change_password") as change:
        response = security.handle_change_password(event(authenticated=False))
    assert response["statusCode"] == 403; change.assert_not_called()


def test_change_password_via_handler_entrypoint():
    from lambdas.api_handler import handler
    full_event = {
        "resource": "/profile/change-password",
        "path": "/profile/change-password",
        "httpMethod": "POST",
        "headers": {"Authorization": "Bearer access-token"},
        "body": json.dumps({"oldPassword": OLD, "newPassword": NEW}),
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "user-123",
                    "email": "test@example.com",
                    "cognito:groups": "[CUSTOMER]",
                }
            }
        },
    }
    with patch.object(security.cognito_client, "change_password") as change:
        response = handler.lambda_handler(full_event, context=None)
    assert response["statusCode"] == 200
    change.assert_called_once_with(PreviousPassword=OLD, ProposedPassword=NEW, AccessToken="access-token")
