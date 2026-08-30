import json
import os
import re
import uuid
from datetime import datetime, timedelta
import boto3
from botocore.exceptions import ClientError
from commons.api_response import build_response
from commons.log_helper import get_logger
from commons.number_utils import to_number as _to_number
from boto3.dynamodb.types import TypeSerializer

_LOG = get_logger(__name__)
REGION = os.environ.get('region', 'eu-west-3')
TOUR_TABLE = os.environ.get('tour_table_name')
BOOKINGS_TABLE = os.environ.get('bookings_table')
FEEDBACKS_TABLE = os.environ.get('feedbacks_table')
TRAVEL_AGENTS_TABLE = os.environ.get('travel_agents_table')

dynamodb = boto3.resource('dynamodb', region_name=REGION)
dynamodb_client = boto3.client('dynamodb', region_name=REGION)
_SERIALIZER = TypeSerializer()

_ALLOWED_MUTATION_STATES = frozenset({'BOOKED', 'CONFIRMED'})


def _authenticated_principal(event):
    """Return a normalized principal while preserving direct unit-test compatibility."""
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
    value = principal.get('user_id') or principal.get('sub')
    return str(value).strip() if value is not None else ''


def _principal_role(principal):
    return str(principal.get('role') or '').strip().upper()


def _normalize_email(value):
    return str(value or '').strip().lower()


def _booking_owner_id(booking):
    owner = booking.get('userId')
    if isinstance(owner, dict):
        owner = owner.get('user_id') or owner.get('sub')
    return str(owner).strip() if owner is not None else ''


def _booking_agent_identity(booking):
    agent = booking.get('travelAgent') or {}
    if not isinstance(agent, dict):
        agent = {}

    agent_ids = {
        str(value).strip()
        for value in (
            booking.get('assignedTravelAgentId'),
            booking.get('travelAgentId'),
            booking.get('assignedAgentId'),
            agent.get('id'),
            agent.get('userId'),
            agent.get('user_id'),
            agent.get('sub'),
        )
        if value is not None and str(value).strip()
    }
    agent_emails = {
        _normalize_email(value)
        for value in (
            booking.get('travelAgentEmail'),
            booking.get('assignedTravelAgentEmail'),
            agent.get('email'),
        )
        if _normalize_email(value)
    }
    return agent_ids, agent_emails


def _can_access_booking(event, booking):
    principal = _authenticated_principal(event)
    role = _principal_role(principal)

    if role == 'ADMIN':
        return True

    if role == 'CUSTOMER':
        user_id = _principal_user_id(principal)
        return bool(user_id and user_id == _booking_owner_id(booking))

    if role == 'TRAVEL_AGENT':
        agent_ids, agent_emails = _booking_agent_identity(booking)
        user_id = _principal_user_id(principal)
        email = _normalize_email(principal.get('email'))
        return bool(
            (user_id and user_id in agent_ids)
            or (email and email in agent_emails)
        )

    return False


def _booking_not_found_response(event):
    # Return the same response for missing and inaccessible bookings so callers
    # cannot use booking IDs to discover another customer's data.
    return build_response(
        404,
        {
            'code': 'BOOKING_NOT_FOUND',
            'message': 'Booking not found',
        },
        event=event,
    )


def _booking_state_conflict_response(event, action, state):
    normalized_state = str(state or 'UNKNOWN').strip().upper()
    return build_response(
        409,
        {
            'code': 'BOOKING_STATE_CONFLICT',
            'message': (
                f'Booking cannot be {action} while it is in '
                f'{normalized_state} state'
            ),
            'currentState': normalized_state,
            'allowedStates': sorted(_ALLOWED_MUTATION_STATES),
        },
        event=event,
    )


def _forbidden_booking_response(event):
    return build_response(
        403,
        {
            'code': 'FORBIDDEN',
            'message': 'You are not allowed to access bookings',
        },
        event=event,
    )


def _public_booking_item(booking):
    """Return the documented My Tours DTO without internal ownership fields."""
    tour_details = booking.get('tourDetails')
    if not isinstance(tour_details, dict):
        tour_details = {}

    travel_agent = booking.get('travelAgent')
    if not isinstance(travel_agent, dict):
        travel_agent = {}

    personal_details = booking.get('personalDetails')
    if not isinstance(personal_details, list):
        personal_details = []

    canceled_by = booking.get('canceledBy')
    if isinstance(canceled_by, dict):
        canceled_by = (
            canceled_by.get('username')
            or canceled_by.get('email')
            or canceled_by.get('user_id')
            or canceled_by.get('sub')
            or canceled_by.get('role')
        )
    elif canceled_by is not None:
        canceled_by = str(canceled_by)

    raw_docs = booking.get('documents')
    documents = []
    if isinstance(raw_docs, list):
        for doc in raw_docs:
            if not isinstance(doc, dict):
                continue
            public_doc = {
                'id': str(doc.get('id') or ''),
                'name': str(doc.get('name') or ''),
            }
            if doc.get('fileFormat') is not None:
                public_doc['fileFormat'] = str(doc['fileFormat'])
            if doc.get('contentType') is not None:
                public_doc['contentType'] = str(doc['contentType'])
            if doc.get('status') is not None:
                public_doc['status'] = str(doc['status'])
            if doc.get('documentType') is not None:
                public_doc['documentType'] = str(doc['documentType'])
            if doc.get('guestIndex') is not None:
                public_doc['guestIndex'] = int(doc['guestIndex'])
            documents.append(public_doc)

    docs_count = len(documents)
    documents_str = f"{docs_count} item{'s' if docs_count != 1 else ''}" if docs_count > 0 else str(tour_details.get('documents') or '0 items')

    return {
        'id': str(booking.get('id') or ''),
        'tourId': str(booking.get('tourId') or ''),
        'customerEmail': str(booking.get('customerEmail') or ''),
        'state': str(booking.get('state') or ''),
        'tourImageUrl': str(booking.get('tourImageUrl') or ''),
        'name': str(booking.get('name') or ''),
        'destination': str(booking.get('destination') or ''),
        'personalDetails': personal_details,
        'documents': documents,
        'tourDetails': {
            'date': str(tour_details.get('date') or ''),
            'mealPlan': str(tour_details.get('mealPlan') or ''),
            'guests': str(tour_details.get('guests') or ''),
            'totalPrice': str(tour_details.get('totalPrice') or ''),
            'documents': documents_str,
        },
        'travelAgent': {
            'name': str(travel_agent.get('name') or ''),
            'email': str(travel_agent.get('email') or ''),
            'phone': str(travel_agent.get('phone') or ''),
            'messenger': str(travel_agent.get('messenger') or ''),
        },
        'canceledBy': canceled_by,
        'canceledByRole': booking.get('canceledByRole'),
        'cancelReason': (
            str(booking.get('cancelReason'))
            if booking.get('cancelReason') is not None
            else None
        ),
        'freeCancelation': booking.get('freeCancelation'),
        'documentRejectionReason': booking.get('documentRejectionReason'),
        'pendingEdits': booking.get('pendingEdits'),
    }


