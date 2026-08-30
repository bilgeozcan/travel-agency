import base64
import json
import os
import unittest
from unittest.mock import patch

from botocore.exceptions import ClientError

from lambdas.api_handler.sign_in import (
    handle_sign_in,
)


def _jwt_token(claims):
    header = {
        "alg": "none",
        "typ": "JWT",
    }

    def encode(value):
        raw = json.dumps(
            value,
            separators=(",", ":"),
        ).encode("utf-8")

        return (
            base64.urlsafe_b64encode(raw)
            .decode("ascii")
            .rstrip("=")
        )

    return (
        f"{encode(header)}."
        f"{encode(claims)}."
        "signature"
    )


class TestSignIn(unittest.TestCase):

    def _event(
        self,
        email="user@example.com",
        password="ValidPass123!",
    ):
        return {
            "body": json.dumps({
                "email": email,
                "password": password,
            })
        }

    def _client_error(self, code):
        return ClientError(
            {
                "Error": {
                    "Code": code,
                    "Message": "Authentication failed",
                }
            },
            "InitiateAuth",
        )

    def test_success_returns_frontend_contract(
        self,
    ):
        id_token = _jwt_token({
            "sub": "user-123",
            "email": "user@example.com",
            "given_name": "Jane",
            "family_name": "Doe",
            "cognito:groups": ["CUSTOMER"],
        })

        with patch.dict(
            os.environ,
            {
                "cup_client_id": "client-id",
                "region": "eu-west-3",
            },
            clear=False,
        ), patch(
            "lambdas.api_handler.sign_in.boto3.client"
        ) as mock_client_factory:
            cognito = (
                mock_client_factory.return_value
            )

            cognito.initiate_auth.return_value = {
                "AuthenticationResult": {
                    "AccessToken": "access-token",
                    "IdToken": id_token,
                    "RefreshToken": "refresh-token",
                    "ExpiresIn": 3600,
                    "TokenType": "Bearer",
                }
            }

            cognito.get_user.return_value = {
                "Username": "user@example.com",
                "UserAttributes": [
                    {
                        "Name": "sub",
                        "Value": "user-123",
                    },
                    {
                        "Name": "email",
                        "Value": "user@example.com",
                    },
                    {
                        "Name": "given_name",
                        "Value": "Jane",
                    },
                    {
                        "Name": "family_name",
                        "Value": "Doe",
                    },
                ],
            }

            response = handle_sign_in(
                self._event(
                    email="  USER@EXAMPLE.COM  "
                )
            )

        self.assertEqual(
            response["statusCode"],
            200,
        )

        body = json.loads(response["body"])

        self.assertEqual(
            body["accessToken"],
            "access-token",
        )
        self.assertEqual(
            body["token"],
            body["accessToken"],
        )
        self.assertEqual(
            body["expiresIn"],
            3600,
        )
        self.assertEqual(
            body["tokenType"],
            "Bearer",
        )
        self.assertEqual(
            body["user"],
            {
                "id": "user-123",
                "email": "user@example.com",
                "firstName": "Jane",
                "lastName": "Doe",
                "role": "CUSTOMER",
            },
        )

        self.assertNotIn(
            "refreshToken",
            body,
        )
        # OpenAPI requires both token types in the JSON body.
        self.assertEqual(
            body["idToken"],
            id_token,
        )

        cookie = response["headers"]["Set-Cookie"]

        self.assertTrue(
            cookie.startswith(
                "__Host-refreshToken=refresh-token;"
            )
        )
        self.assertIn(
            "Max-Age=2592000",
            cookie,
        )
        self.assertIn("Path=/", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)
        self.assertNotIn("Domain=", cookie)
        self.assertEqual(
            response["headers"]["Cache-Control"],
            "no-store",
        )
        self.assertEqual(
            response["headers"]["Pragma"],
            "no-cache",
        )

        cognito.initiate_auth.assert_called_once_with(
            AuthFlow="USER_PASSWORD_AUTH",
            ClientId="client-id",
            AuthParameters={
                "USERNAME": "user@example.com",
                "PASSWORD": "ValidPass123!",
            },
        )

        cognito.get_user.assert_called_once_with(
            AccessToken="access-token"
        )

    def test_invalid_email_returns_400(
        self,
    ):
        with patch(
            "lambdas.api_handler.sign_in.boto3.client"
        ) as mock_client_factory:
            response = handle_sign_in(
                self._event(
                    email="invalid-email"
                )
            )

        self.assertEqual(
            response["statusCode"],
            400,
        )

        body = json.loads(response["body"])

        self.assertEqual(
            body["code"],
            "VALIDATION_ERROR",
        )
        self.assertIn(
            "email",
            body["details"],
        )

        mock_client_factory.assert_not_called()

    def test_empty_password_returns_400(
        self,
    ):
        with patch(
            "lambdas.api_handler.sign_in.boto3.client"
        ) as mock_client_factory:
            response = handle_sign_in(
                self._event(password="")
            )

        self.assertEqual(
            response["statusCode"],
            400,
        )

        mock_client_factory.assert_not_called()

    def test_wrong_password_and_unknown_user_match(
        self,
    ):
        expected_message = (
            "Incorrect email or password. "
            "Try again or create an account."
        )

        for error_code in (
            "NotAuthorizedException",
            "UserNotFoundException",
        ):
            with self.subTest(
                error_code=error_code
            ), patch.dict(
                os.environ,
                {
                    "cup_client_id": "client-id",
                    "region": "eu-west-3",
                },
                clear=False,
            ), patch(
                "lambdas.api_handler.sign_in.boto3.client"
            ) as mock_client_factory:
                cognito = (
                    mock_client_factory.return_value
                )

                cognito.initiate_auth.side_effect = (
                    self._client_error(error_code)
                )

                response = handle_sign_in(
                    self._event()
                )

            self.assertEqual(
                response["statusCode"],
                401,
            )

            body = json.loads(
                response["body"]
            )

            self.assertEqual(
                body,
                {
                    "code": "INVALID_CREDENTIALS",
                    "message": expected_message,
                },
            )


if __name__ == "__main__":
    unittest.main()
