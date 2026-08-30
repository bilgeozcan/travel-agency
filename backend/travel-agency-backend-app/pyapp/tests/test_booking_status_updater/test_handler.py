import json
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

import pytest
from botocore.exceptions import ClientError

from pyapp.tests import ImportFromSourceContext

with ImportFromSourceContext():
    from lambdas.booking_status_updater import handler


def _booking(
    booking_id,
    state="STARTED",
    date_value="2026-07-20 (7 days)",
    travel_agent=None,
    destination="Antalya, Turkey",
    total_price="$1400",
):
    return {
        "id": booking_id,
        "state": state,
        "tourDetails": {
            "date": date_value,
            "totalPrice": total_price,
        },
        "travelAgent": (
            travel_agent
            if travel_agent is not None
            else {"email": "agent@travelco.com", "userId": "sub-1"}
        ),
        "destination": destination,
    }


@patch(
    "lambdas.booking_status_updater.handler.dynamodb"
)
def test_updates_only_completed_active_bookings(
    mock_dynamodb,
):
    table = mock_dynamodb.Table.return_value
    table.scan.return_value = {
        "Items": [
            _booking("booked", "BOOKED"),
            _booking("confirmed", "CONFIRMED"),
            _booking("started", "STARTED"),
            _booking(
                "future",
                "STARTED",
                "2026-08-01 (7 days)",
            ),
            _booking("finished", "FINISHED"),
            _booking("canceled", "CANCELED"),
            _booking("cancelled", "CANCELLED"),
            _booking(
                "invalid",
                "STARTED",
                "not-a-date",
            ),
        ]
    }

    result = handler.finish_completed_bookings(
        date(2026, 7, 30)
    )

    assert result == {
        "scanned": 8,
        "inactive": 3,
        "invalid": 1,
        "started_eligible": 2,
        "started_updated": 2,
        "started_conflict": 0,
        "finished_eligible": 3,
        "finished_updated": 3,
        "finished_conflict": 0,
    }

    calls = table.update_item.call_args_list
    updated_ids = [
        call.kwargs["Key"]["id"] for call in calls
    ]
    assert updated_ids == [
        "booked",
        "booked",
        "confirmed",
        "confirmed",
        "started",
    ]

    targets = [
        call.kwargs["ExpressionAttributeValues"][
            ":target"
        ]
        for call in calls
    ]
    assert targets == [
        "STARTED",
        "FINISHED",
        "STARTED",
        "FINISHED",
        "FINISHED",
    ]


@patch(
    "lambdas.booking_status_updater.handler.dynamodb"
)
def test_end_date_reached_is_eligible(
    mock_dynamodb,
):
    table = mock_dynamodb.Table.return_value
    table.scan.return_value = {
        "Items": [
            _booking(
                "booking-1",
                date_value="2026-07-23 (7 days)",
            )
        ]
    }

    result = handler.finish_completed_bookings(
        date(2026, 7, 30)
    )

    assert result["finished_updated"] == 1


@patch(
    "lambdas.booking_status_updater.handler.dynamodb"
)
def test_scans_all_pages(mock_dynamodb):
    table = mock_dynamodb.Table.return_value
    table.scan.side_effect = [
        {
            "Items": [_booking("first")],
            "LastEvaluatedKey": {
                "id": "first",
            },
        },
        {
            "Items": [_booking("second")],
        },
    ]

    result = handler.finish_completed_bookings(
        date(2026, 7, 30)
    )

    assert result["finished_updated"] == 2

    table.scan.assert_any_call(
        ProjectionExpression=(
            "id, #state, tourDetails, startDate, #duration, "
            "travelAgent, destination"
        ),
        ExpressionAttributeNames={
            "#state": "state",
            "#duration": "duration",
        },
        ExclusiveStartKey={
            "id": "first",
        },
    )


@patch(
    "lambdas.booking_status_updater.handler.dynamodb"
)
def test_conditional_conflict_is_idempotently_skipped(
    mock_dynamodb,
):
    table = mock_dynamodb.Table.return_value
    table.scan.return_value = {
        "Items": [_booking("booking-1")]
    }
    table.update_item.side_effect = ClientError(
        {
            "Error": {
                "Code": (
                    "ConditionalCheckFailedException"
                ),
                "Message": "changed",
            }
        },
        "UpdateItem",
    )

    result = handler.finish_completed_bookings(
        date(2026, 7, 30)
    )

    assert result["finished_eligible"] == 1
    assert result["finished_updated"] == 0
    assert result["finished_conflict"] == 1