def _get_feedback_for_booking(booking_id):
    if not FEEDBACKS_TABLE:
        return None

    response = dynamodb.Table(FEEDBACKS_TABLE).query(
        KeyConditionExpression='bookingId = :booking_id',
        ExpressionAttributeValues={':booking_id': booking_id},
        Limit=1,
    )
    items = response.get('Items', [])
    return items[0] if items else None


def create_booking(event):
    """POST /bookings - Create a new tour booking (US_6.1)."""
    try:
        body = json.loads(event.get('body', '{}'))
    except Exception:
        return build_response(400, {'message': 'Invalid JSON body'})

    # Derive ownership only from the authenticated Cognito principal.
    principal = _authenticated_principal(event)
    user_id = _principal_user_id(principal)
    customer_email = principal.get('email', '')
    if not user_id:
        return build_response(
            401,
            {'code': 'UNAUTHORIZED', 'message': 'Authentication is required'},
            event=event,
        )

    tour_id = body.get('tourId')
    duration_str = body.get('duration', '')
    meal_plan = body.get('mealPlan')
    guests = body.get('guests', {})
    personal_details = body.get('personalDetails', [])
    if not personal_details:
        return build_response(400, {'message': 'Personal details for guests are required.'})
    full_names = []
    for person in personal_details:
        fname = person.get('firstName', '').strip()
        lname = person.get('lastName', '').strip()
        if not fname or not lname:
            return build_response(400, {'message': 'Both first name and last name are required for all guests.'})
        full_names.append(f"{fname} {lname}")
    names_str = ", ".join(full_names)

    req_adults = int(guests.get('adult', 0))
    req_children = int(guests.get('children', 0))
    req_total = req_adults + req_children

    if req_total <= 0:
        return build_response(400, {'message': 'At least one guest is required.'})

    tour_table = dynamodb.Table(TOUR_TABLE)
    bookings_table = dynamodb.Table(BOOKINGS_TABLE)

    # 1. Fetch Tour for real backend pricing
    tour_response = tour_table.get_item(Key={'id': tour_id})
    tour = tour_response.get('Item')

    if not tour:
        return build_response(404, {'message': 'Tour not found'})

    # 2. Price Calculation
    base_price_str = tour.get('price', {}).get(duration_str, "0")
    base_price = _to_number(base_price_str)

    meal_supp_str = tour.get('mealSupplementsPerDay', {}).get(meal_plan, "0")
    meal_supp_per_day = _to_number(meal_supp_str)

    try:
        days = int(duration_str.split()[0])
    except (ValueError, IndexError):
        days = 1

    total_price = (base_price * req_total) + (meal_supp_per_day * days * req_total)

    # Currently, we don't specify how a Travel Agent is linked to a Tour. We're temporarily looking for a 'travelAgentEmail' field.
    # If the team decides on a different linking method (e.g., a separate mapping table or a different attribute name), this block MUST be updated.
    # If no agent is found, we fall back to "Tyrone Boyer" to satisfy the OpenAPI CreateBookingResponseDetailsDTO contract for frontend testing.
    agent_email = tour.get('travelAgentEmail') # Change after it's decided how TA are assigned to tours
    agent_data = {
        'name': 'Tyrone Boyer',
        'email': 'tyroneboyer@gmail.com',
        'phone': '480-221-1885',
        'messenger': 'https://example.com/messenger-link'
    }

    if agent_email:
        try:
            agents_table = dynamodb.Table(TRAVEL_AGENTS_TABLE)
            agent_response = agents_table.get_item(Key={'email': agent_email})
            agent_item = agent_response.get('Item')

            if agent_item:
                first_name = agent_item.get('given_name', agent_item.get('firstName', ''))
                last_name = agent_item.get('family_name', agent_item.get('lastName', ''))
                full_name = f"{first_name} {last_name}".strip() or agent_item.get('name', 'Unknown Agent')

                agent_data = {
                    'name': full_name,
                    'email': agent_item.get('email', agent_email),
                    'phone': agent_item.get('phone', 'N/A'),
                    'messenger': agent_item.get('messenger', 'N/A'),
                    'userId': agent_item.get('userId', '')
                }
        except Exception as e:
            _LOG.warning('Failed to fetch travel agent: %s', e)

    # 5. Save Booking Record
    booking_id = str(uuid.uuid4())
    start_date = body.get('date')

    try:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        formatted_date = start_dt.strftime('%B %d, %Y')
    except (TypeError, ValueError):
        start_dt = None
        formatted_date = start_date or ""

    cancellation_days = tour.get('freeCancelationDaysBefore')
    try:
        cancellation_days = int(cancellation_days)
    except (TypeError, ValueError):
        cancellation_days = 0

    free_cancel_str = None
    if start_dt and cancellation_days > 0:
        free_cancel_str = (start_dt - timedelta(days=cancellation_days)).strftime('%Y-%m-%d')

    image_urls = tour.get('imageUrls', [])
    tour_image_url = image_urls[0] if image_urls else ""

    booking_item = {
        'id': booking_id,
        'userId': user_id,
        'customerEmail': customer_email,
        'tourId': tour_id,
        'state': 'BOOKED',
        'name': tour.get('name', 'Unknown Tour'),
        'destination': tour.get('destination', 'Unknown Destination'),
        'tourImageUrl': tour_image_url,
        'personalDetails': personal_details,
        'tourDetails': {
            'date': f"{start_date} ({duration_str})",
            'mealPlan': meal_plan,
            'guests': f"{names_str} ({req_adults} adults, {req_children} children)",
            'totalPrice': f"${int(total_price)}",
            'documents': "0 items"
        },
        'travelAgent': agent_data,
        'canceledBy': None,
        'cancelReason': None,
        'freeCancelation': free_cancel_str,
    }

    # 6. Atomically save booking and decrement tour capacity using a transact
    try:
        expr_vals = {
            ':a': {'N': str(req_adults)},
            ':c': {'N': str(req_children)},
            ':t': {'N': str(req_total)}
        }

        booking_item_serialized = {k: _SERIALIZER.serialize(v) for k, v in booking_item.items()}

        transact_items = [
            {
                'Update': {
                    'TableName': TOUR_TABLE,
                    'Key': {'id': {'S': tour_id}},
                    'UpdateExpression': (
                        "SET guestQuantity.adultsMaxValue = guestQuantity.adultsMaxValue - :a,"
                        " guestQuantity.childrenMaxValue = guestQuantity.childrenMaxValue - :c,"
                        " guestQuantity.totalMaxValue = guestQuantity.totalMaxValue - :t"
                    ),
                    'ConditionExpression': (
                        "guestQuantity.adultsMaxValue >= :a AND "
                        "guestQuantity.childrenMaxValue >= :c AND "
                        "guestQuantity.totalMaxValue >= :t"
                    ),
                    'ExpressionAttributeValues': expr_vals
                }
            },
            {
                'Put': {
                    'TableName': BOOKINGS_TABLE,
                    'Item': booking_item_serialized
                }
            }
        ]

        dynamodb_client.transact_write_items(TransactItems=transact_items)
    except ClientError as e:
        code = e.response.get('Error', {}).get('Code')
        if code in ('TransactionCanceledException', 'ConditionalCheckFailedException'):
            _LOG.warning(f"Overbooking prevented for tour {tour_id}")
            return build_response(400, {'message': 'Tour is fully booked or requested capacity is unavailable.'})
        _LOG.error(f"Failed to save booking transactionally: {str(e)}")
        return build_response(500, {'message': 'Failed to save booking.'})

    details_msg = (
        f"You have successfully booked a tour at {tour.get('name')}, "
        f"starting date {formatted_date} ({duration_str}), {meal_plan} for {req_adults} adult(s)."
    )

    response_body = {
        "freeCancelation": free_cancel_str,
        "details": f"{details_msg} Please upload your travel documents to the booking on the 'My Tours' page and wait for the Travel Agent to contact you."
    }

    return build_response(201, response_body)


