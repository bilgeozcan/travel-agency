import json
import unittest
from unittest.mock import patch, MagicMock

from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase
from pyapp.tests import ImportFromSourceContext

with ImportFromSourceContext():
    import importlib
    signup_module = importlib.import_module('lambdas.api_handler.signup')
    handler_module = importlib.import_module('lambdas.api_handler.handler')
    _get_role_for_email = signup_module.get_role_for_email
    handle_sign_up = handler_module.signup


VALID_SIGNUP_EVENT = {
    'body': json.dumps({
        'firstName': 'John',
        'lastName': 'Doe',
        'email': 'john.doe@example.com',
        'password': 'Aa1!aaaa'
    })
}


@patch('lambdas.api_handler.signup.cognito_client')
@patch('lambdas.api_handler.signup.pwnedpasswords.check', return_value=0)
@patch('lambdas.api_handler.signup._dynamodb')
class TestRoleAssignment(ApiHandlerLambdaTestCase):
    """Tests for US-3: Automatic Role Assignment on sign-up"""

    # --- Role determination tests ---

    def test_unknown_email_gets_customer_role(self, mock_dynamodb, mock_pwned, mock_cognito):
        """Email not in TravelAgents table → CUSTOMER role"""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}   # no 'Item' key
        mock_dynamodb.Table.return_value = mock_table

        role = _get_role_for_email('unknown@example.com')

        self.assertEqual(role, 'CUSTOMER')
        mock_table.get_item.assert_called_once_with(Key={'email': 'unknown@example.com'})

    def test_travel_agent_email_gets_travel_agent_role(self, mock_dynamodb, mock_pwned, mock_cognito):
        """Email found in TravelAgents table → TRAVEL_AGENT role"""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {'Item': {'email': 'agent@travelco.com'}}
        mock_dynamodb.Table.return_value = mock_table

        role = _get_role_for_email('agent@travelco.com')

        self.assertEqual(role, 'TRAVEL_AGENT')

    # --- Full sign-up flow tests ---

    def test_signup_assigns_customer_role_and_calls_group(self, mock_dynamodb, mock_pwned, mock_cognito):
        """New user with unknown email → CUSTOMER role → added to CUSTOMER Cognito group"""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_dynamodb.Table.return_value = mock_table
        mock_cognito.admin_create_user.return_value = {}
        mock_cognito.admin_set_user_password.return_value = {}
        mock_cognito.admin_add_user_to_group.return_value = {}

        resp = handle_sign_up(VALID_SIGNUP_EVENT)

        self.assertEqual(resp.get('statusCode'), 201)
        mock_cognito.admin_add_user_to_group.assert_called_once()
        call_kwargs = mock_cognito.admin_add_user_to_group.call_args[1]
        self.assertEqual(call_kwargs.get('GroupName'), 'CUSTOMER')

    def test_signup_assigns_travel_agent_role_and_calls_group(self, mock_dynamodb, mock_pwned, mock_cognito):
        """Known travel agent email → TRAVEL_AGENT role → added to TRAVEL_AGENT Cognito group"""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {'Item': {'email': 'john.doe@example.com'}}
        mock_dynamodb.Table.return_value = mock_table
        mock_cognito.admin_create_user.return_value = {}
        mock_cognito.admin_set_user_password.return_value = {}
        mock_cognito.admin_add_user_to_group.return_value = {}

        resp = handle_sign_up(VALID_SIGNUP_EVENT)

        self.assertEqual(resp.get('statusCode'), 201)
        call_kwargs = mock_cognito.admin_add_user_to_group.call_args[1]
        self.assertEqual(call_kwargs.get('GroupName'), 'TRAVEL_AGENT')

    def test_signup_existing_email_returns_409_no_role_assigned(self, mock_dynamodb, mock_pwned, mock_cognito):
        """Duplicate email → 409, role assignment should NOT be called"""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_dynamodb.Table.return_value = mock_table

        exc_cls = type('UsernameExistsException', (Exception,), {})
        mock_cognito.exceptions = type('E', (), {'UsernameExistsException': exc_cls})
        mock_cognito.admin_create_user.side_effect = exc_cls()

        resp = handle_sign_up(VALID_SIGNUP_EVENT)

        self.assertEqual(resp.get('statusCode'), 409)
        mock_cognito.admin_add_user_to_group.assert_not_called()

    def test_signup_email_normalized_before_role_check(self, mock_dynamodb, mock_pwned, mock_cognito):
        """Email should be lowercased before checking TravelAgents table"""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_dynamodb.Table.return_value = mock_table
        mock_cognito.admin_create_user.return_value = {}
        mock_cognito.admin_set_user_password.return_value = {}
        mock_cognito.admin_add_user_to_group.return_value = {}

        event = {
            'body': json.dumps({
                'firstName': 'John',
                'lastName': 'Doe',
                'email': 'JOHN.DOE@EXAMPLE.COM',
                'password': 'Aa1!aaaa'
            })
        }
        resp = handle_sign_up(event)

        self.assertEqual(resp.get('statusCode'), 201)
        # DynamoDB should be queried with lowercased email
        mock_table.get_item.assert_called_once_with(Key={'email': 'john.doe@example.com'})

    def test_signup_invalid_email_no_role_check(self, mock_dynamodb, mock_pwned, mock_cognito):
        """Invalid email → 400, DynamoDB should NOT be queried"""
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table

        event = {
            'body': json.dumps({
                'firstName': 'John',
                'lastName': 'Doe',
                'email': 'not-an-email',
                'password': 'Aa1!aaaa'
            })
        }
        resp = handle_sign_up(event)

        self.assertEqual(resp.get('statusCode'), 400)
        mock_table.get_item.assert_not_called()

    # --- Authorization / privilege escalation tests ---

    def test_signup_ignores_client_supplied_admin_role(self, mock_dynamodb, mock_pwned, mock_cognito):
        """A malicious 'role': 'ADMIN' field in the request body must be ignored;
        the role must still be derived from the TravelAgents table lookup only."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}  # unknown email -> should be CUSTOMER
        mock_dynamodb.Table.return_value = mock_table
        mock_cognito.admin_create_user.return_value = {}
        mock_cognito.admin_set_user_password.return_value = {}
        mock_cognito.admin_add_user_to_group.return_value = {}

        event = {
            'body': json.dumps({
                'firstName': 'John',
                'lastName': 'Doe',
                'email': 'john.doe@example.com',
                'password': 'Aa1!aaaa',
                'role': 'ADMIN'
            })
        }
        resp = handle_sign_up(event)

        self.assertEqual(resp.get('statusCode'), 201)
        call_kwargs = mock_cognito.admin_add_user_to_group.call_args[1]
        self.assertEqual(call_kwargs.get('GroupName'), 'CUSTOMER')
        self.assertNotEqual(call_kwargs.get('GroupName'), 'ADMIN')

    def test_signup_returns_500_when_group_assignment_fails(self, mock_dynamodb, mock_pwned, mock_cognito):
        """If the Cognito group does not exist (or the call otherwise fails),
        sign-up must NOT report success - a silent failure would leave the
        user registered without the correct role."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_dynamodb.Table.return_value = mock_table
        mock_cognito.admin_create_user.return_value = {}
        mock_cognito.admin_set_user_password.return_value = {}
        mock_cognito.admin_add_user_to_group.side_effect = Exception('Group does not exist')

        with patch.object(signup_module, 'CUP_ID', 'test-user-pool-id'):
            resp = handle_sign_up(VALID_SIGNUP_EVENT)

        self.assertEqual(resp.get('statusCode'), 500)
        mock_cognito.admin_delete_user.assert_called_once_with(
            UserPoolId='test-user-pool-id',
            Username='john.doe@example.com'
        )


if __name__ == '__main__':
    unittest.main()
