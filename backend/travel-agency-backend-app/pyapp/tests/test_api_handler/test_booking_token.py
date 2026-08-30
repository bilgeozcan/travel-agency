"""
Unit tests for:
  - commons.booking_token.issue_booking_token
  - commons.booking_token.validate_booking_token
  - handler.create_booking (POST /bookings)
  - handler.validate_booking_availability token issuance
"""

import importlib
import json
import os
import time
import unittest
from unittest.mock import patch

from pyapp.tests import ImportFromSourceContext

with ImportFromSourceContext():
    booking_token_module = importlib.import_module('commons.booking_token')
    LAMBDA_HANDLER = importlib.import_module('lambdas.api_handler.handler')

issue_booking_token = booking_token_module.issue_booking_token
validate_booking_token = booking_token_module.validate_booking_token

_SECRET_ENV = {'BOOKING_TOKEN_SECRET': 'test-secret-key-for-unit-tests'}


# ---------------------------------------------------------------------------
# Token issuance and validation
# ---------------------------------------------------------------------------

class TestIssueBookingToken(unittest.TestCase):

    def test_returns_string_with_dot_separator(self):
        with patch.dict(os.environ, _SECRET_ENV):
            token = issue_booking_token('pkg-1', '2099-06-01', '7 days', 2, 2000.0, 'USD')
        self.assertIsInstance(token, str)
        self.assertIn('.', token)

    def test_token_contains_expected_fields(self):
        with patch.dict(os.environ, _SECRET_ENV):
            token = issue_booking_token('pkg-42', '2099-07-15', '10 days', 3, 4500.0, 'EUR')
            payload = validate_booking_token(token)
        self.assertEqual(payload['packageId'], 'pkg-42')
        self.assertEqual(payload['startDate'], '2099-07-15')
        self.assertEqual(payload['duration'], '10 days')
        self.assertEqual(payload['guestCount'], 3)
        self.assertEqual(payload['currentTotal'], 4500.0)
        self.assertEqual(payload['currency'], 'EUR')

    def test_raises_when_secret_not_configured(self):
        env_without_secret = {k: v for k, v in os.environ.items() if k != 'BOOKING_TOKEN_SECRET'}
        with patch.dict(os.environ, env_without_secret, clear=True):
            with self.assertRaises(RuntimeError):
                issue_booking_token('pkg-1', '2099-06-01', '7 days', 1, 1000.0, 'USD')

    def test_token_has_iat_and_exp(self):
        with patch.dict(os.environ, _SECRET_ENV):
            before = int(time.time())
            token = issue_booking_token('pkg-1', '2099-06-01', '7 days', 1, 1000.0, 'USD')
            after = int(time.time())
            payload = validate_booking_token(token)
        self.assertGreaterEqual(payload['iat'], before)
        self.assertLessEqual(payload['iat'], after)
        self.assertGreater(payload['exp'], payload['iat'])


# ---------------------------------------------------------------------------
# Token validation – happy path
# ---------------------------------------------------------------------------

class TestValidateBookingTokenHappyPath(unittest.TestCase):

    def _valid_token(self):
        with patch.dict(os.environ, _SECRET_ENV):
            return issue_booking_token('pkg-1', '2099-06-01', '7 days', 2, 2000.0, 'USD')

    def test_valid_token_returns_payload(self):
        token = self._valid_token()
        with patch.dict(os.environ, _SECRET_ENV):
            payload = validate_booking_token(token)
        self.assertEqual(payload['packageId'], 'pkg-1')

    def test_valid_token_does_not_raise(self):
        token = self._valid_token()
        with patch.dict(os.environ, _SECRET_ENV):
            try:
                validate_booking_token(token)
            except ValueError:
                self.fail('validate_booking_token raised ValueError on a valid token')


# ---------------------------------------------------------------------------
# Token validation – tampering detection
# ---------------------------------------------------------------------------

class TestValidateBookingTokenTampering(unittest.TestCase):

    def _valid_token(self):
        with patch.dict(os.environ, _SECRET_ENV):
            return issue_booking_token('pkg-1', '2099-06-01', '7 days', 2, 2000.0, 'USD')

    def test_raises_on_empty_token(self):
        with patch.dict(os.environ, _SECRET_ENV):
            with self.assertRaises(ValueError) as ctx:
                validate_booking_token('')
        self.assertIn('Malformed', str(ctx.exception))

    def test_raises_on_none_token(self):
        with patch.dict(os.environ, _SECRET_ENV):
            with self.assertRaises(ValueError):
                validate_booking_token(None)  # type: ignore[arg-type]

    def test_raises_on_missing_signature(self):
        token = self._valid_token()
        payload_b64 = token.split('.')[0]
        with patch.dict(os.environ, _SECRET_ENV):
            with self.assertRaises(ValueError):
                validate_booking_token(payload_b64)  # no dot → no signature part

    def test_raises_on_altered_signature(self):
        token = self._valid_token()
        payload_b64, sig = token.split('.', 1)
        # Flip a character in the signature
        altered_sig = ('x' if sig[0] != 'x' else 'y') + sig[1:]
        with patch.dict(os.environ, _SECRET_ENV):
            with self.assertRaises(ValueError) as ctx:
                validate_booking_token(f'{payload_b64}.{altered_sig}')
        self.assertIn('signature', str(ctx.exception))

    def test_raises_on_altered_payload(self):
        """Changing payload content must invalidate the signature."""
        import base64
        token = self._valid_token()
        payload_b64, sig = token.split('.', 1)
        # Decode, tamper, re-encode
        padding = (4 - len(payload_b64) % 4) % 4
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + '=' * padding)
        payload = json.loads(payload_bytes.decode('utf-8'))
        payload['packageId'] = 'tampered-pkg'
        tampered_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        tampered_b64 = base64.urlsafe_b64encode(tampered_bytes).rstrip(b'=').decode('ascii')
        with patch.dict(os.environ, _SECRET_ENV):
            with self.assertRaises(ValueError):
                validate_booking_token(f'{tampered_b64}.{sig}')

    def test_raises_on_wrong_secret(self):
        token = self._valid_token()
        with patch.dict(os.environ, {'BOOKING_TOKEN_SECRET': 'different-secret'}):
            with self.assertRaises(ValueError):
                validate_booking_token(token)