def get_bookings(event):
    """GET /bookings - Return only bookings visible to the current principal."""
    principal = _authenticated_principal(event)
    role = _principal_role(principal)

    if not _principal_user_id(principal):
        return build_response(
            401,
            {'code': 'UNAUTHORIZED', 'message': 'Authentication is required'},
            event=event,
        )

    if role not in {'CUSTOMER', 'TRAVEL_AGENT', 'ADMIN'}:
        return _forbidden_booking_response(event)

    try:
        bookings_table = dynamodb.Table(BOOKINGS_TABLE)
        items = []
        scan_kwargs = {}

        while True:
            response = bookings_table.scan(**scan_kwargs)
            items.extend(response.get('Items', []))
            last_key = response.get('LastEvaluatedKey')
            if not last_key:
                break
            scan_kwargs['ExclusiveStartKey'] = last_key

        visible_items = []
        for booking in items:
            if not _can_access_booking(event, booking):
                continue

            public_booking = _public_booking_item(booking)
            feedback = _get_feedback_for_booking(str(booking.get('id') or ''))
            public_booking['hasFeedback'] = feedback is not None
            public_booking['feedback'] = (
                {
                    'rating': feedback.get('rating'),
                    'comment': feedback.get('comment', ''),
                }
                if feedback
                else None
            )
            visible_items.append(public_booking)
        return build_response(200, {'bookings': visible_items}, event=event)
    except Exception as exc:
        _LOG.error(
            'Failed to retrieve authorized bookings for user %s: %s',
            _principal_user_id(principal),
            str(exc),
        )
        return build_response(
            500,
            {'message': 'Internal server error retrieving bookings.'},
            event=event,
        )


