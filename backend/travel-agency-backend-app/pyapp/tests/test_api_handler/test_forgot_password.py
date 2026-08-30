# cspell:ignore pwnedpasswords
import json
import os
import unittest
from unittest.mock import patch

from botocore.exceptions import ClientError

from pyapp.tests.test_api_handler import LAMBDA_HANDLER
from lambdas.api_handler.forgot_password import (
    handle_confirm_forgot_password,
    handle_forgot_password,
)


class TestForgotPassword(unittest.TestCase):
    @staticmethod
    def _client_error(code):
        return ClientError(
            {
                "Error": {
                    "Code": code,
                    "Message": "Cognito request failed",
                }
            },
            "ForgotPassword",
        )

    @staticmethod
    def _forgot_event(
        email="user@example.com",
    ):
        return {
            "resource": "/auth/forgot-password",
            "path": "/auth/forgot-password",
            "httpMethod": "POST",
            "body": json.dumps(
                {
                    "email": email
                }
            ),
        }

    @staticmethod
    def _confirm_event(
        email="user@example.com",
        confirmation_code="123456",
        new_password="ValidPass123!",
    ):
        return {
            "resource": (
                "/auth/confirm-forgot-password"
            ),
            "path": (
                "/auth/confirm-forgot-password"
            ),
            "httpMethod": "POST",
            "body": json.dumps(
                {
                    "email": email,
                    "confirmationCode": (
                        confirmation_code
                    ),
                    "newPassword": new_password,
                }
            ),
        }

    def test_forgot_password_sends_cognito_code(
        self,
    ):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id",
                "region": "eu-west-3",
            },
            clear=False,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            response = handle_forgot_password(
                self._forgot_event(
                    " USER@Example.COM "
                )
            )

        self.assertEqual(
            response["statusCode"],
            200,
        )

        self.assertEqual(
            json.loads(response["body"]),
            {
                "message": (
                    "If an account exists for this "
                    "email, a password reset code "
                    "has been sent."
                )
            },
        )

        self.assertEqual(
            response["headers"]["Cache-Control"],
            "no-store",
        )
        self.assertEqual(
            response["headers"]["Pragma"],
            "no-cache",
        )
        self.assertIn(
            "Access-Control-Allow-Origin",
            response["headers"],
        )

        (
            client_factory
            .return_value
            .forgot_password
            .assert_called_once_with(
                ClientId="client-id",
                Username="user@example.com",
            )
        )

    def test_unknown_user_returns_generic_success(
        self,
    ):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id"
            },
            clear=False,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            (
                client_factory
                .return_value
                .forgot_password
                .side_effect
            ) = self._client_error(
                "UserNotFoundException"
            )

            response = handle_forgot_password(
                self._forgot_event()
            )

        self.assertEqual(
            response["statusCode"],
            200,
        )
        self.assertNotIn(
            "not found",
            response["body"].lower(),
        )

    def test_unverified_recovery_returns_generic_success(
        self,
    ):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id"
            },
            clear=False,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            (
                client_factory
                .return_value
                .forgot_password
                .side_effect
            ) = self._client_error(
                "InvalidParameterException"
            )

            response = handle_forgot_password(
                self._forgot_event()
            )

        self.assertEqual(
            response["statusCode"],
            200,
        )

    def test_forgot_rejects_invalid_email(
        self,
    ):
        with patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            response = handle_forgot_password(
                self._forgot_event(
                    "not-an-email"
                )
            )

        self.assertEqual(
            response["statusCode"],
            400,
        )

        body = json.loads(
            response["body"]
        )

        self.assertEqual(
            body["code"],
            "VALIDATION_ERROR",
        )
        self.assertIn(
            "email",
            body["details"],
        )
        client_factory.assert_not_called()

    def test_forgot_throttling_returns_429(
        self,
    ):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id"
            },
            clear=False,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            (
                client_factory
                .return_value
                .forgot_password
                .side_effect
            ) = self._client_error(
                "LimitExceededException"
            )

            response = handle_forgot_password(
                self._forgot_event()
            )

        self.assertEqual(
            response["statusCode"],
            429,
        )
        self.assertEqual(
            json.loads(
                response["body"]
            )["code"],
            "TOO_MANY_REQUESTS",
        )

    def test_forgot_unexpected_cognito_error_returns_503(
        self,
    ):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id"
            },
            clear=False,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            (
                client_factory
                .return_value
                .forgot_password
                .side_effect
            ) = self._client_error(
                "InternalErrorException"
            )

            response = handle_forgot_password(
                self._forgot_event()
            )

        self.assertEqual(
            response["statusCode"],
            503,
        )
        self.assertEqual(
            json.loads(
                response["body"]
            )["code"],
            (
                "AUTHENTICATION_SERVICE_"
                "UNAVAILABLE"
            ),
        )

    def test_confirm_happy_path(
        self,
    ):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id",
                "region": "eu-west-3",
            },
            clear=False,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password."
                "pwnedpasswords.check"
            ),
            return_value=0,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            response = (
                handle_confirm_forgot_password(
                    self._confirm_event(
                        email=(
                            " USER@Example.COM "
                        )
                    )
                )
            )

        self.assertEqual(
            response["statusCode"],
            200,
        )
        self.assertEqual(
            json.loads(response["body"]),
            {
                "message": (
                    "Password reset successfully"
                )
            },
        )

        (
            client_factory
            .return_value
            .confirm_forgot_password
            .assert_called_once_with(
                ClientId="client-id",
                Username="user@example.com",
                ConfirmationCode="123456",
                Password="ValidPass123!",
            )
        )

    def test_confirm_rejects_weak_password(
        self,
    ):
        with patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            response = (
                handle_confirm_forgot_password(
                    self._confirm_event(
                        new_password="weak"
                    )
                )
            )

        self.assertEqual(
            response["statusCode"],
            400,
        )

        body = json.loads(
            response["body"]
        )

        self.assertEqual(
            body["code"],
            "PASSWORD_POLICY_VIOLATION",
        )
        self.assertIn(
            "newPassword",
            body["details"],
        )
        client_factory.assert_not_called()

    def test_confirm_rejects_breached_password(
        self,
    ):
        with patch(
            (
                "lambdas.api_handler."
                "forgot_password."
                "pwnedpasswords.check"
            ),
            return_value=10,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            response = (
                handle_confirm_forgot_password(
                    self._confirm_event()
                )
            )

        self.assertEqual(
            response["statusCode"],
            400,
        )
        self.assertEqual(
            json.loads(
                response["body"]
            )["code"],
            "PASSWORD_POLICY_VIOLATION",
        )
        client_factory.assert_not_called()

    def test_confirm_maps_invalid_code(
        self,
    ):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id"
            },
            clear=False,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password."
                "pwnedpasswords.check"
            ),
            return_value=0,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            (
                client_factory
                .return_value
                .confirm_forgot_password
                .side_effect
            ) = self._client_error(
                "CodeMismatchException"
            )

            response = (
                handle_confirm_forgot_password(
                    self._confirm_event()
                )
            )

        self.assertEqual(
            response["statusCode"],
            400,
        )
        self.assertEqual(
            json.loads(
                response["body"]
            )["code"],
            "INVALID_CONFIRMATION_CODE",
        )

    def test_confirm_maps_expired_code(
        self,
    ):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id"
            },
            clear=False,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password."
                "pwnedpasswords.check"
            ),
            return_value=0,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            (
                client_factory
                .return_value
                .confirm_forgot_password
                .side_effect
            ) = self._client_error(
                "ExpiredCodeException"
            )

            response = (
                handle_confirm_forgot_password(
                    self._confirm_event()
                )
            )

        self.assertEqual(
            response["statusCode"],
            400,
        )
        self.assertEqual(
            json.loads(
                response["body"]
            )["code"],
            "EXPIRED_CONFIRMATION_CODE",
        )

    def test_confirm_maps_cognito_password_policy(
        self,
    ):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id"
            },
            clear=False,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password."
                "pwnedpasswords.check"
            ),
            return_value=0,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            (
                client_factory
                .return_value
                .confirm_forgot_password
                .side_effect
            ) = self._client_error(
                "InvalidPasswordException"
            )

            response = (
                handle_confirm_forgot_password(
                    self._confirm_event()
                )
            )

        self.assertEqual(
            response["statusCode"],
            400,
        )
        self.assertEqual(
            json.loads(
                response["body"]
            )["code"],
            "PASSWORD_POLICY_VIOLATION",
        )

    def test_confirm_throttling_returns_429(
        self,
    ):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id"
            },
            clear=False,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password."
                "pwnedpasswords.check"
            ),
            return_value=0,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            (
                client_factory
                .return_value
                .confirm_forgot_password
                .side_effect
            ) = self._client_error(
                "TooManyFailedAttemptsException"
            )

            response = (
                handle_confirm_forgot_password(
                    self._confirm_event()
                )
            )

        self.assertEqual(
            response["statusCode"],
            429,
        )
        self.assertEqual(
            json.loads(
                response["body"]
            )["code"],
            "TOO_MANY_REQUESTS",
        )

    def test_confirm_rejects_invalid_email(
        self,
    ):
        with patch(
            (
                "lambdas.api_handler."
                "forgot_password."
                "pwnedpasswords.check"
            ),
            return_value=0,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            response = (
                handle_confirm_forgot_password(
                    self._confirm_event(
                        email="invalid-email"
                    )
                )
            )

        self.assertEqual(
            response["statusCode"],
            400,
        )
        self.assertEqual(
            json.loads(
                response["body"]
            )["code"],
            "VALIDATION_ERROR",
        )
        client_factory.assert_not_called()

    def test_missing_client_configuration_returns_503(
        self,
    ):
        with patch.dict(
            os.environ,
            {},
            clear=True,
        ), patch(
            (
                "lambdas.api_handler."
                "forgot_password.boto3.client"
            )
        ) as client_factory:
            response = handle_forgot_password(
                self._forgot_event()
            )

        self.assertEqual(
            response["statusCode"],
            503,
        )
        self.assertEqual(
            json.loads(
                response["body"]
            )["code"],
            (
                "AUTHENTICATION_SERVICE_"
                "UNAVAILABLE"
            ),
        )
        client_factory.assert_not_called()

    def test_lambda_routes_forgot_password(
        self,
    ):
        expected = {
            "statusCode": 200,
            "body": "ok",
        }

        with patch.object(
            LAMBDA_HANDLER,
            "handle_forgot_password",
            return_value=expected,
        ) as handler:
            response = (
                LAMBDA_HANDLER.lambda_handler(
                    self._forgot_event(),
                    None,
                )
            )

        self.assertEqual(
            response,
            expected,
        )
        handler.assert_called_once()

    def test_lambda_routes_confirm_forgot_password(
        self,
    ):
        expected = {
            "statusCode": 200,
            "body": "ok",
        }

        with patch.object(
            LAMBDA_HANDLER,
            "handle_confirm_forgot_password",
            return_value=expected,
        ) as handler:
            response = (
                LAMBDA_HANDLER.lambda_handler(
                    self._confirm_event(),
                    None,
                )
            )

        self.assertEqual(
            response,
            expected,
        )
        handler.assert_called_once()


if __name__ == "__main__":
    unittest.main()
