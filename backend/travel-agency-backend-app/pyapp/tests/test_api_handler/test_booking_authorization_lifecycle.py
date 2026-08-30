import json
from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError

from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase
from lambdas.api_handler import bookings


def _principal(role='CUSTOMER', user_id='customer-1', email='customer@example.com'):
    return {
        'sub': user_id,
        'user_id': user_id,
        'email': email,
        'role': role,
        'groups': [role],
    }


def _booking(
    *,
    owner='customer-1',
    state='BOOKED',
    agent_email='agent@example.com',
    booking_id='booking-1',
):
    return {
        'id': booking_id,
        'userId': owner,
        'tourId': 'tour-1',
        'state': state,
        'tourDetails': {
            'date': '2026-08-15 (7 days)',
            'mealPlan': 'BB',
            'guests': '0 adults, 0 children',
            'totalPrice': '$1000',
            'documents': '0 items',
        },
        'travelAgent': {
            'email': agent_email,
            'name': 'Assigned Agent',
        },
    }


def _response_body(response):
    return json.loads(response['body'])


@patch('lambdas.api_handler.bookings.dynamodb_client')
@patch('lambdas.api_handler.bookings.dynamodb')
class TestBookingOwnershipPersistence(ApiHandlerLambdaTestCase):
    def test_create_booking_persists_authenticated_subject_as_owner(self, mock_dynamodb, mock_client):
        tour = {
            'id': 'tour-1',
            'name': 'Tour',
            'destination': 'Destination',
            'price': {'7 days': '$1000'},
            'mealSupplementsPerDay': {'BB': '$0'},
            'imageUrls': [],
        }
        table = mock_dynamodb.Table.return_value
        table.get_item.return_value = {'Item': tour}
        event = {
            'authenticatedUser': _principal(user_id='customer-claims-id'),
            'body': json.dumps({
                'userId': 'attacker-controlled-id',
                'tourId': 'tour-1',
                'date': '2026-08-15',
                'duration': '7 days',
                'mealPlan': 'BB',
                'guests': {'adult': 1, 'children': 0},
                'personalDetails': [{'firstName': 'Test', 'lastName': 'User'}],
            }),
        }

        response = bookings.create_booking(event)

        assert response['statusCode'] == 201
        transaction = mock_client.transact_write_items.call_args.kwargs['TransactItems']
        stored_item = transaction[1]['Put']['Item']
        assert stored_item['userId'] == {'S': 'customer-claims-id'}


@patch('lambdas.api_handler.bookings.dynamodb')
class TestBookingVisibility(ApiHandlerLambdaTestCase):
    def test_customer_list_ignores_client_user_id_and_returns_only_owned_bookings(self, mock_dynamodb):
        table = mock_dynamodb.Table.return_value
        table.scan.return_value = {
            'Items': [
                _booking(owner='customer-1', booking_id='own'),
                _booking(owner='customer-2', booking_id='other'),
            ]
        }
        event = {
            'authenticatedUser': _principal(),
            'queryStringParameters': {'userId': 'customer-2'},
        }

        response = bookings.get_bookings(event)

        assert response['statusCode'] == 200
        assert [item['id'] for item in _response_body(response)['bookings']] == ['own']

    def test_travel_agent_list_returns_only_assigned_bookings(self, mock_dynamodb):
        table = mock_dynamodb.Table.return_value
        table.scan.return_value = {
            'Items': [
                _booking(agent_email='agent@example.com', booking_id='assigned'),
                _booking(agent_email='other@example.com', booking_id='other'),
            ]
        }
        event = {
            'authenticatedUser': _principal(
                role='TRAVEL_AGENT',
                user_id='agent-1',
                email='AGENT@example.com',
            )
        }

        response = bookings.get_bookings(event)

        assert response['statusCode'] == 200
        assert [item['id'] for item in _response_body(response)['bookings']] == ['assigned']

    def test_paginated_scan_is_fully_filtered(self, mock_dynamodb):
        table = mock_dynamodb.Table.return_value
        table.scan.side_effect = [
            {
                'Items': [_booking(owner='customer-2', booking_id='hidden')],
                'LastEvaluatedKey': {'id': 'hidden'},
            },
            {'Items': [_booking(owner='customer-1', booking_id='visible')]},
        ]

        response = bookings.get_bookings(
            {'authenticatedUser': _principal()}
        )

        assert response['statusCode'] == 200
        assert [item['id'] for item in _response_body(response)['bookings']] == ['visible']
        table.scan.assert_any_call(ExclusiveStartKey={'id': 'hidden'})


