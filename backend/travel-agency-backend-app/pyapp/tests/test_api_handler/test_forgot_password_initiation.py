import base64
import json
import os
from unittest.mock import patch

from botocore.exceptions import ClientError, EndpointConnectionError

from lambdas.api_handler.forgot_password import handle_forgot_password


class TestForgotPasswordInitiation:
    @staticmethod
    def _event(body):
        return {
            "resource": "/auth/forgot-password",
            "path": "/auth/forgot-password",
            "httpMethod": "POST",
            "body": body,
        }

    def test_missing_body_is_rejected_before_cognito_call(self):
        event = {
            "resource": "/auth/forgot-password",
            "path": "/auth/forgot-password",
            "httpMethod": "POST",
        }

        with patch(
            "lambdas.api_handler.forgot_password.boto3.client"
        ) as client_factory:
            response = handle_forgot_password(event)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["code"] == "VALIDATION_ERROR"
        assert "body" in body["details"]
        client_factory.assert_not_called()

    def test_empty_email_is_rejected_before_cognito_call(self):
        with patch(
            "lambdas.api_handler.forgot_password.boto3.client"
        ) as client_factory:
            response = handle_forgot_password(
                self._event(json.dumps({"email": "   "}))
            )

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["code"] == "VALIDATION_ERROR"
        assert "email" in body["details"]
        client_factory.assert_not_called()

    def test_base64_json_body_is_accepted_and_email_is_normalized(self):
        encoded_body = base64.b64encode(
            json.dumps(
                {"email": " USER@Example.COM "}
            ).encode("utf-8")
        ).decode("ascii")

        event = self._event(encoded_body)
        event["isBase64Encoded"] = True

        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id",
                "region": "eu-west-3",
            },
            clear=False,
        ), patch(
            "lambdas.api_handler.forgot_password.boto3.client"
        ) as client_factory:
            response = handle_forgot_password(event)

        assert response["statusCode"] == 200
        client_factory.return_value.forgot_password.assert_called_once_with(
            ClientId="client-id",
            Username="user@example.com",
        )

    def test_not_authorized_does_not_disclose_account_state(self):
        error = ClientError(
            {
                "Error": {
                    "Code": "NotAuthorizedException",
                    "Message": "Cognito request failed",
                }
            },
            "ForgotPassword",
        )

        with patch.dict(
            os.environ,
            {"cup_client_id": "client-id"},
            clear=False,
        ), patch(
            "lambdas.api_handler.forgot_password.boto3.client"
        ) as client_factory:
            client_factory.return_value.forgot_password.side_effect = error
            response = handle_forgot_password(
                self._event(
                    json.dumps(
                        {"email": "user@example.com"}
                    )
                )
            )

        assert response["statusCode"] == 200
        assert "not authorized" not in response["body"].lower()
        assert "not found" not in response["body"].lower()

    def test_transport_failure_returns_service_unavailable(self):
        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id",
                "region": "eu-west-3",
            },
            clear=False,
        ), patch(
            "lambdas.api_handler.forgot_password.boto3.client"
        ) as client_factory:
            client_factory.return_value.forgot_password.side_effect = (
                EndpointConnectionError(
                    endpoint_url=(
                        "https://cognito-idp.eu-west-3.amazonaws.com"
                    )
                )
            )

            response = handle_forgot_password(
                self._event(
                    json.dumps(
                        {"email": "user@example.com"}
                    )
                )
            )

        assert response["statusCode"] == 503
        body = json.loads(response["body"])
        assert body["code"] == "AUTHENTICATION_SERVICE_UNAVAILABLE"