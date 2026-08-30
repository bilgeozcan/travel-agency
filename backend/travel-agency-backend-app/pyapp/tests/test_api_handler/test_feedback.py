import os
# Set environment variables BEFORE any imports from lambdas
os.environ.setdefault('BOOKING_TOKEN_SECRET', 'test-secret-key-12345')
os.environ.setdefault('feedbacks_table', 'test-feedbacks')
os.environ.setdefault('bookings_table', 'test-bookings')
os.environ.setdefault('region', 'eu-west-3')

import json
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch, MagicMock
import unittest
import importlib
from pyapp.tests import ImportFromSourceContext

with ImportFromSourceContext():
    LAMBDA_HANDLER = importlib.import_module('lambdas.api_handler.handler')


class FeedbackHandlerTestCase(unittest.TestCase):
    """Test cases for feedback submission endpoint"""

    def setUp(self) -> None:
        self.HANDLER = LAMBDA_HANDLER.ApiHandler()

    def _feedback_event(self, tour_id='tour-1', booking_id='booking-1', body=None, authenticated_user=None):
        """Create a feedback submission event"""
        if body is None:
            body = {'rating': 5, 'comment': 'Great tour!'}
        
        event = {
            'resource': '/tours/{id}/feedbacks',
            'httpMethod': 'POST',
            'pathParameters': {'id': tour_id},
            'queryStringParameters': {'bookingId': booking_id},
            'body': json.dumps(body),
            'headers': {},
        }
        
        if authenticated_user:
            event['authenticatedUser'] = authenticated_user
        else:
            event['authenticatedUser'] = {
                'user_id': 'user-123',
                'sub': 'user-123',
                'role': 'CUSTOMER',
                'email': 'customer@example.com',
            }
        
        return event

    @staticmethod
    def _create_table_mock(bookings_table_mock, feedbacks_table_mock):
        """Create a side_effect function for Table() that returns appropriate table mocks"""
        # Track which table to return based on most recent call
        call_count = [0]
        
        def table_side_effect(table_name):
            # Use a simple pattern: alternate between bookings and feedbacks
            # First call (get_booking) returns bookings, second (check existing) returns feedbacks,
            # third (save) returns feedbacks
            call_count[0] += 1
            # Calls 2 and 3 are to feedbacks_table, call 1 is to bookings_table
            if call_count[0] in (2, 3):
                return feedbacks_table_mock
            return bookings_table_mock
        return table_side_effect

    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    def test_feedback_creation_happy_path_with_comment(self, mock_get_booking, mock_get_feedback):
        """Test successful feedback creation with comment for 4-5 star rating"""
        # Mock the booking retrieval
        mock_get_booking.return_value = ({
            'id': 'booking-1',
            'userId': 'user-123',
            'status': 'FINISHED',
            'tourId': 'tour-1',
        }, None)
        
        # Mock the feedback retrieval (no existing feedback)
        mock_get_feedback.return_value = (None, None)
        
        # Patch save_feedback to avoid actual DynamoDB calls
        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-new-id',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 5,
                'comment': 'Excellent experience!',
                'createdAt': '2026-08-14T16:00:00.000000',
                'updatedAt': '2026-08-14T16:00:00.000000',
            }, None)

            response = self.HANDLER.handle_request(
                self._feedback_event(
                    body={'rating': 5, 'comment': 'Excellent experience!'}
                ),
                {},
            )
        
        body = json.loads(response['body'])
        self.assertEqual(response['statusCode'], 201)
        self.assertEqual(body['rating'], 5)
        self.assertEqual(body['comment'], 'Excellent experience!')
        self.assertEqual(body['id'], 'feedback-new-id')

    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    def test_feedback_creation_without_comment_for_high_rating(self, mock_get_booking, mock_get_feedback):
        """Test feedback creation without comment for 4-5 star rating (optional)"""
        # Mock the booking retrieval
        mock_get_booking.return_value = ({
            'id': 'booking-1',
            'userId': 'user-123',
            'status': 'FINISHED',
            'tourId': 'tour-1',
        }, None)
        
        # Mock the feedback retrieval (no existing feedback)
        mock_get_feedback.return_value = (None, None)
        
        # Patch save_feedback to avoid actual DynamoDB calls
        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-new-id',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 4,
                'createdAt': '2026-08-14T16:00:00.000000',
                'updatedAt': '2026-08-14T16:00:00.000000',
            }, None)

            response = self.HANDLER.handle_request(
                self._feedback_event(body={'rating': 4}),
                {},
            )
        
        body = json.loads(response['body'])
        self.assertEqual(response['statusCode'], 201)
        self.assertEqual(body['rating'], 4)
        self.assertNotIn('comment', body)

    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    def test_feedback_update_when_exists(self, mock_get_booking, mock_get_feedback):
        """Test updating existing feedback via PUT returns 200 OK"""
        # Mock the booking retrieval
        mock_get_booking.return_value = ({
            'id': 'booking-1',
            'userId': 'user-123',
            'status': 'FINISHED',
            'tourId': 'tour-1',
        }, None)
        
        # Mock the feedback retrieval (existing feedback)
        mock_get_feedback.return_value = ({
            'id': 'feedback-existing',
            'bookingId': 'booking-1',
            'rating': 3,
            'comment': 'OK',
        }, None)
        
        # Patch save_feedback to avoid actual DynamoDB calls
        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-existing',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 5,
                'comment': 'Changed my mind, it was great!',
                'createdAt': '2026-08-14T16:00:00.000000',
                'updatedAt': '2026-08-14T16:00:00.000000',
            }, None)

            event = self._feedback_event(body={'rating': 5, 'comment': 'Changed my mind, it was great!'})
            event['httpMethod'] = 'PUT'
            response = self.HANDLER.handle_request(event, {})
        
        body = json.loads(response['body'])
        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['rating'], 5)
        self.assertEqual(body['comment'], 'Changed my mind, it was great!')

    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    def test_feedback_post_rejects_existing_feedback(self, mock_get_booking, mock_get_feedback):
        """Test POST cannot overwrite an existing feedback record."""
        mock_get_booking.return_value = ({
            'id': 'booking-1',
            'userId': 'user-123',
            'status': 'FINISHED',
            'tourId': 'tour-1',
        }, None)
        mock_get_feedback.return_value = ({
            'id': 'feedback-existing',
            'bookingId': 'booking-1',
        }, None)

        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            response = self.HANDLER.handle_request(
                self._feedback_event(body={'rating': 1, 'comment': 'Changed via POST'}),
                {},
            )

        body = json.loads(response['body'])
        self.assertEqual(response['statusCode'], 409)
        self.assertEqual(body['code'], 'FEEDBACK_ALREADY_EXISTS')
        mock_save.assert_not_called()

    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    def test_feedback_update_accepts_put(self, mock_get_booking, mock_get_feedback):
        """Test PUT routes to the feedback update handler."""
        mock_get_booking.return_value = ({
            'id': 'booking-1',
            'userId': 'user-123',
            'status': 'FINISHED',
            'tourId': 'tour-1',
        }, None)
        mock_get_feedback.return_value = ({
            'id': 'feedback-existing',
            'bookingId': 'booking-1',
        }, None)

        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-existing',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 4,
                'comment': 'Updated feedback',
                'createdAt': '2026-08-14T16:00:00.000000',
                'updatedAt': '2026-08-20T16:00:00.000000',
            }, None)

            event = self._feedback_event(body={'rating': 4, 'comment': 'Updated feedback'})
            event['httpMethod'] = 'PUT'
            response = self.HANDLER.handle_request(event, {})

        body = json.loads(response['body'])
        self.assertEqual(response['statusCode'], 200)
        self.assertEqual(body['id'], 'feedback-existing')

    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    def test_feedback_put_requires_existing_feedback(self, mock_get_booking, mock_get_feedback):
        """Test PUT does not create a new feedback record."""
        mock_get_booking.return_value = ({
            'id': 'booking-1',
            'userId': 'user-123',
            'status': 'FINISHED',
            'tourId': 'tour-1',
        }, None)
        mock_get_feedback.return_value = (None, None)

        event = self._feedback_event(body={'rating': 4, 'comment': 'Updated feedback'})
        event['httpMethod'] = 'PUT'
        response = self.HANDLER.handle_request(event, {})

        body = json.loads(response['body'])
        self.assertEqual(response['statusCode'], 404)
        self.assertEqual(body['code'], 'FEEDBACK_NOT_FOUND')

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_invalid_rating_below_1(self, mock_dynamodb):
        """Test feedback submission with rating below 1 is rejected"""
        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 0}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['code'], 'INVALID_RATING')

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_invalid_rating_above_5(self, mock_dynamodb):
        """Test feedback submission with rating above 5 is rejected"""
        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 6}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['code'], 'INVALID_RATING')

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_invalid_rating_non_numeric(self, mock_dynamodb):
        """Test feedback submission with non-numeric rating is rejected"""
        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 'five'}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['code'], 'INVALID_RATING')

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_missing_rating(self, mock_dynamodb):
        """Test feedback submission without rating is rejected"""
        response = self.HANDLER.handle_request(
            self._feedback_event(body={'comment': 'No rating provided'}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['code'], 'INVALID_RATING')

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_required_comment_for_1_star(self, mock_dynamodb):
        """Test comment is required for 1-star rating"""
        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 1}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['code'], 'INVALID_COMMENT')
        self.assertIn('required', body['message'].lower())

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_required_comment_for_3_star(self, mock_dynamodb):
        """Test comment is required for 3-star rating"""
        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 3}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['code'], 'INVALID_COMMENT')

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_empty_comment_for_low_rating(self, mock_dynamodb):
        """Test empty comment is rejected for low ratings"""
        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 2, 'comment': '   '}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['code'], 'INVALID_COMMENT')

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_comment_exceeds_500_chars(self, mock_dynamodb):
        """Test comment exceeding 500 characters is rejected"""
        long_comment = 'a' * 501
        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 5, 'comment': long_comment}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertEqual(body['code'], 'INVALID_COMMENT')
        self.assertIn('500', body['message'])

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_tour_not_started(self, mock_dynamodb):
        """Test feedback is rejected when tour is in BOOKED status"""
        bookings_table = MagicMock()
        bookings_table.get_item.return_value = {
            'Item': {
                'id': 'booking-1',
                'userId': 'user-123',
                'status': 'BOOKED',
                'tourId': 'tour-1',
            }
        }
        
        def table_side_effect(table_name):
            return bookings_table
        
        mock_dynamodb.Table.side_effect = table_side_effect

        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 5, 'comment': 'Good!'}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 403)
        self.assertEqual(body['code'], 'TOUR_NOT_AVAILABLE_FOR_FEEDBACK')

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_tour_confirmed(self, mock_dynamodb):
        """Test feedback is rejected when tour is in CONFIRMED status"""
        bookings_table = MagicMock()
        bookings_table.get_item.return_value = {
            'Item': {
                'id': 'booking-1',
                'userId': 'user-123',
                'status': 'CONFIRMED',
                'tourId': 'tour-1',
            }
        }
        
        def table_side_effect(table_name):
            return bookings_table
        
        mock_dynamodb.Table.side_effect = table_side_effect

        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 5, 'comment': 'Good!'}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 403)
        self.assertEqual(body['code'], 'TOUR_NOT_AVAILABLE_FOR_FEEDBACK')

    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    def test_feedback_tour_started_is_allowed(self, mock_get_booking, mock_get_feedback):
        """Test feedback is allowed when tour is in STARTED status"""
        # Mock the booking retrieval
        mock_get_booking.return_value = ({
            'id': 'booking-1',
            'userId': 'user-123',
            'status': 'STARTED',
            'tourId': 'tour-1',
        }, None)
        
        # Mock the feedback retrieval (no existing feedback)
        mock_get_feedback.return_value = (None, None)
        
        # Patch save_feedback to avoid actual DynamoDB calls
        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-new-id',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 5,
                'comment': 'Good!',
                'createdAt': '2026-08-14T16:00:00.000000',
                'updatedAt': '2026-08-14T16:00:00.000000',
            }, None)

            response = self.HANDLER.handle_request(
                self._feedback_event(body={'rating': 5, 'comment': 'Good!'}),
                {},
            )
        
        body = json.loads(response['body'])
        self.assertEqual(response['statusCode'], 201)
        self.assertEqual(body['rating'], 5)

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_user_not_booking_owner(self, mock_dynamodb):
        """Test feedback is rejected when user doesn't own the booking"""
        bookings_table = MagicMock()
        bookings_table.get_item.return_value = {
            'Item': {
                'id': 'booking-1',
                'userId': 'different-user',  # Different user
                'status': 'FINISHED',
                'tourId': 'tour-1',
            }
        }
        
        def table_side_effect(table_name):
            return bookings_table
        
        mock_dynamodb.Table.side_effect = table_side_effect

        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 5, 'comment': 'Good!'}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 403)
        self.assertEqual(body['code'], 'FORBIDDEN')

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_booking_not_found(self, mock_dynamodb):
        """Test feedback submission fails when booking doesn't exist"""
        bookings_table = MagicMock()
        bookings_table.get_item.return_value = {}  # Empty response = not found
        
        def table_side_effect(table_name):
            return bookings_table
        
        mock_dynamodb.Table.side_effect = table_side_effect

        response = self.HANDLER.handle_request(
            self._feedback_event(body={'rating': 5, 'comment': 'Good!'}),
            {},
        )
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 404)
        self.assertEqual(body['code'], 'BOOKING_NOT_FOUND')

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_missing_booking_id(self, mock_dynamodb):
        """Test feedback submission fails when bookingId is not provided"""
        event = self._feedback_event(body={'rating': 5, 'comment': 'Good!'})
        event['queryStringParameters'] = {}  # Empty query params

        response = self.HANDLER.handle_request(event, {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertIn('Booking ID', body['message'])

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_missing_tour_id(self, mock_dynamodb):
        """Test feedback submission fails when tourId is not provided in path"""
        event = self._feedback_event(body={'rating': 5, 'comment': 'Good!'})
        event['pathParameters'] = {}  # Empty path params

        response = self.HANDLER.handle_request(event, {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)
        self.assertIn('Tour ID', body['message'])

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_unauthenticated_user(self, mock_dynamodb):
        """Test feedback submission fails when user is not authenticated"""
        event = self._feedback_event(body={'rating': 5, 'comment': 'Good!'})
        event['authenticatedUser'] = None  # No authenticated user

        response = self.HANDLER.handle_request(event, {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 401)

    @patch('lambdas.api_handler.feedback.dynamodb')
    def test_feedback_invalid_json_body(self, mock_dynamodb):
        """Test feedback submission fails with invalid JSON"""
        event = self._feedback_event(body={'rating': 5, 'comment': 'Good!'})
        event['body'] = 'invalid json {{'

        response = self.HANDLER.handle_request(event, {})
        body = json.loads(response['body'])

        self.assertEqual(response['statusCode'], 400)


_REPORTS_QUEUE_URL = 'https://sqs.eu-west-3.amazonaws.com/364410974634/reports_queue'

_BOOKING_WITH_TA = {
    'id': 'booking-1',
    'userId': 'user-123',
    'status': 'FINISHED',
    'tourId': 'tour-1',
    'destination': 'Antalya, Turkey',
    'travelAgent': {'email': 'agent@travelco.com', 'userId': 'sub-1'},
}


class FeedbackReportsPublishTestCase(unittest.TestCase):
    """EPMTPETA-13790: publishing FEEDBACK_SUBMITTED / FEEDBACK_UPDATED to reports_queue."""

    def setUp(self) -> None:
        self.HANDLER = LAMBDA_HANDLER.ApiHandler()

    def _feedback_event(self, body=None):
        return {
            'resource': '/tours/{id}/feedbacks',
            'httpMethod': 'POST',
            'pathParameters': {'id': 'tour-1'},
            'queryStringParameters': {'bookingId': 'booking-1'},
            'body': json.dumps(body or {'rating': 5, 'comment': 'Great!'}),
            'headers': {},
            'authenticatedUser': {
                'user_id': 'user-123',
                'sub': 'user-123',
                'role': 'CUSTOMER',
                'email': 'customer@example.com',
            },
        }

    @patch('lambdas.api_handler.feedback.sqs')
    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    @patch('lambdas.api_handler.feedback.REPORTS_QUEUE_URL', _REPORTS_QUEUE_URL)
    def test_publishes_feedback_submitted_on_creation(
        self, mock_get_booking, mock_get_feedback, mock_sqs
    ):
        mock_get_booking.return_value = (_BOOKING_WITH_TA, None)
        mock_get_feedback.return_value = (None, None)

        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-new-id',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 5,
                'createdAt': '2026-08-25T00:00:00+00:00',
                'updatedAt': '2026-08-25T00:00:00+00:00',
            }, None)
            response = self.HANDLER.handle_request(
                self._feedback_event(body={'rating': 5, 'comment': 'Great!'}), {}
            )

        self.assertEqual(response['statusCode'], 201)
        mock_sqs.send_message.assert_called_once()
        call_kwargs = mock_sqs.send_message.call_args.kwargs
        self.assertEqual(call_kwargs['QueueUrl'], _REPORTS_QUEUE_URL)
        body = json.loads(call_kwargs['MessageBody'])
        self.assertEqual(body['messageId'], 'evt-booking-1-FEEDBACK_SUBMITTED')
        self.assertEqual(body['eventType'], 'FEEDBACK_SUBMITTED')
        self.assertEqual(body['bookingId'], 'booking-1')
        self.assertEqual(body['rating'], 5)
        self.assertEqual(
            body['travelAgent'],
            {'email': 'agent@travelco.com', 'userId': 'sub-1'},
        )
        self.assertEqual(body['destination'], 'Antalya, Turkey')
        self.assertNotIn('previousRating', body)

    @patch('lambdas.api_handler.feedback.sqs')
    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    @patch('lambdas.api_handler.feedback.REPORTS_QUEUE_URL', _REPORTS_QUEUE_URL)
    def test_publishes_feedback_updated_with_previous_rating(
        self, mock_get_booking, mock_get_feedback, mock_sqs
    ):
        mock_get_booking.return_value = (_BOOKING_WITH_TA, None)
        # A real DynamoDB read returns Decimal, not int -- json.dumps chokes
        # on Decimal, so this is the shape that actually caught the bug.
        mock_get_feedback.return_value = (
            {'id': 'feedback-existing', 'bookingId': 'booking-1', 'rating': Decimal(2)},
            None,
        )

        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-existing',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 5,
                'createdAt': '2026-08-25T00:00:00+00:00',
                'updatedAt': '2026-08-25T00:00:01+00:00',
            }, None)
            event = self._feedback_event(body={'rating': 5})
            event['httpMethod'] = 'PUT'
            response = self.HANDLER.handle_request(event, {})

        self.assertEqual(response['statusCode'], 200)
        call_kwargs = mock_sqs.send_message.call_args.kwargs
        body = json.loads(call_kwargs['MessageBody'])
        self.assertEqual(body['eventType'], 'FEEDBACK_UPDATED')
        self.assertEqual(body['rating'], 5)
        self.assertEqual(body['previousRating'], 2)
        self.assertTrue(
            body['messageId'].startswith('evt-booking-1-FEEDBACK_UPDATED-')
        )

    @patch('lambdas.api_handler.feedback.sqs')
    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    @patch('lambdas.api_handler.feedback.REPORTS_QUEUE_URL', _REPORTS_QUEUE_URL)
    def test_repeated_updates_get_distinct_message_ids(
        self, mock_get_booking, mock_get_feedback, mock_sqs
    ):
        """A fixed messageId across edits would make the Handler's
        idempotency guard silently drop every update after the first."""
        mock_get_booking.return_value = (_BOOKING_WITH_TA, None)
        mock_get_feedback.side_effect = [
            ({'id': 'feedback-existing', 'bookingId': 'booking-1', 'rating': Decimal(2)}, None),
            ({'id': 'feedback-existing', 'bookingId': 'booking-1', 'rating': Decimal(4)}, None),
        ]

        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-existing',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 4,
                'createdAt': '2026-08-25T00:00:00+00:00',
                'updatedAt': '2026-08-25T00:00:01+00:00',
            }, None)
            event = self._feedback_event(body={'rating': 4})
            event['httpMethod'] = 'PUT'
            self.HANDLER.handle_request(event, {})
            self.HANDLER.handle_request(event, {})

        ids = [
            json.loads(call.kwargs['MessageBody'])['messageId']
            for call in mock_sqs.send_message.call_args_list
        ]
        self.assertEqual(len(ids), 2)
        self.assertNotEqual(ids[0], ids[1])

    @patch('lambdas.api_handler.feedback.sqs')
    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    @patch('lambdas.api_handler.feedback.REPORTS_QUEUE_URL', None)
    def test_publish_skipped_when_queue_url_not_configured(
        self, mock_get_booking, mock_get_feedback, mock_sqs
    ):
        mock_get_booking.return_value = (_BOOKING_WITH_TA, None)
        mock_get_feedback.return_value = (None, None)

        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-new-id',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 5,
                'createdAt': '2026-08-25T00:00:00+00:00',
                'updatedAt': '2026-08-25T00:00:00+00:00',
            }, None)
            response = self.HANDLER.handle_request(self._feedback_event(), {})

        self.assertEqual(response['statusCode'], 201)
        mock_sqs.send_message.assert_not_called()

    @patch('lambdas.api_handler.feedback.sqs')
    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    @patch('lambdas.api_handler.feedback.REPORTS_QUEUE_URL', _REPORTS_QUEUE_URL)
    def test_publish_failure_does_not_fail_the_response(
        self, mock_get_booking, mock_get_feedback, mock_sqs
    ):
        mock_get_booking.return_value = (_BOOKING_WITH_TA, None)
        mock_get_feedback.return_value = (None, None)
        mock_sqs.send_message.side_effect = Exception('SQS is down')

        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-new-id',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 5,
                'createdAt': '2026-08-25T00:00:00+00:00',
                'updatedAt': '2026-08-25T00:00:00+00:00',
            }, None)
            response = self.HANDLER.handle_request(self._feedback_event(), {})

        self.assertEqual(response['statusCode'], 201)

    @patch('lambdas.api_handler.feedback.sqs')
    @patch('lambdas.api_handler.feedback._get_feedback_by_booking')
    @patch('lambdas.api_handler.feedback._get_booking_by_id')
    @patch('lambdas.api_handler.feedback.REPORTS_QUEUE_URL', _REPORTS_QUEUE_URL)
    def test_publish_skipped_when_travel_agent_missing(
        self, mock_get_booking, mock_get_feedback, mock_sqs
    ):
        mock_get_booking.return_value = ({
            'id': 'booking-1',
            'userId': 'user-123',
            'status': 'FINISHED',
            'tourId': 'tour-1',
        }, None)
        mock_get_feedback.return_value = (None, None)

        with patch('lambdas.api_handler.feedback._save_feedback') as mock_save:
            mock_save.return_value = ({
                'id': 'feedback-new-id',
                'bookingId': 'booking-1',
                'tourId': 'tour-1',
                'rating': 5,
                'createdAt': '2026-08-25T00:00:00+00:00',
                'updatedAt': '2026-08-25T00:00:00+00:00',
            }, None)
            response = self.HANDLER.handle_request(self._feedback_event(), {})

        self.assertEqual(response['statusCode'], 201)
        mock_sqs.send_message.assert_not_called()


class FeedbackReportsPublishConfigTestCase(unittest.TestCase):
    """EPMTPETA-13790: reports_queue wired into api_handler's own config."""

    def test_reports_queue_wired_into_api_handler(self):
        project_root = Path(__file__).resolve().parents[3]
        root_resources = json.loads(
            (project_root / 'deployment_resources.json').read_text()
        )
        lambda_config = json.loads(
            (
                project_root
                / 'pyapp' / 'src' / 'lambdas' / 'api_handler' / 'lambda_config.json'
            ).read_text()
        )

        statement = root_resources['lambda-basic-execution']['policy_content']['Statement'][0]
        self.assertIn('sqs:SendMessage', statement['Action'])

        self.assertIn(
            {'resource_name': '${reports_queue}', 'resource_type': 'sqs_queue'},
            lambda_config['dependencies'],
        )
        self.assertIn('reports_queue_url', lambda_config['env_variables'])


if __name__ == '__main__':
    unittest.main()