@patch('lambdas.api_handler.bookings.dynamodb_client')
@patch('lambdas.api_handler.bookings.dynamodb')
class TestBookingObjectAuthorization(ApiHandlerLambdaTestCase):
    def test_customer_cannot_edit_another_customers_booking(self, mock_dynamodb, mock_client):
        table = mock_dynamodb.Table.return_value
        table.get_item.return_value = {'Item': _booking(owner='customer-2')}
        event = {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
            'body': json.dumps({}),
        }

        response = bookings.edit_booking(event)

        assert response['statusCode'] == 404
        assert _response_body(response)['code'] == 'BOOKING_NOT_FOUND'
        mock_client.transact_write_items.assert_not_called()

    def test_customer_can_edit_owned_booking(self, mock_dynamodb, mock_client):
        table = mock_dynamodb.Table.return_value
        owned_booking = _booking(owner='customer-1')
        owned_booking['tourDetails']['guests'] = '1 adults, 0 children'
        tour = {
            'id': 'tour-1',
            'price': {'7 days': '$1000'},
            'mealSupplementsPerDay': {'BB': '$0'},
        }
        table.get_item.side_effect = [
            {'Item': owned_booking},
            {'Item': tour},
        ]
        event = {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
            'body': json.dumps({
                'duration': '7 days',
                'mealPlan': 'BB',
                'guests': {'adult': 1, 'children': 0},
                'personalDetails': [{'firstName': 'Test', 'lastName': 'User'}],
            }),
        }

        response = bookings.edit_booking(event)

        assert response['statusCode'] == 200
        table.put_item.assert_called_once()

    def test_assigned_agent_can_cancel_booking(self, mock_dynamodb, mock_client):
        table = mock_dynamodb.Table.return_value
        table.get_item.return_value = {
            'Item': _booking(agent_email='agent@example.com')
        }
        event = {
            'authenticatedUser': _principal(
                role='TRAVEL_AGENT',
                user_id='agent-1',
                email='agent@example.com',
            ),
            'pathParameters': {'id': 'booking-1'},
        }

        response = bookings.cancel_booking(event)

        assert response['statusCode'] == 200
        table.update_item.assert_called_once()

    def test_unassigned_agent_cannot_cancel_booking(self, mock_dynamodb, mock_client):
        table = mock_dynamodb.Table.return_value
        table.get_item.return_value = {
            'Item': _booking(agent_email='assigned@example.com')
        }
        event = {
            'authenticatedUser': _principal(
                role='TRAVEL_AGENT',
                user_id='agent-2',
                email='unassigned@example.com',
            ),
            'pathParameters': {'id': 'booking-1'},
        }

        response = bookings.cancel_booking(event)

        assert response['statusCode'] == 404
        assert _response_body(response) == {
            'code': 'BOOKING_NOT_FOUND',
            'message': 'Booking not found',
        }
        mock_client.transact_write_items.assert_not_called()

    def test_missing_and_inaccessible_booking_use_same_response(self, mock_dynamodb, mock_client):
        table = mock_dynamodb.Table.return_value
        event = {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
        }

        table.get_item.return_value = {}
        missing = bookings.cancel_booking(event)

        table.get_item.return_value = {'Item': _booking(owner='customer-2')}
        inaccessible = bookings.cancel_booking(event)

        assert missing['statusCode'] == inaccessible['statusCode'] == 404
        assert _response_body(missing) == _response_body(inaccessible)


@patch('lambdas.api_handler.bookings.dynamodb_client')
@patch('lambdas.api_handler.bookings.dynamodb')
class TestBookingLifecycle(ApiHandlerLambdaTestCase):
    def test_edit_rejects_non_editable_states(self, mock_dynamodb, mock_client):
        table = mock_dynamodb.Table.return_value
        event = {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
            'body': json.dumps({}),
        }

        for state in ('STARTED', 'FINISHED', 'CANCELED', 'CANCELLED'):
            with self.subTest(state=state):
                table.get_item.return_value = {'Item': _booking(state=state)}
                response = bookings.edit_booking(event)
                assert response['statusCode'] == 409
                assert _response_body(response)['code'] == 'BOOKING_STATE_CONFLICT'

        mock_client.transact_write_items.assert_not_called()

    def test_cancel_rejects_non_cancellable_states(self, mock_dynamodb, mock_client):
        table = mock_dynamodb.Table.return_value
        event = {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
        }

        for state in ('STARTED', 'FINISHED', 'CANCELED', 'CANCELLED'):
            with self.subTest(state=state):
                table.get_item.return_value = {'Item': _booking(state=state)}
                response = bookings.cancel_booking(event)
                assert response['statusCode'] == 409
                assert _response_body(response)['allowedStates'] == ['BOOKED', 'CONFIRMED']

        mock_client.transact_write_items.assert_not_called()

    def test_customer_can_cancel_owned_booking_in_allowed_states(self, mock_dynamodb, mock_client):
        table = mock_dynamodb.Table.return_value
        table.update_item.return_value = {}
        event = {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
        }

        for state in ('BOOKED', 'CONFIRMED'):
            with self.subTest(state=state):
                table.reset_mock()
                table.get_item.return_value = {'Item': _booking(state=state)}
                response = bookings.cancel_booking(event)
                assert response['statusCode'] == 200
                update_call = table.update_item.call_args.kwargs
                assert update_call['ExpressionAttributeValues'][':newstate'] == 'CANCELED'
                assert update_call['ExpressionAttributeValues'][':booked'] == 'BOOKED'
                assert update_call['ExpressionAttributeValues'][':confirmed'] == 'CONFIRMED'

    def test_cancel_maps_concurrent_state_change_to_conflict(self, mock_dynamodb, mock_client):
        table = mock_dynamodb.Table.return_value
        table.get_item.return_value = {'Item': _booking(state='BOOKED')}
        table.update_item.side_effect = ClientError(
            {
                'Error': {
                    'Code': 'ConditionalCheckFailedException',
                    'Message': 'condition failed',
                }
            },
            'UpdateItem',
        )
        event = {
            'authenticatedUser': _principal(),
            'pathParameters': {'id': 'booking-1'},
        }

        response = bookings.cancel_booking(event)

        assert response['statusCode'] == 409
        assert _response_body(response)['code'] == 'BOOKING_STATE_CONFLICT'
