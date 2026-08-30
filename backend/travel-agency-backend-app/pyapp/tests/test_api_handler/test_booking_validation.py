import json
import os
from unittest.mock import patch

from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase

_SECRET_ENV = {'BOOKING_TOKEN_SECRET': 'test-secret-key-for-unit-tests'}


@patch('lambdas.api_handler.booking_validate.dynamodb_resource')
class TestBookingValidation(ApiHandlerLambdaTestCase):

    def _event(self, body):
        return {
            'resource': '/bookings/validate',
            'httpMethod': 'POST',
            'body': json.dumps(body)
        }

    def _valid_request_body(self):
        return {
            'packageId': 'tour-1',
            'startDate': '2099-01-15',
            'duration': '7 days',
            'adults': 2,
            'children': 1,
            'quotedPrice': 3000
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
                'totalMaxValue': 6
            },
            'components': {
                'flight': {
                    'status': 'ACTIVE',
                    'expiryDate': '2099-01-10',
                    'seats': {
                        'available': 20,
                        'total': 200
                    }
                },
                'accommodation': {
                    'status': 'ACTIVE',
                    'capacity': 4,
                    'availableRooms': 10,
                    'totalRooms': 50
                },
                'activities': [
                    {
                        'name': 'City Tour',
                        'status': 'AVAILABLE',
                        'isRequired': True,
                        'maxParticipants': 30,
                        'currentParticipants': 10
                    }
                ]
            }
        }

    def _tour_with_unavailable_flight_seats(self):
        tour = self._valid_tour_item()
        tour['components']['flight']['seats']['available'] = 2
        return tour

    def _tour_with_unavailable_accommodation(self):
        tour = self._valid_tour_item()
        tour['components']['accommodation']['availableRooms'] = 0
        return tour

    def _tour_with_required_activity_fully_booked(self):
        tour = self._valid_tour_item()
        tour['components']['activities'][0]['status'] = 'FULLY_BOOKED'
        return tour

    def test_validate_booking_happy_path_returns_200(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._valid_tour_item()}

        with patch.dict(os.environ, _SECRET_ENV):
            response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
            body = json.loads(response['body'])

            self.assertEqual(response['statusCode'], 200)
            self.assertEqual(body['isValid'], True)
            self.assertEqual(body['data']['packageId'], 'tour-1')
            self.assertEqual(body['data']['guestCount'], 3)
            self.assertEqual(body['data']['currentTotal'], 3000.0)

    def test_validate_booking_route_dispatch_works(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._valid_tour_item()}

        with patch.dict(os.environ, _SECRET_ENV):
            response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})

            self.assertEqual(response['statusCode'], 200)
            mock_dynamodb_resource.Table.assert_called_once()

    def test_validate_booking_invalid_json_returns_400(self, mock_dynamodb_resource):
        event = {
            'resource': '/bookings/validate',
            'httpMethod': 'POST',
            'body': '{ invalid json'
        }

        response = self.HANDLER.handle_request(event, {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['message'], 'Validation failed')
        self.assertEqual(body['errors']['body'], 'Invalid JSON body')

    def test_validate_booking_missing_required_fields_returns_400(self, mock_dynamodb_resource):
        response = self.HANDLER.handle_request(self._event({}), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['message'], 'Validation failed')
        self.assertIn('packageId', body['errors'])
        self.assertIn('startDate', body['errors'])
        self.assertIn('duration', body['errors'])
        self.assertIn('quotedPrice', body['errors'])

    def test_validate_booking_package_not_found_returns_409(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {}

        response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'PACKAGE_NOT_AVAILABLE')
        self.assertIn('packageId', body['errors'])

    def test_validate_booking_inactive_package_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['isAvailable'] = False
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'PACKAGE_INACTIVE')

    def test_validate_booking_altered_start_date_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['startDates'] = ['2099-02-01']
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'PACKAGE_ALTERED')
        self.assertIn('startDate', body['errors'])

    def test_validate_booking_component_conflict_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['components']['flight']['status'] = 'INACTIVE'
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'COMPONENT_CONFLICT')
        self.assertIn('components', body['errors'])

    def test_validate_booking_price_changed_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['price'] = {'7 days': '$1200'}
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        request_body = self._valid_request_body()
        request_body['quotedPrice'] = 3000

        response = self.HANDLER.handle_request(self._event(request_body), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'PRICE_CHANGED')
        self.assertIn('pricing', body['errors'])
        self.assertEqual(body['errors']['pricing']['quotedTotal'], 3000.0)
        self.assertEqual(body['errors']['pricing']['currentTotal'], 3600.0)

    def test_validate_booking_expired_start_date_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['startDates'] = ['2020-01-01']
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        request_body = self._valid_request_body()
        request_body['startDate'] = '2020-01-01'

        response = self.HANDLER.handle_request(self._event(request_body), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'PACKAGE_EXPIRED')
        self.assertIn('startDate', body['errors'])

    def test_validate_booking_guest_count_only_path_returns_200(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._valid_tour_item()}

        request_body = {
            'packageId': 'tour-1',
            'startDate': '2099-01-15',
            'duration': '7 days',
            'guestCount': 3,
            'quotedPrice': 3000
        }

        with patch.dict(os.environ, _SECRET_ENV):
            response = self.HANDLER.handle_request(self._event(request_body), {})
            body = json.loads(response['body'])

            self.assertEqual(response['statusCode'], 200)
            self.assertEqual(body['data']['guestCount'], 3)

    def test_validate_booking_uses_quoted_total_fallback(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._valid_tour_item()}

        request_body = {
            'packageId': 'tour-1',
            'startDate': '2099-01-15',
            'duration': '7 days',
            'guestCount': 3,
            'quotedTotal': 3000
        }

        with patch.dict(os.environ, _SECRET_ENV):
            response = self.HANDLER.handle_request(self._event(request_body), {})

            self.assertEqual(response['statusCode'], 200)

    def test_validate_booking_invalid_start_date_format_returns_400(self, mock_dynamodb_resource):
        request_body = self._valid_request_body()
        request_body['startDate'] = '15-01-2099'

        response = self.HANDLER.handle_request(self._event(request_body), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertIn('startDate', body['errors'])

    def test_validate_booking_zero_quoted_price_returns_400(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._valid_tour_item()}

        request_body = self._valid_request_body()
        request_body['quotedPrice'] = 0

        response = self.HANDLER.handle_request(self._event(request_body), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['errors']['quotedPrice'], 'quotedPrice must be greater than 0')

    def test_validate_booking_altered_duration_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['durations'] = ['10 days']
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'PACKAGE_ALTERED')
        self.assertIn('duration', body['errors'])

    def test_validate_booking_price_unavailable_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['price'] = {'10 days': '$1300'}
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'PRICE_UNAVAILABLE')
        self.assertIn('duration', body['errors'])

    def test_validate_booking_adults_capacity_conflict_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['guestQuantity']['adultsMaxValue'] = 1
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        request_body = self._valid_request_body()
        request_body['adults'] = 2
        request_body['children'] = 0
        request_body['quotedPrice'] = 2000

        response = self.HANDLER.handle_request(self._event(request_body), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'CAPACITY_CONFLICT')
        self.assertIn('adults', body['errors'])

    def test_validate_booking_children_capacity_conflict_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['guestQuantity']['childrenMaxValue'] = 0
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        request_body = self._valid_request_body()
        request_body['adults'] = 1
        request_body['children'] = 1
        request_body['quotedPrice'] = 2000

        response = self.HANDLER.handle_request(self._event(request_body), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'CAPACITY_CONFLICT')
        self.assertIn('children', body['errors'])

    def test_validate_booking_total_capacity_conflict_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['guestQuantity']['totalMaxValue'] = 2
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        request_body = {
            'packageId': 'tour-1',
            'startDate': '2099-01-15',
            'duration': '7 days',
            'guestCount': 3,
            'quotedPrice': 3000
        }

        response = self.HANDLER.handle_request(self._event(request_body), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'CAPACITY_CONFLICT')
        self.assertIn('guestCount', body['errors'])

    def test_validate_booking_meal_plan_unavailable_returns_409(self, mock_dynamodb_resource):
        tour = self._valid_tour_item()
        tour['mealPlans'] = ['BB']
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': tour}

        request_body = self._valid_request_body()
        request_body['mealPlan'] = 'AI'

        response = self.HANDLER.handle_request(self._event(request_body), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'MEAL_PLAN_UNAVAILABLE')
        self.assertIn('mealPlan', body['errors'])

    def test_validate_booking_conflicts_when_flight_seats_drop_before_checkout(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._tour_with_unavailable_flight_seats()}

        response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'COMPONENT_CONFLICT')
        self.assertIn('components', body['errors'])
        self.assertIn('flight', body['errors']['components'])

    def test_validate_booking_conflicts_when_accommodation_becomes_unavailable(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._tour_with_unavailable_accommodation()}

        response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'COMPONENT_CONFLICT')
        self.assertIn('components', body['errors'])
        self.assertIn('accommodation', body['errors']['components'])

    def test_validate_booking_conflicts_when_required_activity_fills_up(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.return_value = {'Item': self._tour_with_required_activity_fully_booked()}

        response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'COMPONENT_CONFLICT')
        self.assertIn('components', body['errors'])
        self.assertIn('activities', body['errors']['components'])

    def test_validate_booking_revalidation_detects_price_change_after_initial_success(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value

        initial_tour = self._valid_tour_item()
        updated_tour = self._valid_tour_item()
        updated_tour['price'] = {'7 days': '$1100'}
        mock_table.get_item.side_effect = [
            {'Item': initial_tour},
            {'Item': updated_tour},
        ]

        request_body = self._valid_request_body()

        with patch.dict(os.environ, _SECRET_ENV):
            first_response = self.HANDLER.handle_request(self._event(request_body), {})
        first_body = json.loads(first_response['body'])
        self.assertEqual(first_response['statusCode'], 200)
        self.assertEqual(first_body['data']['currentTotal'], 3000.0)

        second_response = self.HANDLER.handle_request(self._event(request_body), {})
        second_body = json.loads(second_response['body'])
        self.assertEqual(second_response['statusCode'], 409)
        self.assertEqual(second_body['code'], 'PRICE_CHANGED')
        self.assertEqual(second_body['errors']['pricing']['quotedTotal'], 3000.0)
        self.assertEqual(second_body['errors']['pricing']['currentTotal'], 3300.0)

    def test_validate_booking_whitespace_package_id_returns_400(self, mock_dynamodb_resource):
        request_body = self._valid_request_body()
        request_body['packageId'] = '   '

        response = self.HANDLER.handle_request(self._event(request_body), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['message'], 'Validation failed')
        self.assertIn('packageId', body['errors'])

    def test_validate_booking_db_error_returns_500(self, mock_dynamodb_resource):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.get_item.side_effect = Exception('dynamodb unavailable')

        response = self.HANDLER.handle_request(self._event(self._valid_request_body()), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 500)
        self.assertEqual(body['message'], 'Internal server error')
