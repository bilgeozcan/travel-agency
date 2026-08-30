import json
import os
from unittest.mock import patch

from lambdas.api_handler.handler import lambda_handler
from lambdas.api_handler.verify_code import handle_verify_code
from commons.password_recovery_session import issue_password_recovery_session


_SECRET_ENV = {
    "PASSWORD_RECOVERY_TOKEN_SECRET": "recovery-secret-for-tests",
}


def _event(email="user@example.com", code="123456", session=None):
    if session is None:
        with patch.dict(os.environ, _SECRET_ENV, clear=False):
            session = issue_password_recovery_session(email)
    return {
        "resource": "/auth/verify-code",
        "path": "/auth/verify-code",
        "httpMethod": "POST",
        "body": json.dumps(
            {
                "email": email,
                "confirmationCode": code,
                "verificationSession": session,
            }
        ),
    }


def test_verify_code_accepts_valid_15_minute_session():
    with patch.dict(os.environ, _SECRET_ENV, clear=False):
        response = handle_verify_code(_event())

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["verificationStatus"] == "PENDING_COGNITO_CONFIRMATION"
    assert response["headers"]["Cache-Control"] == "no-store"


def test_verify_code_rejects_missing_code():
    event = _event()
    body = json.loads(event["body"])
    body.pop("confirmationCode")
    event["body"] = json.dumps(body)

    with patch.dict(os.environ, _SECRET_ENV, clear=False):
        response = handle_verify_code(event)

    assert response["statusCode"] == 400
    assert "confirmationCode" in json.loads(response["body"])["details"]


def test_verify_code_rejects_whitespace_code():
    with patch.dict(os.environ, _SECRET_ENV, clear=False):
        response = handle_verify_code(_event(code="   "))

    assert response["statusCode"] == 400


def test_verify_code_rejects_missing_session():
    event = _event()
    body = json.loads(event["body"])
    body.pop("verificationSession")
    event["body"] = json.dumps(body)

    with patch.dict(os.environ, _SECRET_ENV, clear=False):
        response = handle_verify_code(event)

    assert response["statusCode"] == 400
    assert "verificationSession" in json.loads(response["body"])["details"]


def test_verify_code_rejects_tampered_session():
    with patch.dict(os.environ, _SECRET_ENV, clear=False):
        token = issue_password_recovery_session("user@example.com")
        payload, signature = token.split(".", 1)
        replacement = "0" if signature[-1] != "0" else "1"
        tampered = f"{payload}.{signature[:-1]}{replacement}"
        response = handle_verify_code(_event(session=tampered))

    assert response["statusCode"] == 400


def test_verify_code_rejects_session_for_different_email():
    with patch.dict(os.environ, _SECRET_ENV, clear=False):
        token = issue_password_recovery_session("first@example.com")
        response = handle_verify_code(
            _event(email="second@example.com", session=token)
        )

    assert response["statusCode"] == 400


def test_verify_code_rejects_session_after_15_minutes():
    with patch.dict(os.environ, _SECRET_ENV, clear=False), patch(
        "commons.password_recovery_session.time.time", return_value=1_000
    ):
        token = issue_password_recovery_session("user@example.com")

    with patch.dict(os.environ, _SECRET_ENV, clear=False), patch(
        "commons.password_recovery_session.time.time", return_value=1_901
    ):
        response = handle_verify_code(_event(session=token))

    assert response["statusCode"] == 400
    details = json.loads(response["body"])["details"]
    assert "expired" in details["verificationSession"].lower()


def test_lambda_routes_verify_code():
    with patch.dict(os.environ, _SECRET_ENV, clear=False), patch(
        "lambdas.api_handler.handler.handle_verify_code"
    ) as handler:
        handler.return_value = {"statusCode": 200, "headers": {}, "body": "{}"}
        event = _event()
        response = lambda_handler(event, None)

    assert response["statusCode"] == 200
    handler.assert_called_once_with(event)


def test_forgot_password_emits_recovery_session_header():
    from lambdas.api_handler.forgot_password import handle_forgot_password

    event = {
        "resource": "/auth/forgot-password",
        "path": "/auth/forgot-password",
        "httpMethod": "POST",
        "body": json.dumps({"email": "user@example.com"}),
    }
    with patch.dict(
        os.environ,
        {
            **_SECRET_ENV,
            "cup_client_id": "client-id",
            "region": "eu-west-3",
        },
        clear=False,
    ), patch(
        "lambdas.api_handler.forgot_password.boto3.client"
    ):
        response = handle_forgot_password(event)

    assert response["statusCode"] == 200
    assert response["headers"]["X-Password-Recovery-Session"]
    assert (
        response["headers"]["Access-Control-Expose-Headers"]
        == "X-Password-Recovery-Session"
    )
