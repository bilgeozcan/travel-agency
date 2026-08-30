import json
from unittest.mock import patch

from botocore.exceptions import ClientError

from pyapp.tests import ImportFromSourceContext

with ImportFromSourceContext():
    from lambdas.reports_handler import handler


def _sqs_record(message_id, body):
    return {
        "messageId": message_id,
        "body": json.dumps(body) if isinstance(body, dict) else body,
    }


def _booking_finished_event(**overrides):
    event = {
        "messageId": "evt-b123-BOOKING_FINISHED",
        "eventType": "BOOKING_FINISHED",
        "period": "2026-08-24",
        "bookingId": "b123",
        "travelAgent": {"email": "TA@Example.com ", "userId": "sub-xyz"},
        "destination": " Antalya, Turkey ",
        "revenue": 1200.5,
        "occurredAt": "2026-08-24T10:03:00Z",
    }
    event.update(overrides)
    return event


def _feedback_submitted_event(**overrides):
    event = {
        "messageId": "evt-b123-FEEDBACK_SUBMITTED",
        "eventType": "FEEDBACK_SUBMITTED",
        "period": "2026-08-24",
        "bookingId": "b123",
        "travelAgent": {"email": "ta@example.com"},
        "destination": "Antalya, Turkey",
        "rating": 4,
        "occurredAt": "2026-08-24T10:03:00Z",
    }
    event.update(overrides)
    return event


def _conditional_check_failed():
    return ClientError(
        {
            "Error": {
                "Code": "ConditionalCheckFailedException",
                "Message": "already processed",
            }
        },
        "UpdateItem",
    )


@patch("lambdas.reports_handler.handler.dynamodb")
def test_booking_finished_updates_both_report_rows(mock_dynamodb):
    table = mock_dynamodb.Table.return_value

    result = handler.lambda_handler(
        {"Records": [_sqs_record("m1", _booking_finished_event())]}, None
    )

    assert result == {"batchItemFailures": []}
    assert table.update_item.call_count == 2

    calls = table.update_item.call_args_list
    keys = [call.kwargs["Key"] for call in calls]
    assert keys == [
        {"period": "2026-08-24", "sortKey": "AGENT_PERFORMANCE#ta@example.com"},
        {"period": "2026-08-24", "sortKey": "SALES_STATISTICS#antalya, turkey"},
    ]

    for call in calls:
        values = call.kwargs["ExpressionAttributeValues"]
        assert values[":toursDelta"] == 1
        assert values[":revenueDelta"] == 1200.5
        assert values[":msgId"] == "evt-b123-BOOKING_FINISHED"
        assert "ADD" in call.kwargs["UpdateExpression"]
        assert "processedMessageIds :msgIdSet" in call.kwargs["UpdateExpression"]


@patch("lambdas.reports_handler.handler.dynamodb")
def test_feedback_submitted_increments_rating_bucket(mock_dynamodb):
    table = mock_dynamodb.Table.return_value

    handler.lambda_handler(
        {"Records": [_sqs_record("m1", _feedback_submitted_event(rating=4))]}, None
    )

    call = table.update_item.call_args_list[0]
    values = call.kwargs["ExpressionAttributeValues"]
    assert values[":rating4Count"] == 1
    assert "rating4Count :rating4Count" in call.kwargs["UpdateExpression"]
    assert ":toursDelta" not in values
    assert ":revenueDelta" not in values


@patch("lambdas.reports_handler.handler.dynamodb")
def test_feedback_updated_shifts_rating_buckets(mock_dynamodb):
    table = mock_dynamodb.Table.return_value

    handler.lambda_handler(
        {
            "Records": [
                _sqs_record(
                    "m1",
                    _feedback_submitted_event(
                        eventType="FEEDBACK_UPDATED",
                        messageId="evt-b123-FEEDBACK_UPDATED",
                        rating=5,
                        previousRating=2,
                    ),
                )
            ]
        },
        None,
    )

    call = table.update_item.call_args_list[0]
    values = call.kwargs["ExpressionAttributeValues"]
    assert values[":rating5Count"] == 1
    assert values[":rating2Count"] == -1