def edit_booking(event):
    """PUT /bookings/{id} - Update or stage an existing tour booking (US_6.2 / US_8.2)."""
    try:
        body = json.loads(event.get('body', '{}'))
    except Exception:
        return build_response(400, {'message': 'Invalid JSON body'})

    booking_id = event.get('pathParameters', {}).get('id')
    if not booking_id:
        return build_response(400, {'message': 'Booking ID is required'})

    bookings_table = dynamodb.Table(BOOKINGS_TABLE)
    tour_table = dynamodb.Table(TOUR_TABLE)

    # 1. Fetch Existing Booking
    booking_response = bookings_table.get_item(Key={'id': booking_id})
    booking = booking_response.get('Item')
    if not booking or not _can_access_booking(event, booking):
        return _booking_not_found_response(event)

    # Updates are valid only while the booking is in the BOOKED state.
    current_state = str(booking.get('state') or '').upper()
    if current_state != 'BOOKED':
        return build_response(
            409,
            {
                'code': 'BOOKING_STATE_CONFLICT',
                'message': f"Booking cannot be updated while it is in {current_state} state",
                'currentState': current_state,
                'allowedStates': ['BOOKED'],
            },
            event=event,
        )

    # 2. Fetch Tour Data for Validation
    tour_id = booking.get('tourId')
    tour_response = tour_table.get_item(Key={'id': tour_id})
    tour = tour_response.get('Item')
    if not tour:
        return build_response(404, {'message': 'Associated tour not found'})

    # 3. Parse Inputs
    duration_str = body.get('duration', '')
    meal_plan = body.get('mealPlan', '')
    guests = body.get('guests', {})
    personal_details = body.get('personalDetails', booking.get('personalDetails', []))
    if not personal_details:
        return build_response(400, {'message': 'Personal details for guests are required.'})
    full_names = []
    for person in personal_details:
        fname = person.get('firstName', '').strip()
        lname = person.get('lastName', '').strip()
        if not fname or not lname:
            return build_response(400, {'message': 'Both first name and last name are required for all guests.'})
        full_names.append(f"{fname} {lname}".strip())
    names_str = ", ".join(full_names)

    req_adults = int(guests.get('adult', 0))
    req_children = int(guests.get('children', 0))
    req_total = req_adults + req_children

    if req_total <= 0:
        return build_response(400, {'message': 'At least one guest is required.'})

    # 4. Calculate New Price
    base_price_str = tour.get('price', {}).get(duration_str, "0")
    base_price = _to_number(base_price_str)

    meal_supp_str = tour.get('mealSupplementsPerDay', {}).get(meal_plan, "0")
    meal_supp_per_day = _to_number(meal_supp_str)

    try:
        days = int(duration_str.split()[0])
    except (ValueError, IndexError):
        days = 1

    total_price = (base_price * req_total) + (meal_supp_per_day * days * req_total)

    # 5. Capacity Delta Calculation
    old_guests_str = booking.get('tourDetails', {}).get('guests', '')
    old_adults, old_children = 0, 0
    adult_match = re.search(r'(\d+)\s+adult', old_guests_str)
    if adult_match:
        old_adults = int(adult_match.group(1))

    child_match = re.search(r'(\d+)\s+child', old_guests_str)
    if child_match:
        old_children = int(child_match.group(1))

    # Incorporate any already-reserved capacity from a previous pending edit
    prior_delta = booking.get('pendingEdits', {}).get('capacityDelta', {})
    prior_adults_delta = int(prior_delta.get('adults', 0))
    prior_children_delta = int(prior_delta.get('children', 0))

    current_reserved_adults = old_adults + prior_adults_delta
    current_reserved_children = old_children + prior_children_delta

    # Capacity we need to transact with the TOUR pool right now
    delta_adults = req_adults - current_reserved_adults
    delta_children = req_children - current_reserved_children
    delta_total = delta_adults + delta_children

    # Total capacity held by this booking vs its live state (for the pendingEdits object)
    cumulative_delta_adults = prior_adults_delta + delta_adults
    cumulative_delta_children = prior_children_delta + delta_children
    cumulative_delta_total = prior_adults_delta + prior_children_delta + delta_total

    # 6. Save Updated Booking (use transaction when capacity changes)
    raw_start_date = body.get('date') or body.get('startDate') or booking['tourDetails']['date']
    start_date = str(raw_start_date).split(' ')[0]
    new_tour_details = {
        'date': f"{start_date} ({duration_str})",
        'mealPlan': meal_plan,
        'guests': f"{names_str} ({req_adults} adults, {req_children} children)",
        'totalPrice': f"${int(total_price)}",
        'documents': booking.get('tourDetails', {}).get('documents', '0 items')
    }

    principal = _authenticated_principal(event)
    role = _principal_role(principal)
    offline_approval = body.get('offlineApproval') is True

    # Determine if we update immediately or stage the changes
    is_immediate = (role == 'CUSTOMER') or (role == 'TRAVEL_AGENT' and offline_approval)

    if is_immediate:
        booking['tourDetails'] = new_tour_details
        booking['personalDetails'] = personal_details
        booking.pop('pendingEdits', None) # Wipe any pending edits since it's confirmed
    else:
        booking['pendingEdits'] = {
            'tourDetails': new_tour_details,
            'personalDetails': personal_details,
            'capacityDelta': {
                'adults': cumulative_delta_adults,
                'children': cumulative_delta_children,
                'total': cumulative_delta_total
            }
        }

    if delta_total != 0 or delta_adults != 0 or delta_children != 0:
        try:
            # prepare update expression depending on delta sign
            if delta_total > 0:
                # need to decrement available capacity (require enough available)
                expr_vals = {
                    ':a': {'N': str(delta_adults)},
                    ':c': {'N': str(delta_children)},
                    ':t': {'N': str(delta_total)}
                }
                update_expr = (
                    "SET guestQuantity.adultsMaxValue = guestQuantity.adultsMaxValue - :a,"
                    " guestQuantity.childrenMaxValue = guestQuantity.childrenMaxValue - :c,"
                    " guestQuantity.totalMaxValue = guestQuantity.totalMaxValue - :t"
                )
                cond_expr = (
                    "guestQuantity.adultsMaxValue >= :a AND "
                    "guestQuantity.childrenMaxValue >= :c AND "
                    "guestQuantity.totalMaxValue >= :t"
                )
                update_action = {
                    'Update': {
                        'TableName': TOUR_TABLE,
                        'Key': {'id': {'S': tour_id}},
                        'UpdateExpression': update_expr,
                        'ConditionExpression': cond_expr,
                        'ExpressionAttributeValues': expr_vals
                    }
                }
            else:
                # delta_total < 0 -> increase available capacity
                add_adults = abs(delta_adults)
                add_children = abs(delta_children)
                add_total = abs(delta_total)
                expr_vals = {
                    ':a': {'N': str(add_adults)},
                    ':c': {'N': str(add_children)},
                    ':t': {'N': str(add_total)}
                }
                update_expr = (
                    "SET guestQuantity.adultsMaxValue = guestQuantity.adultsMaxValue + :a,"
                    " guestQuantity.childrenMaxValue = guestQuantity.childrenMaxValue + :c,"
                    " guestQuantity.totalMaxValue = guestQuantity.totalMaxValue + :t"
                )
                update_action = {
                    'Update': {
                        'TableName': TOUR_TABLE,
                        'Key': {'id': {'S': tour_id}},
                        'UpdateExpression': update_expr,
                        'ExpressionAttributeValues': expr_vals
                    }
                }

            booking_item_serialized = {k: _SERIALIZER.serialize(v) for k, v in booking.items()}

            transact_items = [
                update_action,
                {
                    'Put': {
                        'TableName': BOOKINGS_TABLE,
                        'Item': booking_item_serialized,
                        'ConditionExpression': 'attribute_exists(id) AND #s = :booked',
                        'ExpressionAttributeNames': {'#s': 'state'},
                        'ExpressionAttributeValues': {
                            ':booked': {'S': 'BOOKED'}
                        },
                    }
                }
            ]

            dynamodb_client.transact_write_items(TransactItems=transact_items)
        except ClientError as e:
            code = e.response.get('Error', {}).get('Code')
            if code in ('TransactionCanceledException', 'ConditionalCheckFailedException'):
                return build_response(
                    409,
                    {
                        'code': 'BOOKING_UPDATE_CONFLICT',
                        'message': (
                            'Booking could not be updated because its state '
                            'or tour availability changed'
                        ),
                    },
                    event=event,
                )
            _LOG.error(f"Error updating capacity/booking transactionally: {e}")
            return build_response(500, {'message': 'Error updating capacity.'})
    else:
        # No capacity change; simple put is sufficient
        try:
            bookings_table.put_item(
                Item=booking,
                ConditionExpression='attribute_exists(id) AND #s = :booked',
                ExpressionAttributeNames={'#s': 'state'},
                ExpressionAttributeValues={
                    ':booked': 'BOOKED'
                },
            )
        except ClientError as exc:
            code = exc.response.get('Error', {}).get('Code')
            if code == 'ConditionalCheckFailedException':
                return _booking_state_conflict_response(
                    event,
                    'updated',
                    booking.get('state'),
                )
            _LOG.error(f"Failed to save booking to DB: {str(exc)}")
            return build_response(500, {'message': 'Failed to save booking.'}, event=event)
        except Exception as exc:
            _LOG.error(f"Failed to save booking to DB: {str(exc)}")
            return build_response(500, {'message': 'Failed to save booking.'}, event=event)

    return build_response(200, _public_booking_item(booking)) # Used the helper function to properly serialize the response!


