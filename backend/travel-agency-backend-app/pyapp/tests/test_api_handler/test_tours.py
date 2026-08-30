import json
from unittest.mock import patch
from decimal import Decimal

from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase


@patch('lambdas.api_handler.tours._dynamodb')
class TestTours(ApiHandlerLambdaTestCase):

    def _details_event(self, tour_id='tour-1'):
        return {
            'resource': '/tours/{id}',
            'httpMethod': 'GET',
            'pathParameters': {'id': tour_id},
        }

    def _reviews_event(self, tour_id='tour-1', query=None):
        return {
            'resource': '/tours/{id}/reviews',
            'httpMethod': 'GET',
            'pathParameters': {'id': tour_id},
            'queryStringParameters': query or {},
        }

    def test_get_tour_details_happy_path(self, mock_dynamodb):
        table = mock_dynamodb.Table.return_value
        table.get_item.return_value = {
            'Item': {
                'id': 'tour-1',
                'name': 'Garden Resort',
                'destination': 'Punta Cana',
                'rating': Decimal('4.8'),
                'accomodiation': 'Hotel',
                'guestQuantity': {'totalMaxValue': 6},
            }
        }

        response = self.HANDLER.handle_request(
            self._details_event(),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['id'], 'tour-1')
        self.assertEqual(body['accomodiation'], 'Hotel')
        self.assertEqual(body['rating'], 4.8)
        self.assertEqual(body['guestQuantity']['totalMaxValue'], 6)
        self.assertIn('Access-Control-Allow-Origin', response['headers'])

    def test_get_tour_details_not_found(self, mock_dynamodb):
        table = mock_dynamodb.Table.return_value
        table.get_item.return_value = {}

        response = self.HANDLER.handle_request(
            self._details_event(),
            {},
        )

        self.assertEqual(response['statusCode'], 404)
        self.assertIn('Access-Control-Allow-Origin', response['headers'])

    def test_get_tour_reviews_happy_path_and_sorting(self, mock_dynamodb):
        table = mock_dynamodb.Table.return_value
        table.query.return_value = {
            'Items': [
                {
                    'authorName': 'Alice',
                    'createdAt': '2025-01-03T00:00:00Z',
                    'rate': 3,
                    'reviewContent': 'ok',
                },
                {
                    'authorName': 'Bob',
                    'createdAt': '2025-01-02T00:00:00Z',
                    'rate': 5,
                    'reviewContent': 'great',
                },
            ]
        }

        response = self.HANDLER.handle_request(
            self._reviews_event(query={'sortBy': 'RATING_ASC', 'page': '1', 'pageSize': '4'}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['totalItems'], 2)
        self.assertEqual(body['reviews'][0]['authorName'], 'Alice')
        self.assertEqual(body['reviews'][1]['authorName'], 'Bob')
        self.assertIn('Access-Control-Allow-Origin', response['headers'])

    def test_get_tour_reviews_empty_result(self, mock_dynamodb):
        table = mock_dynamodb.Table.return_value
        table.query.return_value = {'Items': []}

        response = self.HANDLER.handle_request(
            self._reviews_event(),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['reviews'], [])
        self.assertEqual(body['totalPages'], 0)
        self.assertEqual(body['totalItems'], 0)

    def test_get_tour_reviews_invalid_sort_by(self, mock_dynamodb):
        response = self.HANDLER.handle_request(
            self._reviews_event(query={'sortBy': 'INVALID'}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertIn('sortBy', body['errors'])
        self.assertIn('Access-Control-Allow-Origin', response['headers'])

    def test_get_tour_reviews_invalid_page_size(self, mock_dynamodb):
        response = self.HANDLER.handle_request(
            self._reviews_event(query={'pageSize': '999'}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertIn('pageSize', body['errors'])
        self.assertIn('Access-Control-Allow-Origin', response['headers'])