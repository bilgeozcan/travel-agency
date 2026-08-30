import os

import boto3
from boto3.dynamodb.conditions import Key

from commons.api_response import build_response
from commons.log_helper import get_logger

_LOG = get_logger(__name__)

_dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('region', 'eu-west-3'))
TOUR_TABLE_NAME = os.environ.get('tour_table_name')
REVIEWS_TABLE_NAME = os.environ.get('reviews_table_name')

DEFAULT_REVIEW_PAGE = 1
DEFAULT_REVIEW_PAGE_SIZE = 4
MAX_REVIEW_PAGE_SIZE = 50
ALLOWED_REVIEW_SORT_OPTIONS = {'RATING_DESC', 'RATING_ASC', 'NEWEST', 'OLDEST'}


# ---------------------------------------------------------------------------
# GET /tours/{id}
# ---------------------------------------------------------------------------

def get_tour_details(event):
    path_params = event.get('pathParameters') or {}
    tour_id = (path_params.get('id') or '').strip()

    if not tour_id:
        return build_response(400, {'message': 'Tour id is required'})

    try:
        table = _dynamodb.Table(TOUR_TABLE_NAME)
        response = table.get_item(Key={'id': tour_id})
    except Exception as exc:
        _LOG.error(f'Error reading tour {tour_id}: {str(exc)}')
        return build_response(500, {'message': 'Internal server error'})

    item = response.get('Item')
    if not item:
        return build_response(404, {'message': 'Tour not found'})

    return build_response(200, _build_tour_details(item))


def _build_tour_details(item):
    """Maps a DynamoDB tour item onto the OAS TourDetailsDTO shape.

    Field names are projected onto the API shape here. We keep the legacy
    `accomodiation` key for backward compatibility, but normalize the guest
    capacity typo `totalMaxVelue` to `totalMaxValue` in responses.
    """
    guest_quantity = item.get('guestQuantity') or {}
    total_max_value = guest_quantity.get('totalMaxValue', guest_quantity.get('totalMaxValue'))
    image_urls = item.get('imageUrls') or []
    cover_image = image_urls[0] if image_urls else item.get('imageUrl')

    return {
        'id': item.get('id'),
        'name': item.get('name'),
        'destination': item.get('destination'),
        'rating': item.get('rating', 0),
        'imageUrl': cover_image,
        'imageUrls': image_urls,
        'summary': item.get('summary', ''),
        'freeCancelationDaysBefore': item.get('freeCancelationDaysBefore', 0),
        'durations': item.get('durations', []),
        'accomodiation': item.get('accomodiation', ''),
        'hotelName': item.get('hotelName'),
        'hotelDescription': item.get('hotelDescription'),
        'mealPlans': item.get('mealPlans', []),
        'customDetails': item.get('customDetails', {}),
        'startDates': item.get('startDates', []),
        'guestQuantity': {
            **guest_quantity,
            'totalMaxValue': total_max_value,
        },
        'price': item.get('price', {}),
        'mealSupplementsPerDay': item.get('mealSupplementsPerDay', {}),
        'tourType': item.get('tourType'),
    }


# ---------------------------------------------------------------------------
# GET /tours/{id}/reviews
# ---------------------------------------------------------------------------

def get_tour_reviews(event):
    path_params = event.get('pathParameters') or {}
    tour_id = (path_params.get('id') or '').strip()

    if not tour_id:
        return build_response(400, {'message': 'Tour id is required'})

    params = event.get('queryStringParameters') or {}
    filters, errors = _validate_review_params(params)
    if errors:
        return build_response(400, {'message': 'Validation failed', 'errors': errors})

    try:
        table = _dynamodb.Table(REVIEWS_TABLE_NAME)
        response = table.query(KeyConditionExpression=Key('id').eq(tour_id))
        items = response.get('Items', [])
    except Exception as exc:
        _LOG.error(f'Error reading reviews for tour {tour_id}: {str(exc)}')
        return build_response(500, {'message': 'Internal server error'})

    reviews = [_build_review_summary(item) for item in items]
    _sort_reviews(reviews, filters['sortBy'])

    total_items = len(reviews)
    if total_items == 0:
        return build_response(200, {
            'reviews': [],
            'page': filters['page'],
            'pageSize': filters['pageSize'],
            'totalPages': 0,
            'totalItems': 0,
        })

    start = (filters['page'] - 1) * filters['pageSize']
    end = start + filters['pageSize']
    total_pages = (total_items + filters['pageSize'] - 1) // filters['pageSize']

    return build_response(200, {
        'reviews': reviews[start:end],
        'page': filters['page'],
        'pageSize': filters['pageSize'],
        'totalPages': total_pages,
        'totalItems': total_items,
    })


def _validate_review_params(params):
    params = params or {}
    errors = {}

    normalized = {
        'page': DEFAULT_REVIEW_PAGE,
        'pageSize': DEFAULT_REVIEW_PAGE_SIZE,
        'sortBy': str(params.get('sortBy') or '').strip().upper() or 'RATING_DESC',
    }

    try:
        normalized['page'] = int(params.get('page', DEFAULT_REVIEW_PAGE))
        if normalized['page'] < 1:
            raise ValueError
    except (TypeError, ValueError):
        errors['page'] = 'page must be an integer greater than or equal to 1'

    try:
        normalized['pageSize'] = int(params.get('pageSize', DEFAULT_REVIEW_PAGE_SIZE))
        if not (1 <= normalized['pageSize'] <= MAX_REVIEW_PAGE_SIZE):
            raise ValueError
    except (TypeError, ValueError):
        errors['pageSize'] = f'pageSize must be between 1 and {MAX_REVIEW_PAGE_SIZE}'

    if normalized['sortBy'] not in ALLOWED_REVIEW_SORT_OPTIONS:
        errors['sortBy'] = 'sortBy must be one of RATING_DESC, RATING_ASC, NEWEST, OLDEST'

    return normalized, errors


def _build_review_summary(item):
    return {
        'authorName': item.get('authorName'),
        'authorImageUrl': item.get('authorImageUrl'),
        'createdAt': item.get('createdAt'),
        'rate': item.get('rate', 0),
        'reviewContent': item.get('reviewContent', ''),
    }


def _sort_reviews(reviews, sort_by):
    if sort_by.startswith('RATING'):
        reviews.sort(key=lambda review: float(review.get('rate', 0) or 0), reverse=sort_by.endswith('DESC'))
    else:  # NEWEST / OLDEST
        reviews.sort(key=lambda review: review.get('createdAt', ''), reverse=(sort_by == 'NEWEST'))