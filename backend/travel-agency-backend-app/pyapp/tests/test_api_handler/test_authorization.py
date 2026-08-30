import unittest
from commons.auth.authorization import require_roles
from commons.auth.errors import ForbiddenError

class TestAuthorization(unittest.TestCase):
    def test_customer_can_access_customer_endpoint(self):
        """A user with CUSTOMER role can access a CUSTOMER required endpoint."""
        event = {"authenticatedUser": {"role": "CUSTOMER"}}
        require_roles(event, ["CUSTOMER"]) # Should not raise
        self.assertTrue(True)
        
    def test_privilege_escalation_blocked(self):
        """A user with CUSTOMER role cannot access an ADMIN or TRAVEL_AGENT required endpoint."""
        event = {"authenticatedUser": {"role": "CUSTOMER"}}
        with self.assertRaises(ForbiddenError):
            require_roles(event, ["ADMIN", "TRAVEL_AGENT"])
            
    def test_missing_authentication_context(self):
        """Missing authentication context raises ForbiddenError."""
        event = {}
        with self.assertRaises(ForbiddenError):
            require_roles(event, ["CUSTOMER"])
            
    def test_missing_role(self):
        """Missing role in context raises ForbiddenError."""
        event = {"authenticatedUser": {}}
        with self.assertRaises(ForbiddenError):
            require_roles(event, ["CUSTOMER"])