def cancel_booking(event):
    """DELETE /bookings/{id} - Cancel a tour booking (US_6.3)."""
    booking_id = event.get('pathParameters', {}).get('id')
    if not booking_id:
        return build_response(400, {'message': 'Booking ID is required'})

    # --- Parse body for TA cancelReason ---
    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        body = {}

    cancel_reason = body.get('cancelReason')
    allowed_reasons = {
        "Customer's Emergency", 
        "Hotel Emergency", 
        "Safety Concerns", 
        "Insufficient bookings"
    }

    if cancel_reason and cancel_reason not in allowed_reasons:
        return build_response(400, {'message': "Invalid cancel reason."})
    
    # Default fallback for customers who do not send a specific reason
    if not cancel_reason:
        cancel_reason = 'Canceled by user'
    
    bookings_table = dynamodb.Table(BOOKINGS_TABLE)
    tour_table = dynamodb.Table(TOUR_TABLE)

    # 1. Fetch Booking
    booking_response = bookings_table.get_item(Key={'id': booking_id})
    booking = booking_response.get('Item')
    if not booking or not _can_access_booking(event, booking):
        return _booking_not_found_response(event)

    if str(booking.get('state') or '').upper() not in _ALLOWED_MUTATION_STATES:
        return _booking_state_conflict_response(
            event,
            'cancelled',
            booking.get('state'),
        )

    refund_eligible = False

    try:
        free_cancel_deadline = datetime.strptime(
            str(booking.get('freeCancelation') or ''),
            '%Y-%m-%d',
        ).date()
        refund_eligible = datetime.now().date() <= free_cancel_deadline
    except ValueError:
        pass

    # 2b. Calculate Penalty if not eligible for free refund ($50 per day)
    penalty_amount = 0
    if not refund_eligible:
        date_str = booking.get('tourDetails', {}).get('date', '')
        duration_match = re.search(r'(\d+)\s+days?', date_str, re.IGNORECASE)
        days = int(duration_match.group(1)) if duration_match else 1
        penalty_amount = days * 50

    # 3. Restore Capacity to Tour Pool
    old_guests_str = booking.get('tourDetails', {}).get('guests', '')
    old_adults, old_children = 0, 0

    adult_match = re.search(r'(\d+)\s+adult', old_guests_str)
    if adult_match:
        old_adults = int(adult_match.group(1))

    child_match = re.search(r'(\d+)\s+child', old_guests_str)
    if child_match:
        old_children = int(child_match.group(1))

    # IMPORTANT: Also restore any capacity currently held by pending edits
    pending_delta = booking.get('pendingEdits', {}).get('capacityDelta', {})
    restore_adults = old_adults + int(pending_delta.get('adults', 0))
    restore_children = old_children + int(pending_delta.get('children', 0))
    restore_total = restore_adults + restore_children

    # 3b. Restore capacity and set booking state in a single transaction
    booking['state'] = 'CANCELED'
    principal = _authenticated_principal(event)
    booking['canceledBy'] = principal.get('username') or principal.get('user_id') or principal.get('sub') or 'UNKNOWN'
    canceled_by_role = _principal_role(principal) or 'UNKNOWN'
    booking['cancelReason'] = cancel_reason

    # Build the UpdateExpression safely based on whether pendingEdits exists in this record
    remove_pending = " REMOVE pendingEdits" if "pendingEdits" in booking else ""

    if restore_total > 0:
        try:
            update_tour = {
                'Update': {
                    'TableName': TOUR_TABLE,
                    'Key': {'id': {'S': booking.get('tourId')}},
                    'UpdateExpression': (
                        "SET guestQuantity.adultsMaxValue = guestQuantity.adultsMaxValue + :a,"
                        " guestQuantity.childrenMaxValue = guestQuantity.childrenMaxValue + :c,"
                        " guestQuantity.totalMaxValue = guestQuantity.totalMaxValue + :t"
                    ),
                    'ExpressionAttributeValues': {
                        ':a': {'N': str(restore_adults)},
                        ':c': {'N': str(restore_children)},
                        ':t': {'N': str(restore_total)}
                    }
                }
            }

            update_booking = {
                'Update': {
                    'TableName': BOOKINGS_TABLE,
                    'Key': {'id': {'S': booking_id}},
                    'UpdateExpression': f"SET #s = :newstate, canceledBy = :cby, canceledByRole = :crole, cancelReason = :creason{remove_pending}",
                    'ConditionExpression': (
                        'attribute_exists(id) AND '
                        '(#s = :booked OR #s = :confirmed)'
                    ),
                    'ExpressionAttributeNames': {'#s': 'state'},
                    'ExpressionAttributeValues': {
                        ':newstate': {'S': 'CANCELED'},
                        ':cby': {'S': str(booking.get('canceledBy'))},
                        ':crole': {'S': canceled_by_role},
                        ':creason': {'S': cancel_reason},
                        ':booked': {'S': 'BOOKED'},
                        ':confirmed': {'S': 'CONFIRMED'}
                    }
                }
            }

            dynamodb_client.transact_write_items(TransactItems=[update_tour, update_booking])
        except ClientError as e:
            code = e.response.get('Error', {}).get('Code')
            if code in ('TransactionCanceledException', 'ConditionalCheckFailedException'):
                return _booking_state_conflict_response(
                    event,
                    'cancelled',
                    booking.get('state'),
                )
            _LOG.error(f"Failed to cancel booking transactionally {booking_id}: {e}")
            return build_response(500, {'message': 'Failed to cancel booking.'})
    else:
        # Only update booking state if no capacity to restore
        try:
            bookings_table.update_item(
                Key={'id': booking_id},
                UpdateExpression=f"SET #s = :newstate, canceledBy = :cby, canceledByRole = :crole, cancelReason = :creason{remove_pending}",
                ConditionExpression=(
                    'attribute_exists(id) AND '
                    '(#s = :booked OR #s = :confirmed)'
                ),
                ExpressionAttributeNames={'#s': 'state'},
                ExpressionAttributeValues={
                    ':newstate': 'CANCELED',
                    ':cby': booking.get('canceledBy'),
                    ':crole': canceled_by_role,
                    ':creason': cancel_reason,
                    ':booked': 'BOOKED',
                    ':confirmed': 'CONFIRMED'
                }
            )
        except ClientError as exc:
            code = exc.response.get('Error', {}).get('Code')
            if code == 'ConditionalCheckFailedException':
                return _booking_state_conflict_response(
                    event,
                    'cancelled',
                    booking.get('state'),
                )
            _LOG.error(f"Failed to update booking state for {booking_id}: {exc}")
            return build_response(500, {'message': 'Failed to cancel booking.'}, event=event)
    # US6 requires that the assigned Travel Agent is informed when a tour is canceled. Currently we're only logging this to CloudWatch
    # We should discuss in more details how TA will be notified in the future (Message/Pop up?)
    _LOG.info('NOTIFICATION: Informing agent that booking %s was canceled.', booking_id)

    return build_response(200, {
        'message': 'Booking cancelled successfully',
        'refundEligible': refund_eligible,
        'penaltyAmount': penalty_amount
    })

