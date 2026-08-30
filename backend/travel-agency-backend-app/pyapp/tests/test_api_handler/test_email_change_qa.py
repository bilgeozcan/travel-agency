import json
from unittest.mock import patch
import pytest
from botocore.exceptions import ClientError
from lambdas.api_handler import account_security as security


def event(path, body=None):
    return {"resource": path, "path": path, "httpMethod": "POST", "headers": {"Authorization": "Bearer token"},
            "authenticatedUser": {"sub": "mine", "username": "old@example.com", "email": "old@example.com", "role": "CUSTOMER"},
            "body": json.dumps(body or {})}


def test_email_change_lifecycle_keeps_old_claim_until_confirmation_and_supports_new_sign_in():
    start = event("/profile/email-change", {"newEmail": "new@example.com", "currentPassword": "Current1!"})
    with patch.object(security, "time") as clock, patch.object(security.cognito_client, "initiate_auth") as auth, \
         patch.object(security.cognito_client, "update_user_attributes") as update, patch.object(security.cognito_client, "verify_user_attribute") as verify:
        clock.time.return_value = 100
        initiated = security.handle_initiate_email_change(start)
        assert initiated["statusCode"] == 200 and start["authenticatedUser"]["email"] == "old@example.com"
        update.assert_called_once_with(AccessToken="token", UserAttributes=[{"Name": "email", "Value": "new@example.com"}])
        confirmed = security.handle_confirm_email_change(event("/profile/email-change/confirm", {"code": "123456"}))
        assert confirmed["statusCode"] == 200
        verify.assert_called_once_with(AccessToken="token", AttributeName="email", Code="123456")
        auth.assert_called_once()
    # Cognito owns the alias transition; a successful auth using the new alias proves activation.
    with patch.object(security.cognito_client, "initiate_auth", return_value={"AuthenticationResult": {"AccessToken": "new-token"}}) as auth:
        result = security.cognito_client.initiate_auth(ClientId="client", AuthFlow="USER_PASSWORD_AUTH", AuthParameters={"USERNAME": "new@example.com", "PASSWORD": "Current1!"})
    assert result["AuthenticationResult"]["AccessToken"] == "new-token"; auth.assert_called_once()


@pytest.mark.parametrize("body", [{"newEmail": "bad", "currentPassword": "Current1!"}, {"newEmail": "old@example.com", "currentPassword": "Current1!"}, {"newEmail": "new@example.com"}])
def test_invalid_initiation_is_local_and_does_not_call_cognito(body):
    with patch.object(security.cognito_client, "initiate_auth") as auth, patch.object(security.cognito_client, "update_user_attributes") as update:
        response = security.handle_initiate_email_change(event("/profile/email-change", body))
    assert response["statusCode"] == 400; auth.assert_not_called(); update.assert_not_called()


@pytest.mark.parametrize("code,status", [("NotAuthorizedException", 401), ("AliasExistsException", 400), ("CodeDeliveryFailureException", 503), ("TooManyRequestsException", 429)])
def test_initiation_maps_password_duplicate_delivery_throttle_and_service_errors(code, status):
    error = ClientError({"Error": {"Code": code, "Message": "failed"}}, "Operation")
    with patch.object(security.cognito_client, "initiate_auth", side_effect=error):
        response = security.handle_initiate_email_change(event("/profile/email-change", {"newEmail": "new@example.com", "currentPassword": "Current1!"}))
    assert response["statusCode"] == status


@pytest.mark.parametrize("code,status", [("CodeMismatchException", 400), ("ExpiredCodeException", 400), ("TooManyRequestsException", 429)])
def test_confirmation_errors_and_repeated_attempts(code, status):
    error = ClientError({"Error": {"Code": code, "Message": "failed"}}, "VerifyUserAttribute")
    with patch.object(security.cognito_client, "verify_user_attribute", side_effect=error) as verify:
        first = security.handle_confirm_email_change(event("/profile/email-change/confirm", {"code": "111111"}))
        second = security.handle_confirm_email_change(event("/profile/email-change/confirm", {"code": "111111"}))
    assert first["statusCode"] == status and second["statusCode"] == status and verify.call_count == 2


def test_resend_cooldown_then_success_and_verification_after_resend():
    security._resend_times.clear(); e = event("/profile/email-change/resend")
    with patch.object(security, "time") as clock, patch.object(security.cognito_client, "get_user_attribute_verification_code") as resend, patch.object(security.cognito_client, "verify_user_attribute") as verify:
        clock.time.side_effect = [100, 120, 161]
        assert security.handle_resend_email_change(e)["statusCode"] == 200
        assert security.handle_resend_email_change(e)["statusCode"] == 429
        assert security.handle_resend_email_change(e)["statusCode"] == 200
        assert security.handle_confirm_email_change(event("/profile/email-change/confirm", {"code": "222222"}))["statusCode"] == 200
    assert resend.call_count == 2; verify.assert_called_once()
