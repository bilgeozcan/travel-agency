import json
import os
import re
from datetime import date, datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError

from commons.log_helper import get_logger

_LOG = get_logger(__name__)
_REGION = os.environ.get("region", "eu-west-3")
_BOOKINGS_TABLE = os.environ.get("bookings_table")
_REPORTS_QUEUE_URL = os.environ.get("reports_queue_url")

_PENDING_STATES = frozenset({"BOOKED", "CONFIRMED"})
_ACTIVE_STATES = frozenset({"BOOKED", "CONFIRMED", "STARTED"})
_DATE_PATTERN = re.compile(r"(?P<date>\d{4}-\d{2}-\d{2})")
_DURATION_PATTERN = re.compile(
    r"(?P<days>\d+)\s+days?",
    re.IGNORECASE,
)
_DIGITS_PATTERN = re.compile(r"\d+")

dynamodb = boto3.resource("dynamodb", region_name=_REGION)
sqs = boto3.client("sqs", region_name=_REGION)


def _normalize_state(value):
    return str(value or "").strip().upper()


def _parse_start_date(booking):
    details = booking.get("tourDetails") or {}
    if not isinstance(details, dict):
        details = {}

    raw = (
        booking.get("startDate")
        or details.get("startDate")
        or details.get("date")
        or ""
    )
    match = _DATE_PATTERN.search(str(raw))
    if not match:
        return None

    try:
        return datetime.strptime(
            match.group("date"),
            "%Y-%m-%d",
        ).date()
    except ValueError:
        return None


def _parse_duration_days(booking):
    details = booking.get("tourDetails") or {}
    if not isinstance(details, dict):
        details = {}

    raw = (
        booking.get("duration")
        or details.get("duration")
        or details.get("date")
        or ""
    )
    match = _DURATION_PATTERN.search(str(raw))
    if not match:
        return None

    days = int(match.group("days"))
    return days if days > 0 else None


def _tour_end_date(booking):
    start_date = _parse_start_date(booking)
    duration_days = _parse_duration_days(booking)

    if start_date is None or duration_days is None:
        return None

    return start_date + timedelta(days=duration_days)


def _scan_all_bookings(table):
    items = []
    scan_kwargs = {
        "ProjectionExpression": (
            "id, #state, tourDetails, startDate, #duration, "
            "travelAgent, destination"
        ),
        "ExpressionAttributeNames": {
            "#state": "state",
            "#duration": "duration",
        },
    }

    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get("Items", []))

        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break

        scan_kwargs["ExclusiveStartKey"] = last_key

    return items


def _conditional_state_transition(
    table, booking_id, allowed_states, target_state
):
    allowed_states = list(allowed_states)
    condition = " OR ".join(
        f"#state = :allowed{i}"
        for i in range(len(allowed_states))
    )
    values = {
        f":allowed{i}": allowed_state
        for i, allowed_state in enumerate(allowed_states)
    }
    values[":target"] = target_state

    table.update_item(
        Key={"id": booking_id},
        UpdateExpression="SET #state = :target",
        ConditionExpression=(
            f"attribute_exists(id) AND ({condition})"
        ),
        ExpressionAttributeNames={"#state": "state"},
        ExpressionAttributeValues=values,
    )


def _period_for(dt):
    """ISO week start (Monday), YYYY-MM-DD -- matches reports_handler's 'period'."""
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime("%Y-%m-%d")


def _parse_revenue(total_price):
    """tourDetails.totalPrice is a formatted string like "$1400"."""
    digits = _DIGITS_PATTERN.findall(str(total_price or ""))
    if not digits:
        return None
    return int("".join(digits))