def confirm_booking(event):
    """POST /bookings/{id}/confirm - Confirm a tour booking (US_8.1)."""
    booking_id = event.get('pathParameters', {}).get('id')
    if not booking_id:
        return build_response(400, {'message': 'Booking ID is required'})

    principal = _authenticated_principal(event)
    if _principal_role(principal) == 'CUSTOMER':
        return build_response(403, {'message': 'Customers are not permitted to confirm bookings.'}, event=event)

    bookings_table = dynamodb.Table(BOOKINGS_TABLE)

    # 1. Fetch Existing Booking
    booking_response = bookings_table.get_item(Key={'id': booking_id})
    booking = booking_response.get('Item')
    if not booking or not _can_access_booking(event, booking):
        return _booking_not_found_response(event)

    # 2. State Validation
    current_state = str(booking.get('state') or '').upper()
    if current_state != 'BOOKED':
        # Temporarily repurposing _booking_state_conflict_response until Subtask 3 refactor
        return _booking_state_conflict_response(
            event,
            'confirmed',
            current_state,
        )

    if booking.get('pendingEdits'):
        return build_response(
            409,
            {
                'code': 'BOOKING_STATE_CONFLICT',
                'message': 'Cannot confirm booking while there are pending edits awaiting customer approval.',
            },
            event=event,
        )

    # 3. Update State atomically
    try:
        bookings_table.update_item(
            Key={'id': booking_id},
            UpdateExpression="SET #s = :newstate",
            ConditionExpression="attribute_exists(id) AND #s = :booked",
            ExpressionAttributeNames={'#s': 'state'},
            ExpressionAttributeValues={
                ':newstate': 'CONFIRMED',
                ':booked': 'BOOKED'
            }
        )
    except ClientError as exc:
        code = exc.response.get('Error', {}).get('Code')
        if code == 'ConditionalCheckFailedException':
            return _booking_state_conflict_response(
                event,
                'confirmed',
                booking.get('state'),
            )
        _LOG.error(f"Failed to update booking state for confirmation {booking_id}: {exc}")
        return build_response(500, {'message': 'Failed to confirm booking.'}, event=event)

    return build_response(200, {'message': 'Booking confirmed successfully'})

