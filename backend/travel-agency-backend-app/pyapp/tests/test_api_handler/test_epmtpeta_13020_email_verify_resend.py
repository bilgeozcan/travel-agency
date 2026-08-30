import json
from unittest.mock import patch
from botocore.exceptions import ClientError
from lambdas.api_handler import account_security as security

def event(body=None):
    return {"headers": {"Authorization": "Bearer token"}, "authenticatedUser": {"sub": "u1", "username": "old@example.com", "email": "old@example.com", "role": "CUSTOMER"}, "body": json.dumps(body or {})}

def err(code):
    return ClientError({"Error": {"Code": code, "Message": "failed"}}, "Operation")

def test_confirm_maps_incorrect_expired_and_missing_pending():
    for code, status, expected in [
        ("CodeMismatchException", 400, "INVALID_CONFIRMATION_CODE"),
        ("ExpiredCodeException", 400, "EXPIRED_CONFIRMATION_CODE"),
        ("InvalidParameterException", 409, "EMAIL_CHANGE_NOT_PENDING"),
    ]:
        with patch.object(security.cognito_client, "verify_user_attribute", side_effect=err(code)):
            response = security.handle_confirm_email_change(event({"code": "123456"}))
        assert response["statusCode"] == status
        assert json.loads(response["body"])["code"] == expected

def test_resend_enforces_60_second_cooldown():
    security._resend_times.clear()
    with patch.object(security, "time") as clock, patch.object(security.cognito_client, "get_user_attribute_verification_code", return_value={}) as resend:
        clock.time.side_effect = [100, 120, 161]
        first = security.handle_resend_email_change(event())
        blocked = security.handle_resend_email_change(event())
        third = security.handle_resend_email_change(event())
    assert first["statusCode"] == 200
    assert blocked["statusCode"] == 429
    assert json.loads(blocked["body"])["code"] == "EMAIL_CHANGE_RESEND_COOLDOWN"
    assert third["statusCode"] == 200
    assert resend.call_count == 2

def test_resend_missing_pending_has_stable_error():
    security._resend_times.clear()
    with patch.object(
        security.cognito_client,
        "get_user_attribute_verification_code",
        side_effect=err("InvalidParameterException"),
    ):
        response = security.handle_resend_email_change(event())
    assert response["statusCode"] == 409
    assert json.loads(response["body"])["code"] == "EMAIL_CHANGE_NOT_PENDING"