def _publish_booking_finished(booking):
    """Publish a BOOKING_FINISHED event for reports_handler (EPMTPETA-12598).

    Never raises: a publish failure must not affect the booking's state,
    which has already been committed by the time this is called, and must
    not stop the scan from finishing the rest of the batch.
    """
    if not _REPORTS_QUEUE_URL:
        _LOG.warning(
            "reports_queue_url is not configured, skipping "
            "BOOKING_FINISHED publish for booking %s",
            booking.get("id"),
        )
        return

    booking_id = booking.get("id")
    travel_agent = booking.get("travelAgent") or {}
    agent_email = (
        travel_agent.get("email")
        if isinstance(travel_agent, dict)
        else None
    )
    destination = booking.get("destination")
    revenue = _parse_revenue(
        (booking.get("tourDetails") or {}).get("totalPrice")
    )

    if not agent_email or not destination or revenue is None:
        _LOG.warning(
            (
                "Booking %s is missing travelAgent.email/destination/"
                "revenue, skipping BOOKING_FINISHED publish"
            ),
            booking_id,
        )
        return

    now = datetime.now(timezone.utc)
    message = {
        "messageId": f"evt-{booking_id}-BOOKING_FINISHED",
        "eventType": "BOOKING_FINISHED",
        "period": _period_for(now),
        "bookingId": booking_id,
        "travelAgent": {
            "email": agent_email,
            "userId": travel_agent.get("userId"),
        },
        "destination": destination,
        "revenue": revenue,
        "occurredAt": now.isoformat(),
    }

    try:
        sqs.send_message(
            QueueUrl=_REPORTS_QUEUE_URL,
            MessageBody=json.dumps(message),
        )
    except Exception:
        _LOG.exception(
            "Failed to publish BOOKING_FINISHED for booking %s",
            booking_id,
        )


def finish_completed_bookings(as_of_date=None):
    effective_date = (
        as_of_date
        or datetime.now(timezone.utc).date()
    )

    if not isinstance(effective_date, date):
        raise TypeError(
            "as_of_date must be a datetime.date"
        )

    table = dynamodb.Table(_BOOKINGS_TABLE)
    bookings = _scan_all_bookings(table)

    summary = {
        "scanned": len(bookings),
        "inactive": 0,
        "invalid": 0,
        "started_eligible": 0,
        "started_updated": 0,
        "started_conflict": 0,
        "finished_eligible": 0,
        "finished_updated": 0,
        "finished_conflict": 0,
    }
    failures = []

    for booking in bookings:
        state = _normalize_state(booking.get("state"))
        booking_id = booking.get("id")

        if state not in _ACTIVE_STATES:
            summary["inactive"] += 1
            continue

        if not booking_id:
            summary["invalid"] += 1
            failures.append("<missing-id>")
            continue

        # Check 1: BOOKED/CONFIRMED -> STARTED once the start date arrives.
        if state in _PENDING_STATES:
            start_date = _parse_start_date(booking)

            if start_date is None:
                summary["invalid"] += 1
                _LOG.warning(
                    (
                        "Skipping booking %s because its "
                        "start date is invalid"
                    ),
                    booking_id,
                )
                continue

            if start_date <= effective_date:
                summary["started_eligible"] += 1
                try:
                    _conditional_state_transition(
                        table,
                        booking_id,
                        _PENDING_STATES,
                        "STARTED",
                    )
                    summary["started_updated"] += 1
                    state = "STARTED"
                except ClientError as exc:
                    code = (
                        exc.response
                        .get("Error", {})
                        .get("Code")
                    )

                    if (
                        code
                        == "ConditionalCheckFailedException"
                    ):
                        summary["started_conflict"] += 1
                        _LOG.info(
                            (
                                "Booking %s was already "
                                "changed by another process"
                            ),
                            booking_id,
                        )
                        continue

                    failures.append(str(booking_id))
                    _LOG.exception(
                        "Failed to start booking %s",
                        booking_id,
                    )
                    continue

        # Check 2: STARTED (or still active) -> FINISHED once the tour ends.
        end_date = _tour_end_date(booking)

        if end_date is None:
            summary["invalid"] += 1
            _LOG.warning(
                (
                    "Skipping booking %s because its "
                    "tour date or duration is invalid"
                ),
                booking_id,
            )
            continue

        if end_date > effective_date:
            continue

        summary["finished_eligible"] += 1

        try:
            _conditional_state_transition(
                table,
                booking_id,
                _ACTIVE_STATES,
                "FINISHED",
            )
            summary["finished_updated"] += 1
            _publish_booking_finished(booking)

        except ClientError as exc:
            code = (
                exc.response
                .get("Error", {})
                .get("Code")
            )

            if code == "ConditionalCheckFailedException":
                summary["finished_conflict"] += 1
                _LOG.info(
                    (
                        "Booking %s was already changed "
                        "by another process"
                    ),
                    booking_id,
                )
                continue

            failures.append(str(booking_id))
            _LOG.exception(
                "Failed to finish booking %s",
                booking_id,
            )

    if failures:
        raise RuntimeError(
            "Failed to update completed bookings: "
            + ", ".join(failures)
        )

    _LOG.info(
        "Completed booking status update: %s",
        summary,
    )
    return summary


def lambda_handler(event, context):
    return finish_completed_bookings()
