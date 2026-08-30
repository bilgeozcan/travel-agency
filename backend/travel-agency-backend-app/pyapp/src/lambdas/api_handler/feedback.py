from uuid import uuid4
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError

from commons.api_response import build_response
from commons.log_helper import get_logger

_LOG = get_logger(__name__)
REGION = os.environ.get('region', 'eu-west-3')
BOOKINGS_TABLE = os.environ.get('bookings_table')
FEEDBACKS_TABLE = os.environ.get('feedbacks_table')
REPORTS_QUEUE_URL = os.environ.get('reports_queue_url')

dynamodb = boto3.resource('dynamodb', region_name=REGION)
sqs = boto3.client('sqs', region_name=REGION)


def _authenticated_principal(event):
    """Return a normalized principal from authenticated user context."""
    principal = event.get('authenticatedUser') if isinstance(event, dict) else None
    if isinstance(principal, dict):
        return principal
    if isinstance(principal, str) and principal.strip():
        user_id = principal.strip()
        return {
            'sub': user_id,
            'user_id': user_id,
            'role': 'CUSTOMER',
        }
    return {}


def _principal_user_id(principal):
    """Extract user ID from principal object."""
    value = principal.get('user_id') or principal.get('sub')
    return str(value).strip() if value is not None else ''


def _invalid_rating_response(event):
    """Return 400 response for invalid rating."""
    return build_response(
        400,
        {
            'code': 'INVALID_RATING',
            'message': 'Rating must be an integer between 1 and 5',
        },
        event=event,
    )


def _invalid_comment_response(event, reason):
    """Return 400 response for invalid comment."""
    return build_response(
        400,
        {
            'code': 'INVALID_COMMENT',
            'message': reason,
        },
        event=event,
    )


def _tour_not_available_response(event):
    """Return 403 response when tour is not in valid status for feedback."""
    return build_response(
        403,
        {
            'code': 'TOUR_NOT_AVAILABLE_FOR_FEEDBACK',
            'message': 'Feedback can only be provided for tours with "STARTED" or "FINISHED" status',
        },
        event=event,
    )


def _forbidden_response(event):
    """Return 403 response for unauthorized access."""
    return build_response(
        403,
        {
            'code': 'FORBIDDEN',
            'message': 'You are not allowed to provide feedback for this tour',
        },
        event=event,
    )


def _booking_not_found_response(event):
    """Return 404 response for missing booking."""
    return build_response(
        404,
        {
            'code': 'BOOKING_NOT_FOUND',
            'message': 'Booking not found',
        },
        event=event,
    )


def _feedback_not_found_response(event):
    """Return 404 response when PUT targets missing feedback."""
    return build_response(
        404,
        {
            'code': 'FEEDBACK_NOT_FOUND',
            'message': 'Feedback not found',
        },
        event=event,
    )


def _feedback_already_exists_response(event):
    """Return 409 response when POST targets an existing feedback."""
    return build_response(
        409,
        {
            'code': 'FEEDBACK_ALREADY_EXISTS',
            'message': 'Feedback already exists; use PUT to update it',
        },
        event=event,
    )


def _internal_error_response(event, error_msg='Internal server error'):
    """Return 500 response for server errors."""
    return build_response(
        500,
        {
            'code': 'INTERNAL_ERROR',
            'message': error_msg,
        },
        event=event,
    )


def _validate_rating(rating):
    """Validate rating is an integer between 1 and 5. Returns (valid, value)."""
    if rating is None:
        return False, None
    
    try:
        rating_int = int(rating)
        if 1 <= rating_int <= 5:
            return True, rating_int
    except (ValueError, TypeError):
        pass
    
    return False, None


def _validate_comment(rating, comment):
    """Validate comment based on rating. Returns (valid, error_reason)."""
    # For ratings 1-3, comment is required
    if rating <= 3:
        if comment is None or (isinstance(comment, str) and not comment.strip()):
            return False, 'Comment is required for ratings 1-3'
        if not isinstance(comment, str):
            return False, 'Comment must be a string'
        if len(comment) > 500:
            return False, 'Comment must not exceed 500 characters'
        return True, None
    
    # For ratings 4-5, comment is optional but if provided must be valid
    if comment is not None:
        if not isinstance(comment, str):
            return False, 'Comment must be a string'
        if len(comment) > 500:
            return False, 'Comment must not exceed 500 characters'
    
    return True, None


def _parse_body(event):
    """Parse and validate request body. Returns (body_dict, error_response) tuple."""
    try:
        body_str = event.get('body', '{}')
        if isinstance(body_str, dict):
            body = body_str
        else:
            body = json.loads(body_str or '{}')
    except (json.JSONDecodeError, ValueError):
        return None, build_response(400, {'message': 'Invalid JSON body'}, event=event)
    
    if not isinstance(body, dict):
        return None, build_response(400, {'message': 'Request body must be a JSON object'}, event=event)
    
    return body, None