@patch("lambdas.reports_handler.handler.dynamodb")
def test_feedback_updated_same_rating_produces_no_rating_delta(mock_dynamodb):
    table = mock_dynamodb.Table.return_value

    handler.lambda_handler(
        {
            "Records": [
                _sqs_record(
                    "m1",
                    _feedback_submitted_event(
                        eventType="FEEDBACK_UPDATED",
                        messageId="evt-b123-FEEDBACK_UPDATED",
                        rating=3,
                        previousRating=3,
                    ),
                )
            ]
        },
        None,
    )

    call = table.update_item.call_args_list[0]
    assert "rating3Count" not in call.kwargs["UpdateExpression"]


@patch("lambdas.reports_handler.handler.dynamodb")
def test_already_processed_message_is_idempotently_skipped(mock_dynamodb):
    table = mock_dynamodb.Table.return_value
    table.update_item.side_effect = _conditional_check_failed()

    result = handler.lambda_handler(
        {"Records": [_sqs_record("m1", _booking_finished_event())]}, None
    )

    assert result == {"batchItemFailures": []}


@patch("lambdas.reports_handler.handler.dynamodb")
def test_second_row_failure_reports_message_as_batch_item_failure(mock_dynamodb):
    """If the AGENT_PERFORMANCE row update succeeds but the SALES_STATISTICS
    row update fails with something other than the idempotency conditional
    check, the failure must NOT be swallowed: the message has to come back
    as a batch item failure so SQS redelivers it (the first row's own
    idempotency guard makes that redelivery safe)."""
    table = mock_dynamodb.Table.return_value
    table.update_item.side_effect = [
        None,
        ClientError(
            {"Error": {"Code": "ProvisionedThroughputExceededException"}},
            "UpdateItem",
        ),
    ]

    result = handler.lambda_handler(
        {"Records": [_sqs_record("m1", _booking_finished_event())]}, None
    )

    assert result == {
        "batchItemFailures": [{"itemIdentifier": "m1"}]
    }
    assert table.update_item.call_count == 2


@patch("lambdas.reports_handler.handler.dynamodb")
def test_malformed_message_is_reported_as_batch_item_failure_not_dropped(
    mock_dynamodb,
):
    result = handler.lambda_handler(
        {"Records": [_sqs_record("m1", "{not-json")]}, None
    )

    assert result == {"batchItemFailures": [{"itemIdentifier": "m1"}]}


@patch("lambdas.reports_handler.handler.dynamodb")
def test_missing_revenue_on_booking_finished_fails_that_message_only(
    mock_dynamodb,
):
    table = mock_dynamodb.Table.return_value

    result = handler.lambda_handler(
        {
            "Records": [
                _sqs_record("bad", _booking_finished_event(revenue=None)),
                _sqs_record("good", _booking_finished_event(messageId="evt-good")),
            ]
        },
        None,
    )

    assert result == {"batchItemFailures": [{"itemIdentifier": "bad"}]}
    assert table.update_item.call_count == 2


@patch("lambdas.reports_handler.handler.dynamodb")
def test_batch_of_multiple_records_processes_independently(mock_dynamodb):
    table = mock_dynamodb.Table.return_value

    result = handler.lambda_handler(
        {
            "Records": [
                _sqs_record(
                    "m1",
                    _booking_finished_event(
                        messageId="evt-b1", bookingId="b1"
                    ),
                ),
                _sqs_record(
                    "m2",
                    _feedback_submitted_event(
                        messageId="evt-b2", bookingId="b2"
                    ),
                ),
            ]
        },
        None,
    )

    assert result == {"batchItemFailures": []}
    assert table.update_item.call_count == 4
