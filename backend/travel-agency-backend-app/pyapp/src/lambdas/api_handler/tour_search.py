import os
import re

import boto3

from commons.log_helper import get_logger
from commons.number_utils import to_number as _to_number
from commons.request_helpers import (
    _response,
    _bad_request,
    _parse_positive_int,
    _parse_non_negative_int,
    _parse_date,
    _normalize_str,
)

_LOG = get_logger(__name__)

dynamodb_resource = boto3.resource('dynamodb', region_name=os.environ.get('region', 'eu-west-3'))
TOUR_TABLE_NAME = os.environ.get('tour_table_name')

MAX_PAGE_SIZE = 50
DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 6

ALLOWED_MEAL_PLANS = {'BB', 'HB', 'FB', 'AI'}
ALLOWED_TOUR_TYPES = {'RESORT', 'CRUISE', 'HIKE'}
ALLOWED_SORT_OPTIONS = {'RATING_DESC', 'RATING_ASC', 'PRICE_DESC', 'PRICE_ASC'}


def _scan_all_items(table):
    items = []
    scan_kwargs = {}
    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get('Items', []))
        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            break
        scan_kwargs['ExclusiveStartKey'] = last_key
    return items


def _build_tour_summary(item):
    durations = item.get('durations') or []
    meal_plans = item.get('mealPlans') or []
    start_dates = item.get('startDates') or []
    price_map = item.get('price') or {}
    free_cancelation = item.get('freeCancelation')

    min_price = min((_to_number(price) for price in price_map.values()), default=0.0)
    price_value = item.get('priceLabel') or f'from ${int(min_price)} for 1 person'

    capacity = item.get('guestQuantity') or {}
    adults_max = int(capacity.get('adultsMaxValue', 0))
    children_max = int(capacity.get('childrenMaxValue', 0))
    total_max = int(capacity.get('totalMaxValue', capacity.get('totalMaxValue', adults_max + children_max)))
    image_urls = item.get('imageUrls') or []
    cover_image = image_urls[0] if image_urls else item.get('imageUrl')

    return {
        'id': item.get('id'),
        'name': item.get('name'),
        'destination': item.get('destination'),
        'imageUrl': cover_image,
        'imageUrls': image_urls,
        'startDate': start_dates[0] if start_dates else None,
        'durations': durations,
        'mealPlans': meal_plans,
        'price': price_value,
        'currency': item.get('currency', 'USD'),
        'availability': {
            'isAvailable': True,
            'adultsMaxValue': adults_max,
            'childrenMaxValue': children_max,
            'totalMaxValue': total_max
        },
        'rating': float(item.get('rating', 0)),
        'reviews': int(item.get('reviews', 0)),
        'freeCancelation': free_cancelation,
        'tourType': item.get('tourType'),
    }


