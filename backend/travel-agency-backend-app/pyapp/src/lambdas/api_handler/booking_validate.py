import json
import os
from datetime import datetime, date

import boto3

from commons.log_helper import get_logger
from commons.number_utils import to_number as _to_number
from commons.booking_token import issue_booking_token
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

ALLOWED_MEAL_PLANS = {'BB', 'HB', 'FB', 'AI'}


def validate_booking_availability(event):
    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return _bad_request(message='Validation failed', errors={'body': 'Invalid JSON body'})

    package_id = _normalize_str(body.get('packageId') or body.get('tourId'))
    start_date = _normalize_str(body.get('startDate'))
    duration = _normalize_str(body.get('duration'))
    meal_plan_raw = body.get('mealPlan')
    meal_plan = _normalize_str(meal_plan_raw).upper()

    errors = {}
    if not package_id:
        errors['packageId'] = 'packageId is required'
    if not start_date:
        errors['startDate'] = 'startDate is required'
    else:
        try:
            _parse_date(start_date, 'startDate')
        except ValueError as exc:
            errors['startDate'] = str(exc)

    if not duration:
        errors['duration'] = 'duration is required'

    if meal_plan and meal_plan not in ALLOWED_MEAL_PLANS:
        errors['mealPlan'] = f'mealPlan must be one of {", ".join(sorted(ALLOWED_MEAL_PLANS))}'

    adults_raw = body.get('adults', 1)
    children_raw = body.get('children', 0)
    guest_count = body.get('guestCount')

    adults = None
    children = None
    if guest_count is None:
        try:
            adults = _parse_non_negative_int(adults_raw, 'adults')
        except ValueError as exc:
            errors['adults'] = str(exc)
        try:
            children = _parse_non_negative_int(children_raw, 'children')
        except ValueError as exc:
            errors['children'] = str(exc)

        if adults is not None and children is not None:
            guest_count = adults + children
    else:
        try:
            guest_count = _parse_positive_int(guest_count, 'guestCount', minimum=1)
        except ValueError as exc:
            errors['guestCount'] = str(exc)

    if isinstance(guest_count, int) and guest_count <= 0:
        errors['guestCount'] = 'At least one guest is required'

    quoted_price = body.get('quotedPrice')
    if quoted_price is None:
        quoted_price = body.get('quotedTotal')
    if quoted_price is None:
        errors['quotedPrice'] = 'quotedPrice is required'

    if errors:
        return _bad_request(message='Validation failed', errors=errors)

    try:
        table = dynamodb_resource.Table(TOUR_TABLE_NAME)
        db_response = table.get_item(Key={'id': package_id})
        tour = db_response.get('Item')
    except Exception as exc:
        _LOG.error('Error reading tour for checkout validation: %s', str(exc))
        return _response(500, {'message': 'Internal server error'})

    if not tour:
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {'packageId': 'Selected package is no longer available'},
            'code': 'PACKAGE_NOT_AVAILABLE'
        })

    if not tour.get('isAvailable', False):
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {'packageId': 'Selected package is inactive'},
            'code': 'PACKAGE_INACTIVE'
        })

    if start_date not in (tour.get('startDates') or []):
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {'startDate': 'Selected start date is no longer available'},
            'code': 'PACKAGE_ALTERED'
        })

    if duration not in (tour.get('durations') or []):
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {'duration': 'Selected duration is no longer available'},
            'code': 'PACKAGE_ALTERED'
        })

    available_meal_plans = {str(plan).upper() for plan in (tour.get('mealPlans') or [])}
    if meal_plan and meal_plan not in available_meal_plans:
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {'mealPlan': 'Selected meal plan is no longer available'},
            'code': 'MEAL_PLAN_UNAVAILABLE'
        })

    try:
        selected_start = datetime.strptime(start_date, '%Y-%m-%d').date()
        if selected_start < date.today():
            return _response(409, {
                'message': 'Booking validation conflict',
                'errors': {'startDate': 'Selected package start date has expired'},
                'code': 'PACKAGE_EXPIRED'
            })
    except ValueError:
        return _bad_request(message='Validation failed', errors={'startDate': 'startDate must be in YYYY-MM-DD format'})

    capacity = tour.get('guestQuantity') or {}
    adults_max = int(capacity.get('adultsMaxValue', 0))
    children_max = int(capacity.get('childrenMaxValue', 0))
    total_max = int(capacity.get('totalMaxValue', capacity.get('totalMaxValue', adults_max + children_max)))

    if adults is not None and adults > adults_max:
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {'adults': f'Adult guest count exceeds available capacity ({adults_max})'},
            'code': 'CAPACITY_CONFLICT'
        })

    if children is not None and children > children_max:
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {'children': f'Children guest count exceeds available capacity ({children_max})'},
            'code': 'CAPACITY_CONFLICT'
        })

    if guest_count > total_max:
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {'guestCount': f'Guest count exceeds total available capacity ({total_max})'},
            'code': 'CAPACITY_CONFLICT'
        })

    components_valid, component_errors = _validate_tour_components(tour, guest_count)
    if not components_valid:
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {'components': component_errors},
            'code': 'COMPONENT_CONFLICT'
        })

    price_map = tour.get('price') or {}
    if duration not in price_map:
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {'duration': 'Pricing for selected duration is unavailable'},
            'code': 'PRICE_UNAVAILABLE'
        })

    current_unit_price = _to_number(price_map.get(duration))
    try:
        days = int(duration.split()[0])
    except (ValueError, IndexError):
        days = 1
    meal_supplement = _to_number((tour.get('mealSupplementsPerDay') or {}).get(meal_plan, 0))
    current_total_price = round(
        (current_unit_price + meal_supplement * days) * guest_count,
        2,
    )
    quoted_total_price = round(_to_number(quoted_price), 2)

    if quoted_total_price <= 0:
        return _bad_request(message='Validation failed', errors={'quotedPrice': 'quotedPrice must be greater than 0'})

    if abs(current_total_price - quoted_total_price) > 0.009:
        return _response(409, {
            'message': 'Booking validation conflict',
            'errors': {
                'pricing': {
                    'reason': 'Quoted price is no longer valid',
                    'quotedTotal': quoted_total_price,
                    'currentTotal': current_total_price,
                    'currency': tour.get('currency', 'USD')
                }
            },
            'code': 'PRICE_CHANGED'
        })

    booking_token = None
    try:
        booking_token = issue_booking_token(
            package_id=package_id,
            start_date=start_date,
            duration=duration,
            guest_count=guest_count,
            current_total=current_total_price,
            currency=tour.get('currency', 'USD'),
            meal_plan=meal_plan,
        )
    except Exception as exc:
        _LOG.error('Booking token generation failed: %s', str(exc))
        return _response(500, {'message': 'Server configuration error: Unable to issue booking token'})

    if not booking_token:
        return _response(500, {'message': 'Server configuration error: Booking token missing'})

    response_body = {
        'message': 'Booking validation successful',
        'isValid': True,
        'data': {
            'packageId': package_id,
            'startDate': start_date,
            'duration': duration,
            'guestCount': guest_count,
            'currentTotal': current_total_price,
            'currency': tour.get('currency', 'USD')
        },
        'bookingToken': booking_token
    }

    return _response(200, response_body)