def reject_documents(event):
    """POST /bookings/{id}/reject-documents - Reject customer documents (US_8.1)."""
    booking_id = event.get('pathParameters', {}).get('id')
    if not booking_id:
        return build_response(400, {'message': 'Booking ID is required'})

    principal = _authenticated_principal(event)
    if _principal_role(principal) == 'CUSTOMER':
        return build_response(403, {'message': 'Customers are not permitted to reject documents.'}, event=event)

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return build_response(400, {'message': 'Invalid JSON body'})

    reason = str(body.get('reason') or '').strip()
    if not reason:
        return build_response(400, {'message': 'Rejection reason is required'})

    bookings_table = dynamodb.Table(BOOKINGS_TABLE)

    # 1. Fetch Existing Booking
    booking_response = bookings_table.get_item(Key={'id': booking_id})
    booking = booking_response.get('Item')
    if not booking or not _can_access_booking(event, booking):
        return _booking_not_found_response(event)

    # 2. State Validation
    current_state = str(booking.get('state') or '').upper()
    if current_state != 'BOOKED':
        return _booking_state_conflict_response(
            event,
            'rejected',
            current_state,
        )

    # 3. Update Document Rejection Reason
    try:
        bookings_table.update_item(
            Key={'id': booking_id},
            UpdateExpression="SET documentRejectionReason = :reason",
            ConditionExpression="attribute_exists(id) AND #s = :booked",
            ExpressionAttributeNames={'#s': 'state'},
            ExpressionAttributeValues={
                ':reason': reason,
                ':booked': 'BOOKED'
            }
        )
    except ClientError as exc:
        code = exc.response.get('Error', {}).get('Code')
        if code == 'ConditionalCheckFailedException':
            return _booking_state_conflict_response(
                event,
                'rejected',
                booking.get('state'),
            )
        _LOG.error(f"Failed to reject documents for booking {booking_id}: {exc}")
        return build_response(500, {'message': 'Failed to reject documents.'}, event=event)

    # Log notification as per the requirement
    _LOG.info('NOTIFICATION: Informing customer that documents for booking %s were rejected. Reason: %s', booking_id, reason)

    return build_response(200, {'message': 'Documents rejected and customer notified'})

def confirm_edit(event):
    """POST /bookings/{id}/confirm-edit - Customer confirms staged booking changes."""
    booking_id = event.get('pathParameters', {}).get('id')
    if not booking_id:
        return build_response(400, {'message': 'Booking ID is required'}, event=event)

    principal = _authenticated_principal(event)
    if _principal_role(principal) != 'CUSTOMER':
        return build_response(403, {'message': 'Only the customer can approve booking changes.'}, event=event)

    bookings_table = dynamodb.Table(BOOKINGS_TABLE)

    booking_response = bookings_table.get_item(Key={'id': booking_id})
    booking = booking_response.get('Item')
    if not booking or not _can_access_booking(event, booking):
        return _booking_not_found_response(event)

    current_state = str(booking.get('state') or '').upper()
    if current_state != 'BOOKED':
        return _booking_state_conflict_response(event, 'confirmed', current_state)

    pending_edits = booking.get('pendingEdits')
    if not pending_edits:
        return build_response(400, {'message': 'No pending edits found for this booking.'}, event=event)

    new_tour_details = pending_edits.get('tourDetails', booking.get('tourDetails', {}))
    new_personal_details = pending_edits.get('personalDetails', booking.get('personalDetails', []))

    try:
        bookings_table.update_item(
            Key={'id': booking_id},
            UpdateExpression="SET tourDetails = :td, personalDetails = :pd REMOVE pendingEdits",
            ConditionExpression="attribute_exists(id) AND #s = :booked AND attribute_exists(pendingEdits)",
            ExpressionAttributeNames={'#s': 'state'},
            ExpressionAttributeValues={
                ':td': new_tour_details,
                ':pd': new_personal_details,
                ':booked': 'BOOKED'
            }
        )
    except ClientError as exc:
        code = exc.response.get('Error', {}).get('Code')
        if code == 'ConditionalCheckFailedException':
            return build_response(409, {'message': 'Booking state or pending edits changed.'}, event=event)
        _LOG.error(f"Failed to confirm booking edits: {exc}")
        return build_response(500, {'message': 'Failed to confirm booking edits.'}, event=event)

    booking['tourDetails'] = new_tour_details
    booking['personalDetails'] = new_personal_details
    booking.pop('pendingEdits', None)

    return build_response(200, {
        'message': 'Tour booking changes approved successfully',
        'booking': _public_booking_item(booking)
    }, event=event)