def _validate_tour_search_params(params):
    params = params or {}
    errors = {}

    meal_plan_raw = _normalize_str(params.get('mealPlan')).upper()
    meal_plans = [m.strip() for m in meal_plan_raw.split(',') if m.strip()] if meal_plan_raw else []

    tour_type_raw = _normalize_str(params.get('tourType')).upper()
    tour_types = [t.strip() for t in tour_type_raw.split(',') if t.strip()] if tour_type_raw else []

    normalized = {
        'page': DEFAULT_PAGE,
        'pageSize': DEFAULT_PAGE_SIZE,
        'destination': _normalize_str(params.get('destination')),
        'startDate': _normalize_str(params.get('startDate')),
        'endDate': _normalize_str(params.get('endDate')),
        'duration': _normalize_str(params.get('duration')),
        'mealPlan': meal_plans,
        'tourType': tour_types,
        'sortBy': _normalize_str(params.get('sortBy')).upper() or 'RATING_DESC',
        'adults': 1,
        'children': 0
    }

    try:
        normalized['page'] = _parse_positive_int(params.get('page', DEFAULT_PAGE), 'page', minimum=1)
    except ValueError as exc:
        errors['page'] = str(exc)

    try:
        normalized['pageSize'] = _parse_positive_int(
            params.get('pageSize', DEFAULT_PAGE_SIZE),
            'pageSize',
            minimum=1,
            maximum=MAX_PAGE_SIZE
        )
    except ValueError as exc:
        errors['pageSize'] = str(exc)

    try:
        normalized['adults'] = _parse_non_negative_int(params.get('adults', 1), 'adults')
    except ValueError as exc:
        errors['adults'] = str(exc)

    try:
        normalized['children'] = _parse_non_negative_int(params.get('children', 0), 'children')
    except ValueError as exc:
        errors['children'] = str(exc)

    if normalized['adults'] + normalized['children'] <= 0:
        errors['guests'] = 'At least one guest is required'

    if normalized['startDate']:
        try:
            _parse_date(normalized['startDate'], 'startDate')
        except ValueError as exc:
            errors['startDate'] = str(exc)

    if normalized['endDate']:
        try:
            _parse_date(normalized['endDate'], 'endDate')
        except ValueError as exc:
            errors['endDate'] = str(exc)

    invalid_meal_plans = [m for m in normalized['mealPlan'] if m not in ALLOWED_MEAL_PLANS]
    if invalid_meal_plans:
        errors['mealPlan'] = f"mealPlan elements must be one of {', '.join(ALLOWED_MEAL_PLANS)}"

    invalid_tour_types = [t for t in normalized['tourType'] if t not in ALLOWED_TOUR_TYPES]
    if invalid_tour_types:
        errors['tourType'] = f"tourType elements must be one of {', '.join(ALLOWED_TOUR_TYPES)}"

    if normalized['sortBy'] not in ALLOWED_SORT_OPTIONS:
        errors['sortBy'] = 'sortBy must be one of RATING_DESC, RATING_ASC, PRICE_DESC, PRICE_ASC'

    return normalized, errors


def _parse_duration_days(duration_str: str) -> int:
    """'7 days', '10 days' or '8-12' are strings from which only the numerical day value is extracted."""
    match = re.search(r'(\d+)', str(duration_str))
    return int(match.group(1)) if match else 0


def _matches_duration_filter(requested_duration: str, item_durations: list) -> bool:
    """
    Compares the exact ('7 days'), range ('8-12 days'), or open-ended ('12+ days')
    duration parameters coming from the frontend with the duration list in the database.
    """
    if not requested_duration:
        return True

    # Convert the durations from the database to numbers (e.g., ['7 days', '10 days'] -> [7, 10])
    tour_days = [_parse_duration_days(d) for d in item_durations]
    req = requested_duration.strip().lower()

    #1. Condition: Open-ended range (e.g., "12+ days" or "12+")
    if '+' in req:
        min_days = _parse_duration_days(req)
        return any(d >= min_days for d in tour_days)

    # 2. Case: A specific range (e.g., "8-12 days" or "8-12")
    if '-' in req:
        parts = req.split('-')
        if len(parts) == 2:
            min_days = _parse_duration_days(parts[0])
            max_days = _parse_duration_days(parts[1])
            return any(min_days <= d <= max_days for d in tour_days)

    # Case 3: One-to-one string match fallback (e.g., "7 days")
    if requested_duration in item_durations:
        return True

    # 4. Case: Numerical one-to-one match (e.g., Request "7", DB "7 days")
    req_days = _parse_duration_days(req)
    if req_days > 0:
        return any(d == req_days for d in tour_days)

    return False