@patch(
    "lambdas.booking_status_updater.handler.dynamodb"
)
def test_conditional_conflict_on_start_skips_finish_check(
    mock_dynamodb,
):
    table = mock_dynamodb.Table.return_value
    table.scan.return_value = {
        "Items": [
            _booking(
                "booking-1",
                "BOOKED",
                "2026-07-20 (7 days)",
            )
        ]
    }
    table.update_item.side_effect = ClientError(
        {
            "Error": {
                "Code": (
                    "ConditionalCheckFailedException"
                ),
                "Message": "changed",
            }
        },
        "UpdateItem",
    )

    result = handler.finish_completed_bookings(
        date(2026, 7, 30)
    )

    assert result["started_eligible"] == 1
    assert result["started_updated"] == 0
    assert result["started_conflict"] == 1
    assert result["finished_eligible"] == 0
    assert table.update_item.call_count == 1


@patch(
    "lambdas.booking_status_updater.handler.dynamodb"
)
def test_transient_update_failure_fails_invocation(
    mock_dynamodb,
):
    table = mock_dynamodb.Table.return_value
    table.scan.return_value = {
        "Items": [_booking("booking-1")]
    }
    table.update_item.side_effect = ClientError(
        {
            "Error": {
                "Code": (
                    "ProvisionedThroughputExceededException"
                ),
                "Message": "retry",
            }
        },
        "UpdateItem",
    )

    with pytest.raises(
        RuntimeError,
        match="booking-1",
    ):
        handler.finish_completed_bookings(
            date(2026, 7, 30)
        )


_REPORTS_QUEUE_URL = (
    "https://sqs.eu-west-3.amazonaws.com/364410974634/reports_queue"
)


@patch("lambdas.booking_status_updater.handler.sqs")
@patch("lambdas.booking_status_updater.handler.dynamodb")
@patch(
    "lambdas.booking_status_updater.handler._REPORTS_QUEUE_URL",
    _REPORTS_QUEUE_URL,
)
def test_publishes_booking_finished_on_completion(
    mock_dynamodb, mock_sqs
):
    table = mock_dynamodb.Table.return_value
    table.scan.return_value = {
        "Items": [_booking("booking-1")]
    }

    handler.finish_completed_bookings(date(2026, 7, 30))

    mock_sqs.send_message.assert_called_once()
    call_kwargs = mock_sqs.send_message.call_args.kwargs
    assert call_kwargs["QueueUrl"] == _REPORTS_QUEUE_URL

    body = json.loads(call_kwargs["MessageBody"])
    assert body["messageId"] == "evt-booking-1-BOOKING_FINISHED"
    assert body["eventType"] == "BOOKING_FINISHED"
    assert body["bookingId"] == "booking-1"
    assert body["travelAgent"] == {
        "email": "agent@travelco.com",
        "userId": "sub-1",
    }
    assert body["destination"] == "Antalya, Turkey"
    assert body["revenue"] == 1400


@patch("lambdas.booking_status_updater.handler.sqs")
@patch("lambdas.booking_status_updater.handler.dynamodb")
@patch(
    "lambdas.booking_status_updater.handler._REPORTS_QUEUE_URL",
    _REPORTS_QUEUE_URL,
)
def test_publish_failure_does_not_fail_the_batch(
    mock_dynamodb, mock_sqs
):
    """The booking's own state transition already committed by the time we
    publish -- a broken publish must be logged, not raised, so it can never
    look like the booking itself failed to update."""
    table = mock_dynamodb.Table.return_value
    table.scan.return_value = {
        "Items": [_booking("booking-1")]
    }
    mock_sqs.send_message.side_effect = Exception("SQS is down")

    result = handler.finish_completed_bookings(date(2026, 7, 30))

    assert result["finished_updated"] == 1


@patch("lambdas.booking_status_updater.handler.sqs")
@patch("lambdas.booking_status_updater.handler.dynamodb")
@patch(
    "lambdas.booking_status_updater.handler._REPORTS_QUEUE_URL",
    None,
)
def test_publish_skipped_when_queue_url_not_configured(
    mock_dynamodb, mock_sqs
):
    table = mock_dynamodb.Table.return_value
    table.scan.return_value = {
        "Items": [_booking("booking-1")]
    }

    result = handler.finish_completed_bookings(date(2026, 7, 30))

    assert result["finished_updated"] == 1
    mock_sqs.send_message.assert_not_called()