def _get_booking_by_id(booking_id):
    """Fetch booking from DynamoDB. Returns (booking, error) tuple."""
    try:
        table = dynamodb.Table(BOOKINGS_TABLE)
        response = table.get_item(Key={'id': booking_id})
        booking = response.get('Item')
        return booking, None
    except ClientError as exc:
        error_msg = f'Error fetching booking {booking_id}: {str(exc)}'
        _LOG.error(error_msg)
        return None, error_msg
    except Exception as exc:
        error_msg = f'Unexpected error fetching booking {booking_id}: {str(exc)}'
        _LOG.error(error_msg)
        return None, error_msg


def _get_feedback_by_booking(booking_id):
    """Fetch existing feedback for a booking. Returns (feedback, error) tuple."""
    try:
        table = dynamodb.Table(FEEDBACKS_TABLE)
        response = table.query(
            KeyConditionExpression='bookingId = :booking_id',
            ExpressionAttributeValues={':booking_id': booking_id},
            Limit=1
        )
        items = response.get('Items', [])
        feedback = items[0] if items else None
        return feedback, None
    except ClientError as exc:
        error_msg = f'Error fetching feedback for booking {booking_id}: {str(exc)}'
        _LOG.error(error_msg)
        return None, error_msg
    except Exception as exc:
        error_msg = f'Unexpected error fetching feedback for booking {booking_id}: {str(exc)}'
        _LOG.error(error_msg)
        return None, error_msg


def _save_feedback(feedback_id, booking_id, tour_id, user_id, rating, comment):
    """Save or update feedback in DynamoDB. Returns (feedback, error) tuple."""
    try:
        table = dynamodb.Table(FEEDBACKS_TABLE)
        
        feedback_item = {
            'id': feedback_id,
            'bookingId': booking_id,
            'tourId': tour_id,
            'userId': user_id,
            'rating': rating,
            'createdAt': datetime.utcnow().isoformat(),
        }
        
        # Only include comment if provided
        if comment is not None and isinstance(comment, str):
            feedback_item['comment'] = comment.strip()
        
        # Add updatedAt for future updates
        feedback_item['updatedAt'] = feedback_item['createdAt']
        
        table.put_item(Item=feedback_item)
        # Return as plain dict to avoid any mock issues
        return dict(feedback_item), None
    except ClientError as exc:
        error_msg = f'Error saving feedback: {str(exc)}'
        _LOG.error(error_msg)
        return None, error_msg
    except Exception as exc:
        error_msg = f'Unexpected error saving feedback: {str(exc)}'
        _LOG.error(error_msg)
        return None, error_msg


def _period_for(dt):
    """ISO week start (Monday), YYYY-MM-DD -- matches reports_handler's 'period'."""
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime("%Y-%m-%d")


def _publish_feedback_event(event_type, booking, booking_id, rating, previous_rating=None):
    """Publish FEEDBACK_SUBMITTED / FEEDBACK_UPDATED for reports_handler (EPMTPETA-12598).

    Never raises: the feedback write has already committed by the time this
    is called, and a broken publish must not turn a successful
    create/update response into an error.
    """
    if not REPORTS_QUEUE_URL:
        _LOG.warning(
            'reports_queue_url is not configured, skipping %s publish for booking %s',
            event_type, booking_id,
        )
        return

    travel_agent = booking.get('travelAgent') or {}
    agent_email = travel_agent.get('email') if isinstance(travel_agent, dict) else None
    destination = booking.get('destination')

    if not agent_email or not destination:
        _LOG.warning(
            'Booking %s is missing travelAgent.email/destination, skipping %s publish',
            booking_id, event_type,
        )
        return

    now = datetime.now(timezone.utc)
    occurred_at = now.isoformat()

    if event_type == 'FEEDBACK_SUBMITTED':
        message_id = f'evt-{booking_id}-FEEDBACK_SUBMITTED'
    else:
        # Unlike BOOKING_FINISHED/FEEDBACK_SUBMITTED (each can only happen
        # once per booking), a feedback can be edited more than once. A
        # fixed message id would make the Handler's idempotency guard
        # silently drop every update after the first.
        message_id = f'evt-{booking_id}-FEEDBACK_UPDATED-{occurred_at}-{uuid4()}'

    message = {
        'messageId': message_id,
        'eventType': event_type,
        'period': _period_for(now),
        'bookingId': booking_id,
        'travelAgent': {
            'email': agent_email,
            'userId': travel_agent.get('userId'),
        },
        'destination': destination,
        'rating': rating,
        'occurredAt': occurred_at,
    }
    if event_type == 'FEEDBACK_UPDATED':
        # previous_rating comes straight from a DynamoDB item (a Decimal),
        # which json.dumps cannot serialize -- cast to a plain int.
        message['previousRating'] = (
            int(previous_rating) if previous_rating is not None else None
        )

    try:
        sqs.send_message(
            QueueUrl=REPORTS_QUEUE_URL,
            MessageBody=json.dumps(message),
        )
    except Exception:
        _LOG.exception(
            'Failed to publish %s for booking %s', event_type, booking_id,
        )


