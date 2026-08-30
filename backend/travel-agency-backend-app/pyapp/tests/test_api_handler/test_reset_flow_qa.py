import json
import os
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from commons.password_recovery_session import (
    issue_password_recovery_session,
)
from lambdas.api_handler.reset_password import (
    handle_reset_password,
)


_SECRET_ENV = {
    "PASSWORD_RECOVERY_TOKEN_SECRET": (
        "qa-recovery-secret"
    ),
    "cup_client_id": "client-id",
    "region": "eu-west-3",
}


def _session(
    email="user@example.com",
):
    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ):
        return issue_password_recovery_session(
            email
        )


def _event(
    *,
    email="user@example.com",
    code="123456",
    password="ValidPass123!",
    session=None,
):
    if session is None:
        session = _session(
            email
        )

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


def _cognito_error(
    code,
    message,
):
    return ClientError(
        {
            "Error": {
                "Code": code,
                "Message": message,
            }
        },
        "ConfirmForgotPassword",
    )


def test_qa_valid_code_resets_password_successfully():
    client = MagicMock()

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        (
            "lambdas.api_handler.forgot_password."
            "pwnedpasswords.check"
        ),
        return_value=0,
    ), patch(
        (
            "lambdas.api_handler.reset_password."
            "_cognito_client"
        ),
        return_value=(
            client,
            "client-id",
        ),
    ):
        response = handle_reset_password(
            _event()
        )

    assert response["statusCode"] == 200
    assert json.loads(
        response["body"]
    ) == {
        "message": "Password reset successfully"
    }

    client.confirm_forgot_password.assert_called_once_with(
        ClientId="client-id",
        Username="user@example.com",
        ConfirmationCode="123456",
        Password="ValidPass123!",
    )


def test_qa_invalid_cognito_code_is_rejected():
    client = MagicMock()
    client.confirm_forgot_password.side_effect = (
        _cognito_error(
            "CodeMismatchException",
            "Invalid verification code",
        )
    )

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        (
            "lambdas.api_handler.forgot_password."
            "pwnedpasswords.check"
        ),
        return_value=0,
    ), patch(
        (
            "lambdas.api_handler.reset_password."
            "_cognito_client"
        ),
        return_value=(
            client,
            "client-id",
        ),
    ):
        response = handle_reset_password(
            _event(
                code="999999"
            )
        )

    body = json.loads(
        response["body"]
    )

    assert response["statusCode"] == 400
    assert body["code"] == (
        "INVALID_CONFIRMATION_CODE"
    )


def test_qa_expired_cognito_code_is_rejected():
    client = MagicMock()
    client.confirm_forgot_password.side_effect = (
        _cognito_error(
            "ExpiredCodeException",
            "Verification code expired",
        )
    )

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        (
            "lambdas.api_handler.forgot_password."
            "pwnedpasswords.check"
        ),
        return_value=0,
    ), patch(
        (
            "lambdas.api_handler.reset_password."
            "_cognito_client"
        ),
        return_value=(
            client,
            "client-id",
        ),
    ):
        response = handle_reset_password(
            _event()
        )

    body = json.loads(
        response["body"]
    )

    assert response["statusCode"] == 400
    assert body["code"] == (
        "EXPIRED_CONFIRMATION_CODE"
    )


def test_qa_expired_15_minute_recovery_session_is_rejected():
    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        (
            "commons.password_recovery_session."
            "time.time"
        ),
        return_value=1_000,
    ):
        session = (
            issue_password_recovery_session(
                "user@example.com"
            )
        )

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        (
            "commons.password_recovery_session."
            "time.time"
        ),
        return_value=1_901,
    ), patch(
        (
            "lambdas.api_handler.reset_password."
            "_cognito_client"
        )
    ) as cognito_factory:
        response = handle_reset_password(
            _event(
                session=session
            )
        )

    body = json.loads(
        response["body"]
    )

    assert response["statusCode"] == 400
    assert body["code"] == (
        "EXPIRED_CONFIRMATION_CODE"
    )
    cognito_factory.assert_not_called()


@pytest.mark.parametrize(
    ("password", "expected_requirement"),
    [
        (
            "Aa1!aaa",
            "between 8 and 64",
        ),
        (
            "a1!aaaaaaaa",
            "uppercase",
        ),
        (
            "A1!AAAAAAAA",
            "lowercase",
        ),
        (
            "Aa!aaaaaaaa",
            "number",
        ),
        (
            "Aa1aaaaaaaaa",
            "symbol",
        ),
        (
            "Aa1!"
            + ("a" * 61),
            "between 8 and 64",
        ),
    ],
)
def test_qa_password_rule_violations_are_rejected_before_cognito(
    password,
    expected_requirement,
):
    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        (
            "lambdas.api_handler.reset_password."
            "_cognito_client"
        )
    ) as cognito_factory:
        response = handle_reset_password(
            _event(
                password=password
            )
        )

    body = json.loads(
        response["body"]
    )

    assert response["statusCode"] == 400
    assert body["code"] == (
        "PASSWORD_POLICY_VIOLATION"
    )
    assert expected_requirement in (
        body["details"]["newPassword"]
    )
    cognito_factory.assert_not_called()


@pytest.mark.parametrize(
    "invalid_code",
    [
        "",
        "   ",
        "12 34",
    ],
)
def test_qa_invalid_code_format_is_rejected_before_cognito(
    invalid_code,
):
    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        (
            "lambdas.api_handler.reset_password."
            "_cognito_client"
        )
    ) as cognito_factory:
        response = handle_reset_password(
            _event(
                code=invalid_code
            )
        )

    body = json.loads(
        response["body"]
    )

    assert response["statusCode"] == 400
    assert body["code"] == (
        "VALIDATION_ERROR"
    )
    assert "confirmationCode" in (
        body["details"]
    )
    cognito_factory.assert_not_called()


def test_qa_confirmation_code_and_password_failures_are_reported_together():
    event = _event(
        code=" ",
        password="weak",
    )

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        (
            "lambdas.api_handler.reset_password."
            "_cognito_client"
        )
    ) as cognito_factory:
        response = handle_reset_password(
            event
        )

    body = json.loads(
        response["body"]
    )

    assert response["statusCode"] == 400
    assert body["code"] == (
        "VALIDATION_ERROR"
    )
    assert "confirmationCode" in (
        body["details"]
    )
    assert "newPassword" in (
        body["details"]
    )
    cognito_factory.assert_not_called()


def test_qa_session_for_different_email_is_rejected():
    session = _session(
        "first@example.com"
    )

    with patch.dict(
        os.environ,
        _SECRET_ENV,
        clear=False,
    ), patch(
        (
            "lambdas.api_handler.reset_password."
            "_cognito_client"
        )
    ) as cognito_factory:
        response = handle_reset_password(
            _event(
                email="second@example.com",
                session=session,
            )
        )

    body = json.loads(
        response["body"]
    )

    assert response["statusCode"] == 400
    assert body["code"] == (
        "INVALID_CONFIRMATION_CODE"
    )
    cognito_factory.assert_not_called()
