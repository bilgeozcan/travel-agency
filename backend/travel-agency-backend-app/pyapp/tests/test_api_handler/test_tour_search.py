import json
from unittest.mock import patch

from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase


@patch('lambdas.api_handler.tour_search.dynamodb_resource')
class TestTourSearch(ApiHandlerLambdaTestCase):

    def _mock_scan_items(self, mock_dynamodb_resource, items):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.scan.return_value = {'Items': items}
        return mock_table

    def _event(self, query=None):
        return {
            'resource': '/tours/available',
            'httpMethod': 'GET',
            'queryStringParameters': query or {}
        }

    def test_returns_only_available_tours(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'name': 'Garden Resort & Spa',
                'destination': 'Punta Cana, Dominican Republic',
                'startDates': ['2025-01-04'],
                'durations': ['7 days', '10 days'],
                'mealPlans': ['BB', 'HB'],
                'price': {'7 days': '$1400'},
                'rating': 4.9,
                'reviews': 19,
                'freeCancelation': '2024-12-25',
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 4, 'childrenMaxValue': 2, 'totalMaxValue': 6}
            },
            {
                'id': 'tour-2',
                'name': 'Hidden Cruise',
                'destination': 'Athens, Greece',
                'startDates': ['2025-02-01'],
                'durations': ['5 days'],
                'mealPlans': ['AI'],
                'price': {'5 days': '$1700'},
                'rating': 4.3,
                'reviews': 5,
                'freeCancelation': '2025-01-20',
                'tourType': 'CRUISE',
                'isAvailable': False,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 0, 'totalMaxValue': 2}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(self._event(), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(len(body['tours']), 1)
        self.assertEqual(body['tours'][0]['id'], 'tour-1')

    def test_filters_by_destination(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'name': 'Garden Resort & Spa',
                'destination': 'Punta Cana, Dominican Republic',
                'startDates': ['2025-01-04'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1400'},
                'rating': 4.9,
                'reviews': 19,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 4, 'childrenMaxValue': 2, 'totalMaxValue': 6}
            },
            {
                'id': 'tour-2',
                'name': 'Dolomites Hike',
                'destination': 'Dolomites Mountains, Italy',
                'startDates': ['2025-01-15'],
                'durations': ['7 days'],
                'mealPlans': ['HB'],
                'price': {'7 days': '$1200'},
                'rating': 4.7,
                'reviews': 10,
                'tourType': 'HIKE',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 8, 'childrenMaxValue': 0, 'totalMaxValue': 8}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'destination': 'Punta Cana'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(len(body['tours']), 1)
        self.assertEqual(body['tours'][0]['destination'], 'Punta Cana, Dominican Republic')

    def test_filters_by_start_date_duration_meal_plan_and_type(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'name': 'Garden Resort & Spa',
                'destination': 'Punta Cana, Dominican Republic',
                'startDates': ['2025-01-04'],
                'durations': ['7 days', '10 days'],
                'mealPlans': ['BB', 'HB'],
                'price': {'7 days': '$1400'},
                'rating': 4.9,
                'reviews': 19,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 4, 'childrenMaxValue': 2, 'totalMaxValue': 6}
            },
            {
                'id': 'tour-2',
                'name': 'Ocean Cruise',
                'destination': 'Athens, Greece',
                'startDates': ['2025-01-04'],
                'durations': ['7 days'],
                'mealPlans': ['AI'],
                'price': {'7 days': '$2400'},
                'rating': 4.5,
                'reviews': 7,
                'tourType': 'CRUISE',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({
                'startDate': '2025-01-04',
                'duration': '7 days',
                'mealPlan': 'BB',
                'tourType': 'RESORT'
            }),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(len(body['tours']), 1)
        self.assertEqual(body['tours'][0]['id'], 'tour-1')

    def test_filters_by_guest_capacity(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'name': 'Small Hike',
                'destination': 'Dolomites Mountains, Italy',
                'startDates': ['2025-01-15'],
                'durations': ['7 days'],
                'mealPlans': ['HB'],
                'price': {'7 days': '$1200'},
                'rating': 4.7,
                'reviews': 10,
                'tourType': 'HIKE',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 0, 'totalMaxValue': 2}
            },
            {
                'id': 'tour-2',
                'name': 'Family Resort',
                'destination': 'Punta Cana, Dominican Republic',
                'startDates': ['2025-01-20'],
                'durations': ['7 days'],
                'mealPlans': ['AI'],
                'price': {'7 days': '$2200'},
                'rating': 4.8,
                'reviews': 22,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 4, 'childrenMaxValue': 3, 'totalMaxValue': 6}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'adults': '2', 'children': '1'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(len(body['tours']), 1)
        self.assertEqual(body['tours'][0]['id'], 'tour-2')

    def test_sorts_by_price_ascending(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'name': 'Expensive Tour',
                'destination': 'Rome, Italy',
                'startDates': ['2025-01-01'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$3000'},
                'rating': 4.0,
                'reviews': 5,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            },
            {
                'id': 'tour-2',
                'name': 'Affordable Tour',
                'destination': 'Rome, Italy',
                'startDates': ['2025-01-01'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1000'},
                'rating': 4.5,
                'reviews': 15,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'sortBy': 'PRICE_ASC'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['tours'][0]['id'], 'tour-2')
        self.assertEqual(body['tours'][1]['id'], 'tour-1')

    def test_sorts_by_price_descending(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'name': 'Expensive Tour',
                'destination': 'Rome, Italy',
                'startDates': ['2025-01-01'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$3000'},
                'rating': 4.0,
                'reviews': 5,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            },
            {
                'id': 'tour-2',
                'name': 'Affordable Tour',
                'destination': 'Rome, Italy',
                'startDates': ['2025-01-01'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1000'},
                'rating': 4.5,
                'reviews': 15,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'sortBy': 'PRICE_DESC'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['tours'][0]['id'], 'tour-1')
        self.assertEqual(body['tours'][1]['id'], 'tour-2')

    def test_sorts_by_rating_descending(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'name': 'Lower Rated Tour',
                'destination': 'Rome, Italy',
                'startDates': ['2025-01-01'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1500'},
                'rating': 4.1,
                'reviews': 5,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            },
            {
                'id': 'tour-2',
                'name': 'Higher Rated Tour',
                'destination': 'Rome, Italy',
                'startDates': ['2025-01-01'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1400'},
                'rating': 4.9,
                'reviews': 15,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'sortBy': 'RATING_DESC'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['tours'][0]['id'], 'tour-2')
        self.assertEqual(body['tours'][1]['id'], 'tour-1')

    def test_sorts_by_rating_ascending(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'name': 'Lower Rated Tour',
                'destination': 'Rome, Italy',
                'startDates': ['2025-01-01'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1500'},
                'rating': 4.1,
                'reviews': 5,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            },
            {
                'id': 'tour-2',
                'name': 'Higher Rated Tour',
                'destination': 'Rome, Italy',
                'startDates': ['2025-01-01'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1400'},
                'rating': 4.9,
                'reviews': 15,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'sortBy': 'RATING_ASC'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['tours'][0]['id'], 'tour-1')
        self.assertEqual(body['tours'][1]['id'], 'tour-2')

    def test_paginates_results(self, mock_dynamodb_resource):
        items = []
        for index in range(7):
            items.append({
                'id': f'tour-{index}',
                'name': f'Tour {index}',
                'destination': 'Punta Cana, Dominican Republic',
                'startDates': ['2025-01-04'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': f'${1000 + index * 100}'},
                'rating': 5 - (index * 0.1),
                'reviews': index,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 4, 'childrenMaxValue': 2, 'totalMaxValue': 6}
            })
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'page': '2', 'pageSize': '3'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['page'], 2)
        self.assertEqual(body['pageSize'], 3)
        self.assertEqual(body['totalItems'], 7)
        self.assertEqual(body['totalPages'], 3)
        self.assertEqual(len(body['tours']), 3)

    def test_invalid_query_values_return_400(self, mock_dynamodb_resource):
        self._mock_scan_items(mock_dynamodb_resource, [])

        response = self.HANDLER.handle_request(
            self._event({
                'page': '0',
                'pageSize': '51',
                'startDate': '04-01-2025',
                'mealPlan': 'XYZ',
                'tourType': 'BOAT',
                'sortBy': 'UNKNOWN',
                'adults': '-1'
            }),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertIn('errors', body)
        self.assertIn('page', body['errors'])
        self.assertIn('pageSize', body['errors'])
        self.assertIn('startDate', body['errors'])
        self.assertIn('mealPlan', body['errors'])
        self.assertIn('tourType', body['errors'])
        self.assertIn('sortBy', body['errors'])
        self.assertIn('adults', body['errors'])

    def test_empty_result_returns_200_with_empty_array(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'name': 'Unavailable Tour',
                'destination': 'Punta Cana, Dominican Republic',
                'startDates': ['2025-01-04'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1400'},
                'rating': 4.9,
                'reviews': 19,
                'tourType': 'RESORT',
                'isAvailable': False,
                'guestQuantity': {'adultsMaxValue': 4, 'childrenMaxValue': 2, 'totalMaxValue': 6}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(self._event(), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['tours'], [])
        self.assertEqual(body['totalItems'], 0)
        self.assertEqual(body['totalPages'], 0)

    def test_filters_by_start_and_end_date_range(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-in-range',
                'name': 'Spring Escape',
                'destination': 'Rome, Italy',
                'startDates': ['2025-03-15'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1500'},
                'rating': 4.7,
                'reviews': 13,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 4, 'childrenMaxValue': 2, 'totalMaxValue': 6}
            },
            {
                'id': 'tour-out-range',
                'name': 'Late Summer Escape',
                'destination': 'Rome, Italy',
                'startDates': ['2025-07-10'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1600'},
                'rating': 4.6,
                'reviews': 11,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 4, 'childrenMaxValue': 2, 'totalMaxValue': 6}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'startDate': '2025-03-01', 'endDate': '2025-04-01'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(len(body['tours']), 1)
        self.assertEqual(body['tours'][0]['id'], 'tour-in-range')

    def test_filters_by_duration_range_notation(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'name': 'Weekend Break',
                'destination': 'Athens, Greece',
                'startDates': ['2025-03-10'],
                'durations': ['5 days'],
                'mealPlans': ['BB'],
                'price': {'5 days': '$900'},
                'rating': 4.1,
                'reviews': 8,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            },
            {
                'id': 'tour-2',
                'name': 'Classic Vacation',
                'destination': 'Athens, Greece',
                'startDates': ['2025-03-10'],
                'durations': ['10 days'],
                'mealPlans': ['HB'],
                'price': {'10 days': '$1900'},
                'rating': 4.8,
                'reviews': 32,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 4, 'childrenMaxValue': 2, 'totalMaxValue': 6}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'duration': '8-12 days'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(len(body['tours']), 1)
        self.assertEqual(body['tours'][0]['id'], 'tour-2')

    def test_filters_by_multiple_meal_plans(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-bb',
                'name': 'Budget City Tour',
                'destination': 'Paris, France',
                'startDates': ['2025-04-01'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1200'},
                'rating': 4.2,
                'reviews': 7,
                'tourType': 'CITY_TOUR',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 2, 'childrenMaxValue': 1, 'totalMaxValue': 3}
            },
            {
                'id': 'tour-ai',
                'name': 'All Inclusive Beach',
                'destination': 'Punta Cana, Dominican Republic',
                'startDates': ['2025-04-01'],
                'durations': ['7 days'],
                'mealPlans': ['AI'],
                'price': {'7 days': '$2500'},
                'rating': 4.9,
                'reviews': 45,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 4, 'childrenMaxValue': 2, 'totalMaxValue': 6}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'mealPlan': 'HB,AI'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(len(body['tours']), 1)
        self.assertEqual(body['tours'][0]['id'], 'tour-ai')

    def test_filters_by_multiple_tour_types(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-resort',
                'name': 'Resort Deluxe',
                'destination': 'Rome, Italy',
                'startDates': ['2025-05-01'],
                'durations': ['7 days'],
                'mealPlans': ['BB'],
                'price': {'7 days': '$1800'},
                'rating': 4.4,
                'reviews': 17,
                'tourType': 'RESORT',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 3, 'childrenMaxValue': 1, 'totalMaxValue': 4}
            },
            {
                'id': 'tour-hike',
                'name': 'Mountain Hike',
                'destination': 'Dolomites Mountains, Italy',
                'startDates': ['2025-05-01'],
                'durations': ['7 days'],
                'mealPlans': ['HB'],
                'price': {'7 days': '$1400'},
                'rating': 4.9,
                'reviews': 29,
                'tourType': 'HIKE',
                'isAvailable': True,
                'guestQuantity': {'adultsMaxValue': 6, 'childrenMaxValue': 0, 'totalMaxValue': 6}
            }
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(
            self._event({'tourType': 'CRUISE,HIKE'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(len(body['tours']), 1)
        self.assertEqual(body['tours'][0]['id'], 'tour-hike')

    def test_invalid_zero_total_guests_returns_400(self, mock_dynamodb_resource):
        self._mock_scan_items(mock_dynamodb_resource, [])

        response = self.HANDLER.handle_request(
            self._event({'adults': '0', 'children': '0'}),
            {}
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertIn('guests', body['errors'])


@patch('lambdas.api_handler.tour_search.dynamodb_resource')
class TestTourDestinations(ApiHandlerLambdaTestCase):

    def _mock_scan_items(self, mock_dynamodb_resource, items):
        mock_table = mock_dynamodb_resource.Table.return_value
        mock_table.scan.return_value = {'Items': items}
        return mock_table

    def _event(self, destination_query=None):
        query = {}
        if destination_query is not None:
            query['destination'] = destination_query
        return {
            'resource': '/tours/destinations',
            'httpMethod': 'GET',
            'queryStringParameters': query
        }

    def test_returns_unique_destination_suggestions(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'destination': 'Punta Cana, Dominican Republic',
                'isAvailable': True,
            },
            {
                'id': 'tour-2',
                'destination': 'punta cana, dominican republic',
                'isAvailable': True,
            },
            {
                'id': 'tour-3',
                'destination': 'Punta Arenas, Chile',
                'isAvailable': True,
            },
            {
                'id': 'tour-4',
                'destination': 'Punta del Este, Uruguay',
                'isAvailable': False,
            },
            {
                'id': 'tour-5',
                'destination': 'Athens, Greece',
                'isAvailable': True,
            },
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(self._event('punta'), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['destinations'], [
            'Punta Cana, Dominican Republic',
            'Punta Arenas, Chile',
        ])

    def test_short_destination_query_returns_400(self, mock_dynamodb_resource):
        self._mock_scan_items(mock_dynamodb_resource, [])

        response = self.HANDLER.handle_request(self._event('it'), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['message'], 'Validation failed')
        self.assertIn('destination', body['errors'])

    def test_no_matching_destinations_returns_empty_array(self, mock_dynamodb_resource):
        items = [
            {
                'id': 'tour-1',
                'destination': 'Athens, Greece',
                'isAvailable': True,
            },
            {
                'id': 'tour-2',
                'destination': 'Rome, Italy',
                'isAvailable': True,
            },
        ]
        self._mock_scan_items(mock_dynamodb_resource, items)

        response = self.HANDLER.handle_request(self._event('punta'), {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['destinations'], [])