@patch("lambdas.booking_status_updater.handler.sqs")
@patch("lambdas.booking_status_updater.handler.dynamodb")
@patch(
    "lambdas.booking_status_updater.handler._REPORTS_QUEUE_URL",
    _REPORTS_QUEUE_URL,
)
def test_publish_skipped_when_travel_agent_missing(
    mock_dynamodb, mock_sqs
):
    table = mock_dynamodb.Table.return_value
    table.scan.return_value = {
        "Items": [_booking("booking-1", travel_agent={})]
    }

    result = handler.finish_completed_bookings(date(2026, 7, 30))

    assert result["finished_updated"] == 1
    mock_sqs.send_message.assert_not_called()


@pytest.mark.parametrize(
    "total_price,expected",
    [
        ("$1400", 1400),
        ("$0", 0),
        (None, None),
        ("", None),
    ],
)
def test_parse_revenue(total_price, expected):
    assert handler._parse_revenue(total_price) == expected


def test_period_for_returns_iso_week_monday():
    # 2026-08-24 is a Monday; 2026-08-27 falls in the same ISO week.
    assert (
        handler._period_for(datetime(2026, 8, 27, 15, 0))
        == "2026-08-24"
    )


def test_reports_queue_wired_into_booking_status_updater():
    project_root = Path(__file__).resolve().parents[3]
    root_resources = json.loads(
        (project_root / "deployment_resources.json").read_text()
    )
    lambda_config = json.loads(
        (
            project_root
            / "pyapp"
            / "src"
            / "lambdas"
            / "booking_status_updater"
            / "lambda_config.json"
        ).read_text()
    )

    statement = root_resources["booking-status-updater-policy"][
        "policy_content"
    ]["Statement"][0]
    assert "sqs:SendMessage" in statement["Action"]

    assert {
        "resource_name": "${reports_queue}",
        "resource_type": "sqs_queue",
    } in lambda_config["dependencies"]
    assert "reports_queue_url" in lambda_config["env_variables"]


def test_parses_explicit_booking_date_fields():
    booking = {
        "startDate": "2026-07-01",
        "duration": "10 days",
        "tourDetails": {},
    }

    assert handler._tour_end_date(booking) == date(
        2026,
        7,
        11,
    )


def test_schedule_permissions_and_cleanup_metadata():
    project_root = (
        Path(__file__).resolve().parents[3]
    )
    root_resources = json.loads(
        (
            project_root
            / "deployment_resources.json"
        ).read_text()
    )
    lambda_dir = (
        project_root
        / "pyapp"
        / "src"
        / "lambdas"
        / "booking_status_updater"
    )
    lambda_config = json.loads(
        (
            lambda_dir
            / "lambda_config.json"
        ).read_text()
    )
    role_config = json.loads(
        (
            lambda_dir
            / "deployment_resources.json"
        ).read_text()
    )

    schedule = root_resources[
        "booking-completion-schedule"
    ]
    assert (
        schedule["resource_type"]
        == "eventbridge_rule"
    )
    assert schedule["rule_type"] == "schedule"
    assert (
        schedule["expression"]
        == "cron(5 0 * * ? *)"
    )

    statement = root_resources[
        "booking-status-updater-policy"
    ]["policy_content"]["Statement"][0]
    assert "dynamodb:Scan" in statement["Action"]
    assert (
        "dynamodb:UpdateItem"
        in statement["Action"]
    )

    role = role_config[
        "booking-status-updater-role"
    ]
    assert role["custom_policies"] == [
        "booking-status-updater-policy"
    ]

    trigger = {
        "resource_type": (
            "eventbridge_rule_trigger"
        ),
        "target_rule": (
            "booking-completion-schedule"
        ),
        "input": {
            "source": "EPMTPETA-11673",
            "action": (
                "finish-completed-bookings"
            ),
        },
    }
    assert trigger in lambda_config["event_sources"]

    dependency = {
        "resource_name": (
            "booking-completion-schedule"
        ),
        "resource_type": "eventbridge_rule",
    }
    assert dependency in lambda_config[
        "dependencies"
    ]
