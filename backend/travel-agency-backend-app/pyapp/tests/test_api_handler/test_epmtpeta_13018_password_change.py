import json
import logging
from unittest.mock import patch
import pytest
from botocore.exceptions import ClientError
from lambdas.api_handler import account_security as security

OLD = "OldSecret1!"
NEW = "NewSecret2@"

def event(password=NEW, role="ADMIN"):
    return {"headers": {"Authorization": "Bearer access-token"}, "authenticatedUser": {"sub": "u1", "role": role}, "body": json.dumps({"oldPassword": OLD, "newPassword": password})}

@pytest.mark.parametrize("role", ["CUSTOMER", "TRAVEL_AGENT", "ADMIN"])
def test_password_change_uses_access_token(role):
    with patch.object(security.cognito_client, "change_password") as change:
        response = security.handle_change_password(event(role=role))
    assert response["statusCode"] == 200
    change.assert_called_once_with(PreviousPassword=OLD, ProposedPassword=NEW, AccessToken="access-token")

@pytest.mark.parametrize("password", ["Short1!", "lowercase1!", "UPPERCASE1!", "NoNumber!", "NoSpecial1", "A" * 65 + "a1!"])
def test_password_policy_rejects_invalid_values(password):
    with patch.object(security.cognito_client, "change_password") as change:
        response = security.handle_change_password(event(password))
    assert response["statusCode"] == 400
    change.assert_not_called()

def test_passwords_are_not_returned_or_logged(caplog):
    error = ClientError({"Error": {"Code": "NotAuthorizedException", "Message": f"{OLD} {NEW}"}}, "ChangePassword")
    with caplog.at_level(logging.DEBUG), patch.object(security.cognito_client, "change_password", side_effect=error):
        response = security.handle_change_password(event())
    combined = response["body"] + caplog.text
    assert OLD not in combined
    assert NEW not in combined
