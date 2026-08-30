import json
from unittest.mock import patch, MagicMock

from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase
from lambdas.api_handler import bookings

@patch('lambdas.api_handler.bookings.dynamodb_client')
@patch('lambdas.api_handler.bookings.dynamodb')
class TestBookingsTransactions(ApiHandlerLambdaTestCase):

    def _event(self, body=None):
        return {
            'resource': '/bookings',
            'httpMethod': 'POST',
            'body': json.dumps(body or {}),
            'authenticatedUser': 'user-123'
        }

    def test_create_booking_transact_success(self, mock_dynamodb, mock_dynamodb_client):
        tour_item = {
            'id': 'tour-1',
            'name': 'Sample Tour',
            'destination': 'Nowhere',
            'price': {'7 days': '$1000'},
            'mealSupplementsPerDay': {'BB': '$10'},
            'imageUrls': ['https://example.com/img.jpg'],
            'travelAgentEmail': 'agent@example.com',
            'freeCancelationDaysBefore': 14,
            'guestQuantity': {'adultsMaxValue': 10, 'childrenMaxValue': 5, 'totalMaxValue': 15}
        }

        agent_item = {'email': 'agent@example.com', 'given_name': 'Agent', 'family_name': 'Smith', 'phone': '1234'}

        # Configure Table.get_item to return tour then agent
        mock_table = MagicMock()
        mock_table.get_item.side_effect = [ {'Item': tour_item}, {'Item': agent_item} ]
        mock_dynamodb.Table.return_value = mock_table

        # Mock transact_write_items
        mock_dynamodb_client.transact_write_items.return_value = {}

        body = {
            'tourId': 'tour-1',
            'date': '2026-08-15',
            'duration': '7 days',
            'mealPlan': 'BB',
            'guests': {'adult': 2, 'children': 1},
            'personalDetails': [
                {'firstName': 'John', 'lastName': 'Doe'},
                {'firstName': 'Jane', 'lastName': 'Doe'},
                {'firstName': 'Jimmy', 'lastName': 'Doe'}
            ]
        }

        event = self._event(body)
        response = bookings.create_booking(event)
        resp_body = json.loads(response['body'])

        assert response['statusCode'] == 201
        assert resp_body['freeCancelation'] == '2026-08-01'
        assert mock_dynamodb_client.transact_write_items.called
        transaction = mock_dynamodb_client.transact_write_items.call_args.kwargs['TransactItems']
        assert transaction[1]['Put']['Item']['freeCancelation']['S'] == '2026-08-01'

    def test_get_bookings_includes_existing_feedback(self, mock_dynamodb, mock_dynamodb_client):
        bookings_table = MagicMock()
        bookings_table.scan.return_value = {
            'Items': [
                {'id': 'booking-1', 'userId': 'user-123'},
                {'id': 'booking-2', 'userId': 'user-123'},
            ]
        }
        feedbacks_table = MagicMock()
        feedbacks_table.query.side_effect = [
            {'Items': [{'rating': 4, 'comment': 'Great tour'}]},
            {'Items': []},
        ]
        mock_dynamodb.Table.side_effect = [bookings_table, feedbacks_table, feedbacks_table]

        previous_table_name = bookings.FEEDBACKS_TABLE
        bookings.FEEDBACKS_TABLE = 'test-feedbacks'
        try:
            response = bookings.get_bookings({
                'resource': '/bookings',
                'httpMethod': 'GET',
                'authenticatedUser': {
                    'user_id': 'user-123',
                    'role': 'CUSTOMER',
                },
            })
        finally:
            bookings.FEEDBACKS_TABLE = previous_table_name

        response_body = json.loads(response['body'])
        assert response['statusCode'] == 200
        assert response_body['bookings'][0]['hasFeedback'] is True
        assert response_body['bookings'][0]['feedback'] == {
            'rating': 4,
            'comment': 'Great tour',
        }
        assert response_body['bookings'][1]['hasFeedback'] is False
        assert response_body['bookings'][1]['feedback'] is None