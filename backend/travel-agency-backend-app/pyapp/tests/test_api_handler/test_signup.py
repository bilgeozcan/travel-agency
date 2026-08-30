import json
import unittest
from unittest.mock import patch

from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase, LAMBDA_HANDLER


@patch('lambdas.api_handler.signup._dynamodb')
@patch('lambdas.api_handler.signup.pwnedpasswords.check', return_value=0)
@patch('lambdas.api_handler.signup.cognito_client')
class TestSignup(ApiHandlerLambdaTestCase):

    def test_signup_happy_path(self, mock_cognito, mock_pwned, mock_dynamodb):
        mock_dynamodb.Table.return_value.get_item.return_value = {}
        mock_cognito.admin_create_user.return_value = {}
        mock_cognito.admin_set_user_password.return_value = {}
        mock_cognito.admin_add_user_to_group.return_value = {}

        event = {
            'body': json.dumps({
                'firstName': 'John',
                'lastName': 'Doe',
                'email': 'john.doe@example.com',
                'password': 'Aa1!aaaa'
            })
        }

        resp = LAMBDA_HANDLER.signup(event)
        self.assertEqual(resp.get('statusCode'), 201)
        mock_cognito.admin_create_user.assert_called_once()
        mock_cognito.admin_set_user_password.assert_called_once()

    def test_email_casing_normalized(self, mock_cognito, mock_pwned, mock_dynamodb):
        mock_dynamodb.Table.return_value.get_item.return_value = {}
        mock_cognito.admin_create_user.return_value = {}
        mock_cognito.admin_set_user_password.return_value = {}
        mock_cognito.admin_add_user_to_group.return_value = {}

        event = {
            'body': json.dumps({
                'firstName': 'Alice',
                'lastName': 'Smith',
                'email': 'ALICE.SMITH@Example.COM',
                'password': 'Aa1!aaaa'
            })
        }

        resp = LAMBDA_HANDLER.signup(event)
        self.assertEqual(resp.get('statusCode'), 201)
        called_kwargs = mock_cognito.admin_create_user.call_args[1]
        self.assertEqual(called_kwargs.get('Username'), 'alice.smith@example.com')

    def test_malformed_json_body(self, mock_cognito, mock_pwned, mock_dynamodb):
        event = {'body': '{ invalid json'}
        resp = LAMBDA_HANDLER.signup(event)
        self.assertEqual(resp.get('statusCode'), 400)
        mock_cognito.admin_create_user.assert_not_called()

    def test_invalid_name_returns_400(self, mock_cognito, mock_pwned, mock_dynamodb):
        event = {
            'body': json.dumps({
                'firstName': 'John1',
                'lastName': 'Doe',
                'email': 'john.doe@example.com',
                'password': 'Aa1!aaaa'
            })
        }
        resp = LAMBDA_HANDLER.signup(event)
        self.assertEqual(resp.get('statusCode'), 400)

    def test_invalid_email_returns_400(self, mock_cognito, mock_pwned, mock_dynamodb):
        event = {
            'body': json.dumps({
                'firstName': 'John',
                'lastName': 'Doe',
                'email': 'not-an-email',
                'password': 'Aa1!aaaa'
            })
        }
        resp = LAMBDA_HANDLER.signup(event)
        self.assertEqual(resp.get('statusCode'), 400)

    def test_password_missing_uppercase_returns_400(self, mock_cognito, mock_pwned, mock_dynamodb):
        event = {
            'body': json.dumps({
                'firstName': 'John',
                'lastName': 'Doe',
                'email': 'john.doe@example.com',
                'password': 'aa1!aaaa'
            })
        }
        resp = LAMBDA_HANDLER.signup(event)
        self.assertEqual(resp.get('statusCode'), 400)

    def test_username_exists_exception_returns_409(self, mock_cognito, mock_pwned, mock_dynamodb):
        mock_dynamodb.Table.return_value.get_item.return_value = {}
        # simulate Cognito UsernameExistsException
        exc_cls = type('UsernameExistsException', (Exception,), {})
        mock_cognito.exceptions = type('E', (), {'UsernameExistsException': exc_cls})
        mock_cognito.admin_create_user.side_effect = exc_cls()

        event = {
            'body': json.dumps({
                'firstName': 'John',
                'lastName': 'Doe',
                'email': 'john.doe@example.com',
                'password': 'Aa1!aaaa'
            })
        }
        resp = LAMBDA_HANDLER.signup(event)
        self.assertEqual(resp.get('statusCode'), 409)

    def test_cognito_general_exception_returns_400(self, mock_cognito, mock_pwned, mock_dynamodb):
        mock_dynamodb.Table.return_value.get_item.return_value = {}
        # 1. Define the fake Cognito exception class so Python doesn't evaluate a MagicMock
        exc_cls = type('UsernameExistsException', (Exception,), {})
        mock_cognito.exceptions = type('E', (), {'UsernameExistsException': exc_cls})

        # 2. Trigger the general exception
        mock_cognito.admin_create_user.side_effect = Exception('boom')

        event = {
            'body': json.dumps({
                'firstName': 'John',
                'lastName': 'Doe',
                'email': 'john.doe@example.com',
                'password': 'Aa1!aaaa'
            })
        }
        resp = LAMBDA_HANDLER.signup(event)
        self.assertEqual(resp.get('statusCode'), 400)

    def test_unknown_route_or_method_returns_400(self, mock_cognito, mock_pwned, mock_dynamodb):
        event = {'resource': '/unknown', 'httpMethod': 'GET'}
        resp = self.HANDLER.handle_request(event, {})
        self.assertEqual(resp.get('statusCode'), 400)