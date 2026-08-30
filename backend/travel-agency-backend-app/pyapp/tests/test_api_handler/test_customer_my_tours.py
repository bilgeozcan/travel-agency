import json
from unittest.mock import patch

from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase
from lambdas.api_handler import bookings


def _principal(user_id='customer-1'):
    return {
        'sub': user_id,
        'user_id': user_id,
        'email': 'customer@example.com',
        'username': 'customer@example.com',
        'role': 'CUSTOMER',
        'groups': ['CUSTOMER'],
    }


def _booking(owner='customer-1', booking_id='booking-1'):
    return {
        'id': booking_id,
        'userId': owner,
        'tourId': 'tour-1',
        'assignedTravelAgentId': 'agent-1',
        'internalNotes': 'must not be returned',
        'state': 'BOOKED',
        'tourImageUrl': 'https://example.com/tour.jpg',
        'name': 'Tropical Caribe',
        'destination': 'Punta Cana',
        'tourDetails': {
            'date': '2026-08-15 (7 days)',
            'mealPlan': 'BB',
            'guests': '1 adults, 0 children',
            'totalPrice': '$1400',
            'documents': '2 items',
            'internalField': 'must not be returned',
        },
        'travelAgent': {
            'name': 'Assigned Agent',
            'email': 'agent@example.com',
            'phone': '1234',
            'messenger': 'https://example.com/agent',
            'userId': 'agent-1',
        },
        'canceledBy': None,
        'cancelReason': None,
        'documentRejectionReason': None,
    }


def _body(response):
    return json.loads(response['body'])


@patch('lambdas.api_handler.bookings.dynamodb')
class TestCustomerMyTours(ApiHandlerLambdaTestCase):
    def test_returns_documented_public_booking_dto(self, mock_dynamodb):
        table = mock_dynamodb.Table.return_value
        table.scan.return_value = {'Items': [_booking()]}

        response = bookings.get_bookings(
            {'authenticatedUser': _principal()}
        )

        assert response['statusCode'] == 200
        assert _body(response) == {
            'bookings': [
                {
                    'id': 'booking-1',
                    'tourId': 'tour-1',
                    'state': 'BOOKED',
                    'tourImageUrl': 'https://example.com/tour.jpg',
                    'name': 'Tropical Caribe',
                    'destination': 'Punta Cana',
                    'customerEmail': '',
                    'personalDetails': [],
                    'documents': [],
                    'tourDetails': {
                        'date': '2026-08-15 (7 days)',
                        'mealPlan': 'BB',
                        'guests': '1 adults, 0 children',
                        'totalPrice': '$1400',
                        'documents': '2 items',
                    },
                    'travelAgent': {
                        'name': 'Assigned Agent',
                        'email': 'agent@example.com',
                        'phone': '1234',
                        'messenger': 'https://example.com/agent',
                    },
                    'freeCancelation': None,
                    'canceledBy': None,
                    'canceledByRole': None,
                    'cancelReason': None,
                    'documentRejectionReason': None,
                    'pendingEdits': None,
                    'hasFeedback': False,
                    'feedback': None
                }
            ]
        }

    def test_does_not_expose_internal_ownership_or_assignment_fields(
        self,
        mock_dynamodb,
    ):
        table = mock_dynamodb.Table.return_value
        table.scan.return_value = {'Items': [_booking()]}

        response = bookings.get_bookings(
            {'authenticatedUser': _principal()}
        )

        returned_booking = _body(response)['bookings'][0]
        assert 'userId' not in returned_booking
        assert 'assignedTravelAgentId' not in returned_booking
        assert 'internalNotes' not in returned_booking
        assert 'internalField' not in returned_booking['tourDetails']
        assert 'userId' not in returned_booking['travelAgent']

    def test_returns_empty_array_when_customer_has_no_bookings(
        self,
        mock_dynamodb,
    ):
        table = mock_dynamodb.Table.return_value
        table.scan.return_value = {
            'Items': [_booking(owner='customer-2')]
        }

        response = bookings.get_bookings(
            {'authenticatedUser': _principal()}
        )

        assert response['statusCode'] == 200
        assert _body(response) == {'bookings': []}

    def test_normalizes_cancellation_actor_from_user_snapshot(
        self,
        mock_dynamodb,
    ):
        table = mock_dynamodb.Table.return_value
        item = _booking()
        item['state'] = 'CANCELED'
        item['canceledBy'] = {
            'sub': 'customer-1',
            'user_id': 'customer-1',
            'email': 'customer@example.com',
            'username': 'customer@example.com',
            'role': 'CUSTOMER',
        }
        item['cancelReason'] = 'Canceled by user'
        table.scan.return_value = {'Items': [item]}

        response = bookings.get_bookings(
            {'authenticatedUser': _principal()}
        )

        returned_booking = _body(response)['bookings'][0]
        assert returned_booking['canceledBy'] == 'customer@example.com'
        assert returned_booking['cancelReason'] == 'Canceled by user'

    def test_missing_nested_data_uses_schema_safe_defaults(
        self,
        mock_dynamodb,
    ):
        table = mock_dynamodb.Table.return_value
        item = {
            'id': 'booking-2',
            'userId': 'customer-1',
            'state': 'CONFIRMED',
        }
        table.scan.return_value = {'Items': [item]}

        response = bookings.get_bookings(
            {'authenticatedUser': _principal()}
        )

        assert response['statusCode'] == 200
        assert _body(response)['bookings'][0] == {
            'id': 'booking-2',
            'tourId': '',
            'state': 'CONFIRMED',
            'tourImageUrl': '',
            'name': '',
            'destination': '',
            'customerEmail': '',
            'personalDetails': [],
            'documents': [],
            'tourDetails': {
                'date': '',
                'mealPlan': '',
                'guests': '',
                'totalPrice': '',
                'documents': '0 items',
            },
            'travelAgent': {
                'name': '',
                'email': '',
                'phone': '',
                'messenger': '',
            },
            'freeCancelation': None,
            'canceledBy': None,
            'canceledByRole': None,
            'cancelReason': None,
            'documentRejectionReason': None,
            'pendingEdits': None,
            'hasFeedback': False,
            'feedback': None
        }
