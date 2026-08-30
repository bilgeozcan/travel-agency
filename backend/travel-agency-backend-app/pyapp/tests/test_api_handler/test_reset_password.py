import json
import os
from unittest.mock import patch

from botocore.exceptions import (
    ClientError,
    EndpointConnectionError,
)

from commons.password_recovery_session import (
    issue_password_recovery_session,
)
from lambdas.api_handler.handler import lambda_handler
from lambdas.api_handler.reset_password import (
    handle_reset_password,
)


_SECRET_ENV = {
    "PASSWORD_RECOVERY_TOKEN_SECRET": (
        "recovery-secret-for-tests"
    ),
    "cup_client_id": "client-id",
    "region": "eu-west-3",
}


def _session(email="user@example.com"):
    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ):
        return issue_password_recovery_session(email)


def _event(
    email="user@example.com",
    code="123456",
    password="ValidPass123!",
    session=None,
):
    if session is None:
        session = _session(email)

    return {
        "resource": "/auth/reset-password",
        "path": "/auth/reset-password",
        "httpMethod": "POST",
        "body": json.dumps(
            {
                "email": email,
                "confirmationCode": code,
                "newPassword": password,
                "verificationSession": session,
            }
        ),
    }


def test_reset_password_happy_path():
    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        "lambdas.api_handler.forgot_password.pwnedpasswords.check",
        return_value=0,
    ), patch(
        "lambdas.api_handler.reset_password._cognito_client"
    ) as cognito_factory:
        client = cognito_factory.return_value[0]
        cognito_factory.return_value = (
            client,
            "client-id",
        )

        response = handle_reset_password(_event())

    assert response["statusCode"] == 200
    assert json.loads(response["body"]) == {
        "message": "Password reset successfully"
    }
    client.confirm_forgot_password.assert_called_once_with(
        ClientId="client-id",
        Username="user@example.com",
        ConfirmationCode="123456",
        Password="ValidPass123!",
    )
    assert response["headers"]["Cache-Control"] == "no-store"


def test_reset_password_requires_verification_session():
    event = _event()
    body = json.loads(event["body"])
    body.pop("verificationSession")
    event["body"] = json.dumps(body)

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        "lambdas.api_handler.reset_password._cognito_client"
    ) as cognito_factory:
        response = handle_reset_password(event)

    assert response["statusCode"] == 400
    details = json.loads(response["body"])["details"]
    assert "verificationSession" in details
    cognito_factory.assert_not_called()


def test_reset_password_rejects_tampered_session():
    token = _session()
    payload, signature = token.split(".", 1)
    replacement = "0" if signature[-1] != "0" else "1"
    tampered = f"{payload}.{signature[:-1]}{replacement}"

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        "lambdas.api_handler.reset_password._cognito_client"
    ) as cognito_factory:
        response = handle_reset_password(
            _event(session=tampered)
        )

    assert response["statusCode"] == 400
    assert json.loads(response["body"])["code"] == (
        "INVALID_CONFIRMATION_CODE"
    )
    cognito_factory.assert_not_called()


def test_reset_password_rejects_session_for_other_email():
    token = _session("first@example.com")

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        "lambdas.api_handler.reset_password._cognito_client"
    ) as cognito_factory:
        response = handle_reset_password(
            _event(
                email="second@example.com",
                session=token,
            )
        )

    assert response["statusCode"] == 400
    assert json.loads(response["body"])["code"] == (
        "INVALID_CONFIRMATION_CODE"
    )
    cognito_factory.assert_not_called()


def test_reset_password_rejects_expired_15_minute_session():
    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        "commons.password_recovery_session.time.time",
        return_value=1_000,
    ):
        token = issue_password_recovery_session(
            "user@example.com"
        )

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        "commons.password_recovery_session.time.time",
        return_value=1_901,
    ), patch(
        "lambdas.api_handler.reset_password._cognito_client"
    ) as cognito_factory:
        response = handle_reset_password(
            _event(session=token)
        )

    assert response["statusCode"] == 400
    assert json.loads(response["body"])["code"] == (
        "EXPIRED_CONFIRMATION_CODE"
    )
    cognito_factory.assert_not_called()


def test_reset_password_rejects_weak_password_before_cognito():
    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        "lambdas.api_handler.reset_password._cognito_client"
    ) as cognito_factory:
        response = handle_reset_password(
            _event(password="weak")
        )

    assert response["statusCode"] == 400
    assert json.loads(response["body"])["code"] == (
        "PASSWORD_POLICY_VIOLATION"
    )
    cognito_factory.assert_not_called()


def test_reset_password_maps_cognito_code_mismatch():
    error = ClientError(
        {
            "Error": {
                "Code": "CodeMismatchException",
                "Message": "bad code",
            }
        },
        "ConfirmForgotPassword",
    )

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        "lambdas.api_handler.forgot_password.pwnedpasswords.check",
        return_value=0,
    ), patch(
        "lambdas.api_handler.reset_password._cognito_client"
    ) as cognito_factory:
        client = cognito_factory.return_value[0]
        cognito_factory.return_value = (client, "client-id")
        client.confirm_forgot_password.side_effect = error
        response = handle_reset_password(_event())

    assert response["statusCode"] == 400
    assert json.loads(response["body"])["code"] == (
        "INVALID_CONFIRMATION_CODE"
    )


def test_reset_password_maps_cognito_expired_code():
    error = ClientError(
        {
            "Error": {
                "Code": "ExpiredCodeException",
                "Message": "expired",
            }
        },
        "ConfirmForgotPassword",
    )

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        "lambdas.api_handler.forgot_password.pwnedpasswords.check",
        return_value=0,
    ), patch(
        "lambdas.api_handler.reset_password._cognito_client"
    ) as cognito_factory:
        client = cognito_factory.return_value[0]
        cognito_factory.return_value = (client, "client-id")
        client.confirm_forgot_password.side_effect = error
        response = handle_reset_password(_event())

    assert response["statusCode"] == 400
    assert json.loads(response["body"])["code"] == (
        "EXPIRED_CONFIRMATION_CODE"
    )


def test_reset_password_maps_transport_failure_to_503():
    error = EndpointConnectionError(
        endpoint_url=(
            "https://cognito-idp.eu-west-3.amazonaws.com"
        )
    )

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        "lambdas.api_handler.forgot_password.pwnedpasswords.check",
        return_value=0,
    ), patch(
        "lambdas.api_handler.reset_password._cognito_client"
    ) as cognito_factory:
        client = cognito_factory.return_value[0]
        cognito_factory.return_value = (client, "client-id")
        client.confirm_forgot_password.side_effect = error
        response = handle_reset_password(_event())

    assert response["statusCode"] == 503
    assert json.loads(response["body"])["code"] == (
        "AUTHENTICATION_SERVICE_UNAVAILABLE"
    )


def test_reset_password_returns_503_when_session_secret_missing():
    with patch.dict(
        os.environ,
        {
            "cup_client_id": "client-id",
            "region": "eu-west-3",
        },
        clear=True,
    ):
        response = handle_reset_password(
            _event(session="payload.signature")
        )

    assert response["statusCode"] == 503
    assert json.loads(response["body"])["code"] == (
        "AUTHENTICATION_SERVICE_UNAVAILABLE"
    )


def test_lambda_routes_reset_password():
    event = _event()

    with patch(
        "lambdas.api_handler.handler.handle_reset_password"
    ) as handler:
        handler.return_value = {
            "statusCode": 200,
            "headers": {},
            "body": "{}",
        }

        response = lambda_handler(event, None)

    assert response["statusCode"] == 200
    handler.assert_called_once_with(event)