# ---------------------------------------------------------------------------
# Token expiry
# ---------------------------------------------------------------------------

class TestValidateBookingTokenExpiry(unittest.TestCase):

    def test_raises_on_expired_token(self):
        """A token with TTL=0 should be expired immediately."""
        with patch.dict(os.environ, {**_SECRET_ENV, 'BOOKING_TOKEN_TTL_SECONDS': '0'}):
            token = issue_booking_token('pkg-1', '2099-06-01', '7 days', 1, 1000.0, 'USD')
            # Sleep is not reliable; patch time instead
            with patch('commons.booking_token.time') as mock_time:
                mock_time.time.return_value = int(time.time()) + 3600  # 1 hour in the future
                with self.assertRaises(ValueError) as ctx:
                    validate_booking_token(token)
            self.assertIn('expired', str(ctx.exception))

    def test_valid_token_within_ttl(self):
        with patch.dict(os.environ, {**_SECRET_ENV, 'BOOKING_TOKEN_TTL_SECONDS': '900'}):
            token = issue_booking_token('pkg-1', '2099-06-01', '7 days', 1, 1000.0, 'USD')
        with patch.dict(os.environ, _SECRET_ENV):
            payload = validate_booking_token(token)
        self.assertEqual(payload['packageId'], 'pkg-1')


# ---------------------------------------------------------------------------
# POST /bookings handler
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# validate_booking_availability now includes bookingToken in 200 response
# ---------------------------------------------------------------------------

@patch('lambdas.api_handler.booking_validate.dynamodb_resource')
class TestValidateBookingAvailabilityTokenIssuance(unittest.TestCase):

    def setUp(self):
        self.handler = LAMBDA_HANDLER.ApiHandler()

    def _event(self, body):
        return {
            'resource': '/bookings/validate',
            'httpMethod': 'POST',
            'body': json.dumps(body),
        }

    def _valid_tour_item(self):
        return {
            'id': 'tour-1',
            'isAvailable': True,
            'startDates': ['2099-01-15'],
            'durations': ['7 days'],
            'currency': 'USD',
            'price': {'7 days': '$1000'},
            'guestQuantity': {
                'adultsMaxValue': 4,
                'childrenMaxValue': 2,
                'totalMaxValue': 6,
            },
            'components': {
                'flight': {
                    'status': 'ACTIVE',
                    'expiryDate': '2099-01-10',
                    'seats': {'available': 20, 'total': 200},
                },
                'accommodation': {
                    'status': 'ACTIVE',
                    'capacity': 4,
                    'availableRooms': 10,
                    'totalRooms': 50,
                },
                'activities': [
                    {
                        'name': 'City Tour',
                        'status': 'AVAILABLE',
                        'isRequired': True,
                        'maxParticipants': 30,
                        'currentParticipants': 10,
                    }
                ],
            },
        }

    def _valid_body(self):
        return {
            'packageId': 'tour-1',
            'startDate': '2099-01-15',
            'duration': '7 days',
            'adults': 2,
            'children': 1,
            'quotedPrice': 3000,
        }

    def test_200_response_includes_booking_token(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._valid_tour_item()}
        with patch.dict(os.environ, _SECRET_ENV):
            response = self.handler.handle_request(self._event(self._valid_body()), {})
        body = json.loads(response['body'])
        self.assertEqual(response['statusCode'], 200)
        self.assertIn('bookingToken', body)
        self.assertIsInstance(body['bookingToken'], str)
        self.assertIn('.', body['bookingToken'])

    def test_booking_token_payload_matches_validated_data(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._valid_tour_item()}
        with patch.dict(os.environ, _SECRET_ENV):
            response = self.handler.handle_request(self._event(self._valid_body()), {})
            body = json.loads(response['body'])
            payload = validate_booking_token(body['bookingToken'])
        self.assertEqual(payload['packageId'], 'tour-1')
        self.assertEqual(payload['startDate'], '2099-01-15')
        self.assertEqual(payload['duration'], '7 days')
        self.assertEqual(payload['guestCount'], 3)
        self.assertEqual(payload['currentTotal'], 3000.0)

    def test_missing_secret_returns_500(self, mock_dynamodb_resource):
        """If BOOKING_TOKEN_SECRET is absent at runtime, /bookings/validate explicitly
        fails with 500 error rather than silently omitting the token. This ensures the
        booking flow breaks explicitly rather than leaving the client in a broken state."""
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._valid_tour_item()}
        env_without_secret = {k: v for k, v in os.environ.items() if k != 'BOOKING_TOKEN_SECRET'}
        with patch.dict(os.environ, env_without_secret, clear=True):
            response = self.handler.handle_request(self._event(self._valid_body()), {})
        body = json.loads(response['body'])
        self.assertEqual(response['statusCode'], 500)
        self.assertIn('Unable to issue booking token', body.get('message', ''))


if __name__ == '__main__':
    unittest.main()