def _validate_flight_capacity(flight_data, guest_count):
    """
    Validate flight availability and seat capacity against guest count.

    Args:
        flight_data: Flight component data dict with keys:
                     - status: 'ACTIVE', 'INACTIVE', 'EXPIRED'
                     - expiryDate: date string (YYYY-MM-DD format)
                     - seats: dict with 'available' and 'total' keys
        guest_count: Number of guests requiring seats

    Returns:
        Tuple (is_valid: bool, error: str or None)
    """
    if not isinstance(flight_data, dict):
        return False, 'Flight data is invalid'

    # Check flight status
    status = flight_data.get('status', '').upper()
    if status not in ('ACTIVE', 'AVAILABLE'):
        return False, f'Flight is {status.lower() if status else "unavailable"}'


    # Check expiry date
    try:
        expiry_date_str = flight_data.get('expiryDate')
        # expiryDate None veya boş string ise doğrulamayı blokla
        if not expiry_date_str:
            return False, 'Invalid flight expiry date format'

        # Saat detayından bağımsız, sadece tarih bazlı kıyaslama yapıyoruz
        expiry_date = datetime.strptime(expiry_date_str, '%Y-%m-%d').date()
        if expiry_date < date.today():
            return False, 'Flight booking has expired'
    except (ValueError, TypeError):
        return False, 'Invalid flight expiry date format'

    # Check seat availability
    seats = flight_data.get('seats') or {}
    available_seats = int(seats.get('available', 0))

    if available_seats < guest_count:
        return False, f'Insufficient flight seats available. Required: {guest_count}, Available: {available_seats}'

    return True, None


