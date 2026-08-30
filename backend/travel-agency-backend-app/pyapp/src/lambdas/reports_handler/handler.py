"""Reports Handler Lambda.

Consumes booking/feedback domain events from ``reports_queue`` (SQS) and
incrementally aggregates them into ``reports_table`` rows, one row per
(period, reportType, groupKey). Two report types are maintained per event:

- ``AGENT_PERFORMANCE``, grouped by the travel agent's email.
- ``SALES_STATISTICS``, grouped by the (normalized) tour destination.

Both report types carry the same feedback-rate metrics, scoped to their own
groupKey. Rating counts are kept as five separate counters (rating1Count..
rating5Count) rather than a running sum/min, because ratings are bounded to
1-5: this lets both the average and the minimum be recomputed exactly by the
Reports Sender Lambda even after a feedback is edited (FEEDBACK_UPDATED),
which a plain running-min could not do if the previous minimum is edited
upward.

Producers (bookings.py, feedback.py, booking_status_updater) are out of
scope for this ticket (EPMTPETA-12598) -- this Lambda only consumes.
"""

import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

from commons.log_helper import get_logger

_LOG = get_logger(__name__)
_REGION = os.environ.get("region", "eu-west-3")
_REPORTS_TABLE = os.environ.get("reports_table")

_VALID_RATINGS = frozenset({1, 2, 3, 4, 5})
_EVENT_TYPES = frozenset(
    {"BOOKING_FINISHED", "FEEDBACK_SUBMITTED", "FEEDBACK_UPDATED"}
)
_REPORT_TYPES = ("AGENT_PERFORMANCE", "SALES_STATISTICS")

dynamodb = boto3.resource("dynamodb", region_name=_REGION)


class InvalidReportEvent(Exception):
    """A reports_queue message could not be turned into report updates.

    Not retried differently from any other failure -- it still counts as a
    batch item failure so the message is redelivered and eventually lands in
    the DLQ (maxReceiveCount=3) where a malformed producer payload can
    actually be inspected, instead of being silently dropped.
    """


def _normalize_group_key(value):
    return str(value or "").strip().lower()


def _parse_message(body):
    try:
        payload = json.loads(body)
    except (TypeError, ValueError) as exc:
        raise InvalidReportEvent(
            f"Message body is not valid JSON: {exc}"
        ) from exc

    if not isinstance(payload, dict):
        raise InvalidReportEvent("Message body must be a JSON object")

    message_id = payload.get("messageId")
    event_type = payload.get("eventType")
    period = payload.get("period")

    if not message_id or not isinstance(message_id, str):
        raise InvalidReportEvent("messageId is required")
    if event_type not in _EVENT_TYPES:
        raise InvalidReportEvent(f"Unsupported eventType: {event_type!r}")
    if not period or not isinstance(period, str):
        raise InvalidReportEvent("period is required")

    return payload, event_type, message_id, period


def _rating_bucket_deltas(rating, sign):
    if rating is None:
        return {}
    try:
        rating = int(rating)
    except (TypeError, ValueError) as exc:
        raise InvalidReportEvent(f"rating must be an integer, got {rating!r}") from exc
    if rating not in _VALID_RATINGS:
        raise InvalidReportEvent(f"rating must be 1-5, got {rating}")
    return {f"rating{rating}Count": sign}


def _merge_deltas(*delta_maps):
    merged = {}
    for delta_map in delta_maps:
        for attr, delta in delta_map.items():
            merged[attr] = merged.get(attr, 0) + delta
    return {attr: delta for attr, delta in merged.items() if delta != 0}


def _resolve_updates(payload, event_type):
    """Return (tours_delta, revenue_delta, rating_deltas) for one event."""
    if event_type == "BOOKING_FINISHED":
        revenue = payload.get("revenue")
        if revenue is None:
            raise InvalidReportEvent("revenue is required for BOOKING_FINISHED")
        return 1, revenue, {}

    if event_type == "FEEDBACK_SUBMITTED":
        rating_deltas = _rating_bucket_deltas(payload.get("rating"), sign=1)
        if not rating_deltas:
            raise InvalidReportEvent("rating is required for FEEDBACK_SUBMITTED")
        return 0, None, rating_deltas

    if event_type == "FEEDBACK_UPDATED":
        new_deltas = _rating_bucket_deltas(payload.get("rating"), sign=1)
        old_deltas = _rating_bucket_deltas(payload.get("previousRating"), sign=-1)
        if not new_deltas or not old_deltas:
            raise InvalidReportEvent(
                "rating and previousRating are required for FEEDBACK_UPDATED"
            )
        return 0, None, _merge_deltas(new_deltas, old_deltas)

    raise InvalidReportEvent(f"Unsupported eventType: {event_type!r}")


def _apply_update(
    table,
    *,
    period,
    report_type,
    group_key,
    message_id,
    tours_delta,
    revenue_delta,
    rating_deltas,
):
    group_key = _normalize_group_key(group_key)
    if not group_key:
        raise InvalidReportEvent(f"groupKey is required for {report_type}")

    sort_key = f"{report_type}#{group_key}"

    set_actions = ["reportType = :reportType", "groupKey = :groupKey", "updatedAt = :updatedAt"]
    add_actions = ["processedMessageIds :msgIdSet"]
    values = {
        ":msgId": message_id,
        ":msgIdSet": {message_id},
        ":reportType": report_type,
        ":groupKey": group_key,
        ":updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    if tours_delta:
        add_actions.append("toursCount :toursDelta")
        values[":toursDelta"] = tours_delta

    if revenue_delta is not None:
        add_actions.append("revenue :revenueDelta")
        values[":revenueDelta"] = Decimal(str(revenue_delta))

    for attr, delta in rating_deltas.items():
        placeholder = f":{attr}"
        add_actions.append(f"{attr} {placeholder}")
        values[placeholder] = delta

    update_expression = (
        "SET " + ", ".join(set_actions) + " ADD " + ", ".join(add_actions)
    )

    try:
        table.update_item(
            Key={"period": period, "sortKey": sort_key},
            UpdateExpression=update_expression,
            ConditionExpression="NOT contains(processedMessageIds, :msgId)",
            ExpressionAttributeValues=values,
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            _LOG.info(
                "Skipping already-processed message %s for %s#%s",
                message_id, period, sort_key,
            )
            return
        raise


def _process_message_body(body, table):
    payload, event_type, message_id, period = _parse_message(body)
    tours_delta, revenue_delta, rating_deltas = _resolve_updates(payload, event_type)

    travel_agent = payload.get("travelAgent") or {}
    agent_group_key = travel_agent.get("email") if isinstance(travel_agent, dict) else None
    destination_group_key = payload.get("destination")

    if not agent_group_key:
        raise InvalidReportEvent("travelAgent.email is required")
    if not destination_group_key:
        raise InvalidReportEvent("destination is required")

    for report_type, group_key in (
        ("AGENT_PERFORMANCE", agent_group_key),
        ("SALES_STATISTICS", destination_group_key),
    ):
        _apply_update(
            table,
            period=period,
            report_type=report_type,
            group_key=group_key,
            message_id=message_id,
            tours_delta=tours_delta,
            revenue_delta=revenue_delta,
            rating_deltas=rating_deltas,
        )


def lambda_handler(event, context):
    table = dynamodb.Table(_REPORTS_TABLE)
    batch_item_failures = []

    for record in event.get("Records", []):
        message_id = record.get("messageId")
        try:
            _process_message_body(record.get("body", ""), table)
        except Exception:
            _LOG.exception(
                "Failed to process reports_queue message %s", message_id
            )
            batch_item_failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": batch_item_failures}