def _matches_filters(item, filters):
    if not item.get('isAvailable', False):
        return False

    destination = str(item.get('destination', ''))
    if filters['destination'] and filters['destination'].lower() not in destination.lower():
        return False

    start_dates = item.get('startDates') or []
    if filters['startDate'] or filters.get('endDate'):
        start_bound = filters['startDate'] or '0000-01-01'
        end_bound = filters.get('endDate') or '9999-12-31'

        has_matching_date = any(start_bound <= d <= end_bound for d in start_dates)
        if not has_matching_date:
            return False

    if filters['duration']:
        durations = item.get('durations') or []
        if not _matches_duration_filter(filters['duration'], durations):
            return False

    if filters['mealPlan']:
        item_meal_plans = [str(m).upper() for m in (item.get('mealPlans') or [])]
        if not any(mp in item_meal_plans or any(mp in imp for imp in item_meal_plans) for mp in filters['mealPlan']):
            return False

    if filters['tourType']:
        item_tour_type = str(item.get('tourType', '')).upper()
        if item_tour_type not in filters['tourType']:
            return False

    capacity = item.get('guestQuantity') or {}
    adults_max = int(capacity.get('adultsMaxValue', 0))
    children_max = int(capacity.get('childrenMaxValue', 0))
    total_max = int(capacity.get('totalMaxValue', capacity.get('totalMaxValue', adults_max + children_max)))

    requested_adults = filters['adults']
    requested_children = filters['children']
    requested_total = requested_adults + requested_children

    if requested_adults > adults_max:
        return False
    if requested_children > children_max:
        return False
    if requested_total > total_max:
        return False

    return True

def _sort_tours(tours, sort_by):
    reverse = sort_by.endswith('DESC')

    if sort_by.startswith('RATING'):
        tours.sort(key=lambda tour: float(tour.get('rating', 0)), reverse=reverse)
        return

    tours.sort(key=lambda tour: _to_number(tour.get('price')), reverse=reverse)


def get_available_tours(event):
    params = event.get('queryStringParameters') or {}
    filters, errors = _validate_tour_search_params(params)
    if errors:
        return _response(400, {'message': 'Validation failed', 'errors': errors}, event)

    try:
        table = dynamodb_resource.Table(TOUR_TABLE_NAME)
        items = _scan_all_items(table)
    except Exception as exc:
        _LOG.error(f'Error reading tours table: {str(exc)}')
        return _response(500, {'message': 'Internal server error'}, event)

    tours = []
    for item in items:
        if _matches_filters(item, filters):
            tours.append(_build_tour_summary(item))

    _sort_tours(tours, filters['sortBy'])

    total_items = len(tours)
    if total_items == 0:
        return _response(200, {
            'tours': [],
            'page': filters['page'],
            'pageSize': filters['pageSize'],
            'totalPages': 0,
            'totalItems': 0
        }, event)

    start_index = (filters['page'] - 1) * filters['pageSize']
    end_index = start_index + filters['pageSize']
    total_pages = (total_items + filters['pageSize'] - 1) // filters['pageSize']

    return _response(200, {
        'tours': tours[start_index:end_index],
        'page': filters['page'],
        'pageSize': filters['pageSize'],
        'totalPages': total_pages,
        'totalItems': total_items
    }, event)


def get_tour_destinations(event):
    params = event.get('queryStringParameters') or {}
    destination_query = _normalize_str(params.get('destination'))

    if len(destination_query) < 3:
        return _bad_request(
            message='Validation failed',
            errors={'destination': 'destination must be at least 3 characters long'}
        )

    query_lower = destination_query.lower()

    try:
        table = dynamodb_resource.Table(TOUR_TABLE_NAME)
        items = _scan_all_items(table)
    except Exception as exc:
        _LOG.error('Error reading destinations from tours table: %s', str(exc))
        return _response(500, {'message': 'Internal server error'})

    destinations = []
    seen = set()

    for item in items:
        if not item.get('isAvailable', False):
            continue

        destination = _normalize_str(item.get('destination'))
        if not destination:
            continue

        normalized_destination = destination.lower()
        if query_lower in normalized_destination and normalized_destination not in seen:
            seen.add(normalized_destination)
            destinations.append(destination)

    return _response(200, {'destinations': destinations})