def _validate_accommodation_availability(accommodation_data, guest_count):
    """
    Validate accommodation room capacity and availability.

    Args:
        accommodation_data: Accommodation component data dict with keys:
                            - status: 'ACTIVE', 'INACTIVE', 'FULLY_BOOKED'
                            - capacity: maximum guests per room
                            - availableRooms: number of available rooms
                            - totalRooms: total number of rooms
        guest_count: Number of guests requiring accommodation

    Returns:
        Tuple (is_valid: bool, error: str or None)
    """
    if not isinstance(accommodation_data, dict):
        return False, 'Accommodation data is invalid'

    # Check accommodation status
    status = accommodation_data.get('status', '').upper()
    if status == 'FULLY_BOOKED':
        return False, 'Accommodation is fully booked'
    if status not in ('ACTIVE', 'AVAILABLE'):
        return False, f'Accommodation is {status.lower() if status else "unavailable"}'

    # Check room capacity
    capacity_per_room = int(accommodation_data.get('capacity', 0))
    if capacity_per_room <= 0:
        return False, 'Accommodation capacity information is invalid'

    if guest_count > capacity_per_room:
        return False, f'Guest count exceeds room capacity. Required: {guest_count}, Capacity per room: {capacity_per_room}'

    # Check available rooms
    available_rooms = int(accommodation_data.get('availableRooms', 0))
    if available_rooms <= 0:
        return False, 'No available accommodation rooms'

    return True, None


def _validate_activity_status(activity_data):
    """
    Validate activity availability when applicable.

    Args:
        activity_data: Activity component data dict with keys:
                       - status: 'AVAILABLE', 'FULLY_BOOKED', 'INACTIVE', 'CANCELLED'
                       - maxParticipants: maximum participants allowed
                       - currentParticipants: current number of participants
                       - isRequired: whether activity is mandatory for the tour

    Returns:
        Tuple (is_valid: bool, error: str or None)
    """
    if not isinstance(activity_data, dict):
        return False, 'Activity data is invalid'

    status = activity_data.get('status', '').upper()
    is_required = activity_data.get('isRequired', False)
    activity_name = activity_data.get('name', 'Activity')

    # Check activity status
    if status == 'CANCELLED':
        error_msg = f'{activity_name} has been cancelled'
        return False, error_msg if is_required else None

    if status == 'FULLY_BOOKED':
        error_msg = f'{activity_name} is fully booked'
        return False, error_msg if is_required else None

    if status not in ('AVAILABLE', 'ACTIVE'):
        error_msg = f'{activity_name} is {status.lower() if status else "unavailable"}'
        return False, error_msg if is_required else None

    # Check participant capacity (if data available)
    max_participants = activity_data.get('maxParticipants')
    current_participants = activity_data.get('currentParticipants')

    if max_participants and current_participants is not None:
        if current_participants >= max_participants:
            error_msg = f'{activity_name} has reached maximum participants'
            return False, error_msg if is_required else None

    return True, None


def _validate_tour_components(tour_data, guest_count):
    """
    Aggregate component-level validations into a single utility.
    Validates flight, accommodation, and activity components for a tour.

    Args:
        tour_data: Complete tour data dict with nested 'components' key containing:
                   - flight: flight component data
                   - accommodation: accommodation component data
                   - activities: list of activity component data
        guest_count: Number of guests for the tour

    Returns:
        Tuple (is_valid: bool, errors: dict)
        errors dict structure:
        {
            'flight': 'error message' or None,
            'accommodation': 'error message' or None,
            'activities': [
                {
                    'name': 'activity name',
                    'error': 'error message'
                },
                ...
            ] or None
        }
    """
    errors = {
        'flight': None,
        'accommodation': None,
        'activities': None
    }

    components = tour_data.get('components') or {}
    is_valid = True

    # Validate flight
    flight_data = components.get('flight')
    if flight_data:
        flight_valid, flight_error = _validate_flight_capacity(flight_data, guest_count)
        if not flight_valid:
            errors['flight'] = flight_error
            is_valid = False
    else:
        errors['flight'] = 'Flight information is missing'
        is_valid = False

    # Validate accommodation
    accommodation_data = components.get('accommodation')
    if accommodation_data:
        accommodation_valid, accommodation_error = _validate_accommodation_availability(accommodation_data, guest_count)
        if not accommodation_valid:
            errors['accommodation'] = accommodation_error
            is_valid = False
    else:
        errors['accommodation'] = 'Accommodation information is missing'
        is_valid = False

    # Validate activities (all are optional unless marked isRequired)
    activities_data = components.get('activities') or []
    activity_errors = []

    for activity in activities_data:
        activity_valid, activity_error = _validate_activity_status(activity)
        if not activity_valid and activity_error:
            activity_errors.append({
                'name': activity.get('name', 'Unknown Activity'),
                'error': activity_error
            })
            is_valid = False

    if activity_errors:
        errors['activities'] = activity_errors

    return is_valid, errors