def decline_edit(event):
    """POST /bookings/{id}/decline-edit - Customer declines staged booking changes causing cancellation."""
    booking_id = event.get('pathParameters', {}).get('id')
    if not booking_id:
        return build_response(400, {'message': 'Booking ID is required'}, event=event)

    principal = _authenticated_principal(event)
    if _principal_role(principal) != 'CUSTOMER':
        return build_response(403, {'message': 'Only the customer can decline booking changes.'}, event=event)

    bookings_table = dynamodb.Table(BOOKINGS_TABLE)
    booking_response = bookings_table.get_item(Key={'id': booking_id})
    booking = booking_response.get('Item')
    
    if not booking or not _can_access_booking(event, booking):
        return _booking_not_found_response(event)

    current_state = str(booking.get('state') or '').upper()
    if current_state != 'BOOKED':
        return _booking_state_conflict_response(event, 'declined', current_state)

    pending_edits = booking.get('pendingEdits')
    if not pending_edits:
        return build_response(400, {'message': 'No pending edits found for this booking.'}, event=event)

    # Calculate capacity to restore: original + cumulative delta
    old_guests_str = booking.get('tourDetails', {}).get('guests', '')
    old_adults, old_children = 0, 0
    adult_match = re.search(r'(\d+)\s+adult', old_guests_str)
    if adult_match:
        old_adults = int(adult_match.group(1))
    child_match = re.search(r'(\d+)\s+child', old_guests_str)
    if child_match:
        old_children = int(child_match.group(1))

    cap_delta = pending_edits.get('capacityDelta') or {}
    delta_adults = int(cap_delta.get('adults', 0))
    delta_children = int(cap_delta.get('children', 0))

    total_restore_adults = old_adults + delta_adults
    total_restore_children = old_children + delta_children
    total_restore_count = total_restore_adults + total_restore_children

    principal = _authenticated_principal(event)
    canceled_by = principal.get('username') or principal.get('user_id') or principal.get('sub') or 'CUSTOMER'
    canceled_by_role = _principal_role(principal) or 'CUSTOMER'
    cancel_reason = 'Customer declined tour edits'

    if total_restore_count > 0:
        try:
            update_tour = {
                'Update': {
                    'TableName': TOUR_TABLE,
                    'Key': {'id': {'S': booking.get('tourId')}},
                    'UpdateExpression': (
                        "SET guestQuantity.adultsMaxValue = guestQuantity.adultsMaxValue + :a,"
                        " guestQuantity.childrenMaxValue = guestQuantity.childrenMaxValue + :c,"
                        " guestQuantity.totalMaxValue = guestQuantity.totalMaxValue + :t"
                    ),
                    'ExpressionAttributeValues': {
                        ':a': {'N': str(total_restore_adults)},
                        ':c': {'N': str(total_restore_children)},
                        ':t': {'N': str(total_restore_count)}
                    }
                }
            }

            update_booking = {
                'Update': {
                    'TableName': BOOKINGS_TABLE,
                    'Key': {'id': {'S': booking_id}},
                    'UpdateExpression': "SET #s = :newstate, canceledBy = :cby, canceledByRole = :crole, cancelReason = :creason REMOVE pendingEdits",
                    'ConditionExpression': "attribute_exists(id) AND #s = :booked AND attribute_exists(pendingEdits)",
                    'ExpressionAttributeNames': {'#s': 'state'},
                    'ExpressionAttributeValues': {
                        ':newstate': {'S': 'CANCELED'},
                        ':cby': {'S': str(canceled_by)},
                        ':crole': {'S': canceled_by_role},
                        ':creason': {'S': cancel_reason},
                        ':booked': {'S': 'BOOKED'}
                    }
                }
            }

            dynamodb_client.transact_write_items(TransactItems=[update_tour, update_booking])
        except ClientError as e:
            code = e.response.get('Error', {}).get('Code')
            if code in ('TransactionCanceledException', 'ConditionalCheckFailedException'):
                return _booking_state_conflict_response(event, 'declined', booking.get('state'))
            _LOG.error(f"Failed to decline booking edits transactionally: {e}")
            return build_response(500, {'message': 'Failed to decline booking edits.'}, event=event)
    else:
        try:
            bookings_table.update_item(
                Key={'id': booking_id},
                UpdateExpression="SET #s = :newstate, canceledBy = :cby, canceledByRole = :crole, cancelReason = :creason REMOVE pendingEdits",
                ConditionExpression="attribute_exists(id) AND #s = :booked AND attribute_exists(pendingEdits)",
                ExpressionAttributeNames={'#s': 'state'},
                ExpressionAttributeValues={
                    ':newstate': 'CANCELED',
                    ':cby': str(canceled_by),
                    ':crole': canceled_by_role,
                    ':creason': cancel_reason,
                    ':booked': 'BOOKED'
                }
            )
        except ClientError as exc:
            code = exc.response.get('Error', {}).get('Code')
            if code == 'ConditionalCheckFailedException':
                return _booking_state_conflict_response(event, 'declined', booking.get('state'))
            _LOG.error(f"Failed to decline booking edits: {exc}")
            return build_response(500, {'message': 'Failed to decline booking edits.'}, event=event)

    return build_response(200, {
        'message': 'Changes declined; booking has been canceled successfully',
        'state': 'CANCELED'
    }, event=event)