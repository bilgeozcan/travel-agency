import json
from unittest.mock import patch
from lambdas.api_handler import account_security as security

def event(new_email="new@example.com"):
    return {"headers": {"Authorization": "Bearer token"}, "authenticatedUser": {"sub": "u1", "username": "old@example.com", "email": "old@example.com", "role": "ADMIN"}, "body": json.dumps({"newEmail": new_email, "currentPassword": "Current1!"})}

def test_initiation_reauthenticates_checks_duplicate_and_requests_code():
    with patch.dict("os.environ", {"cup_id": "pool", "cup_client_id": "client"}, clear=False), patch.object(security.cognito_client, "initiate_auth") as auth, patch.object(security.cognito_client, "list_users", return_value={"Users": []}) as users, patch.object(
        security.cognito_client, "update_user_attributes",
        return_value={"CodeDeliveryDetailsList": [{"DeliveryMedium": "EMAIL", "Destination": "n***@example.com"}]},
    ) as update:
        response = security.handle_initiate_email_change(event())
    assert response["statusCode"] == 200
    payload = json.loads(response["body"])
    assert payload["pendingEmail"] == "new@example.com"
    assert payload["delivery"] == {"medium": "EMAIL", "destination": "n***@example.com"}
    auth.assert_called_once()
    users.assert_called_once_with(
        UserPoolId="pool",
        Filter='email = "new@example.com"',
        Limit=2,
    )
    update.assert_called_once()

def test_duplicate_email_has_stable_ui_error():
    with patch.dict("os.environ", {"cup_id": "pool", "cup_client_id": "client"}, clear=False), patch.object(security.cognito_client, "initiate_auth"), patch.object(security.cognito_client, "list_users", return_value={"Users": [{"Username": "other"}]}), patch.object(security.cognito_client, "update_user_attributes") as update:
        response = security.handle_initiate_email_change(event())
    assert response["statusCode"] == 400
    assert json.loads(response["body"]) == {"code": "EMAIL_ALREADY_IN_USE", "message": "This email is already in use, please choose different one"}
    update.assert_not_called()