def handle_feedback_submission(event):
    """
    POST /tours/{id}/feedbacks creates feedback.
    PUT /tours/{id}/feedbacks updates existing feedback.
    
    Submits customer feedback for a tour, or updates it when the request method is PUT.
    Feedback can only be submitted for tours with 'STARTED' or 'FINISHED' status.
    Each booking can have at most one feedback entry.
    
    Request body:
    {
        "rating": 1-5 (required),
        "comment": "text" (required for 1-3 stars, optional for 4-5, max 500 chars)
    }
    
    Response:
    - 201 Created: feedback successfully created
    - 200 OK: feedback successfully updated via PUT
    - 409 Conflict: feedback already exists for POST
    - 400 Bad Request: validation error
    - 403 Forbidden: tour not in valid status or user not authorized
    - 404 Not Found: booking not found
    - 500 Internal Server Error: database error
    """
    
    # Parse path parameters to get tour ID
    path_params = event.get('pathParameters') or {}
    tour_id = (path_params.get('id') or '').strip()
    
    if not tour_id:
        return build_response(400, {'message': 'Tour ID is required'}, event=event)
    
    # Parse and validate request body
    body, error_response = _parse_body(event)
    if error_response:
        return error_response
    
    # Extract and validate rating
    rating_valid, rating = _validate_rating(body.get('rating'))
    if not rating_valid:
        return _invalid_rating_response(event)
    
    # Extract comment
    comment = body.get('comment')
    
    # Validate comment based on rating
    comment_valid, comment_error = _validate_comment(rating, comment)
    if not comment_valid:
        return _invalid_comment_response(event, comment_error)
    
    # Get authenticated user
    principal = _authenticated_principal(event)
    user_id = _principal_user_id(principal)
    
    if not user_id:
        return build_response(401, {'message': 'Unauthorized'}, event=event)
    
    # Extract booking ID from query parameters
    query_params = event.get('queryStringParameters') or {}
    booking_id = (query_params.get('bookingId') or '').strip()
    
    if not booking_id:
        return build_response(400, {'message': 'Booking ID is required'}, event=event)
    
    # Fetch booking
    booking, booking_error = _get_booking_by_id(booking_id)
    if booking_error:
        return _internal_error_response(event)
    
    if not booking:
        return _booking_not_found_response(event)
    
    # Verify user owns the booking
    booking_user_id = booking.get('userId')
    if not booking_user_id or str(booking_user_id).strip() != user_id:
        return _forbidden_response(event)
    
    # Verify tour status is STARTED or FINISHED
    tour_status = (booking.get('status') or booking.get('state') or '').strip().upper()
    if tour_status not in ('STARTED', 'FINISHED'):
        return _tour_not_available_response(event)
    
    # Check if feedback already exists
    existing_feedback, feedback_error = _get_feedback_by_booking(booking_id)
    if feedback_error:
        return _internal_error_response(event)
    
    # Determine if this is create (201) or update (200)
    is_update = existing_feedback is not None
    if event.get('httpMethod') == 'POST' and is_update:
        return _feedback_already_exists_response(event)

    if event.get('httpMethod') == 'PUT' and not is_update:
        return _feedback_not_found_response(event)

    feedback_id = existing_feedback.get('id') if is_update else str(uuid.uuid4())
    previous_rating = existing_feedback.get('rating') if is_update else None

    # Save feedback
    feedback, save_error = _save_feedback(feedback_id, booking_id, tour_id, user_id, rating, comment)
    if save_error:
        return _internal_error_response(event)

    # Publish to reports_queue for EPMTPETA-12598's Handler. Never blocks or
    # fails the response -- see _publish_feedback_event's own guards.
    _publish_feedback_event(
        'FEEDBACK_UPDATED' if is_update else 'FEEDBACK_SUBMITTED',
        booking,
        booking_id,
        rating,
        previous_rating=previous_rating,
    )

    # Prepare response
    status_code = 200 if is_update else 201
    response_body = {
        'id': feedback.get('id'),
        'bookingId': feedback.get('bookingId'),
        'tourId': feedback.get('tourId'),
        'rating': feedback.get('rating'),
        'createdAt': feedback.get('createdAt'),
        'updatedAt': feedback.get('updatedAt'),
    }
    
    # Include comment in response if present
    if 'comment' in feedback:
        response_body['comment'] = feedback['comment']
    
    return build_response(status_code, response_body, event=event)


