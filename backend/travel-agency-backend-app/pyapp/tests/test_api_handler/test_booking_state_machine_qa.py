import json
from datetime import date
from unittest.mock import patch

from botocore.exceptions import ClientError

from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase
from lambdas.api_handler import bookings
from lambdas.booking_status_updater import handler as status_updater


def _principal():
    return {
        "sub": "agent-1",
        "user_id": "agent-1",
        "email": "agent@example.com", 
        "role": "TRAVEL_AGENT",
        "groups": ["TRAVEL_AGENT"],
    }


def _booking(state="BOOKED", booking_id="booking-1"):
    return {
        "id": booking_id,
        "userId": "customer-1",
        "tourId": "tour-1",
        "state": state,
        "tourDetails": {
            "date": "2026-08-15 (7 days)",
            "mealPlan": "BB",
            "guests": "1 adults, 0 children",
            "totalPrice": "$1000",
            "documents": "0 items",
        },
        "travelAgent": {
            "email": "agent@example.com",
            "name": "Assigned Agent",
        },
    }


def _body(response):
    return json.loads(response["body"])


@patch("lambdas.api_handler.bookings.dynamodb")
class TestBookingStateMachineApi(ApiHandlerLambdaTestCase):
    def test_booked_transitions_to_confirmed(self, mock_dynamodb):
        table = mock_dynamodb.Table.return_value
        table.get_item.return_value = {
            "Item": _booking(state="BOOKED")
        }
        event = {
            "authenticatedUser": _principal(),
            "pathParameters": {"id": "booking-1"},
        }

        response = bookings.confirm_booking(event)

        assert response["statusCode"] == 200
        table.update_item.assert_called_once()
        update = table.update_item.call_args.kwargs
        assert update["ExpressionAttributeValues"] == {
            ":newstate": "CONFIRMED",
            ":booked": "BOOKED",
        }
        assert "#s = :booked" in update["ConditionExpression"]

    def test_confirm_rejects_every_non_booked_state(
        self,
        mock_dynamodb,
    ):
        table = mock_dynamodb.Table.return_value
        event = {
            "authenticatedUser": _principal(),
            "pathParameters": {"id": "booking-1"},
        }

        for state in (
            "CONFIRMED",
            "STARTED",
            "FINISHED",
            "CANCELED",
            "CANCELLED",
        ):
            with self.subTest(state=state):
                table.reset_mock()
                table.get_item.return_value = {
                    "Item": _booking(state=state)
                }

                response = bookings.confirm_booking(event)

                assert response["statusCode"] == 409
                payload = _body(response)
                assert payload["code"] == (
                    "BOOKING_STATE_CONFLICT"
                )
                assert payload["currentState"] == state
                table.update_item.assert_not_called()

    def test_confirm_maps_concurrent_state_change_to_conflict(
        self,
        mock_dynamodb,
    ):
        table = mock_dynamodb.Table.return_value
        table.get_item.return_value = {
            "Item": _booking(state="BOOKED")
        }
        table.update_item.side_effect = ClientError(
            {
                "Error": {
                    "Code": (
                        "ConditionalCheckFailedException"
                    ),
                    "Message": "state changed",
                }
            },
            "UpdateItem",
        )
        event = {
            "authenticatedUser": _principal(),
            "pathParameters": {"id": "booking-1"},
        }

        response = bookings.confirm_booking(event)

        assert response["statusCode"] == 409
        assert _body(response)["code"] == (
            "BOOKING_STATE_CONFLICT"
        )


@patch(
    "lambdas.booking_status_updater.handler.dynamodb"
)
class TestScheduledBookingStateMachine:
    def test_booked_and_confirmed_transition_to_started(
        self,
        mock_dynamodb,
    ):
        table = mock_dynamodb.Table.return_value
        table.scan.return_value = {
            "Items": [
                _booking("BOOKED", "booked"),
                _booking("CONFIRMED", "confirmed"),
            ]
        }

        result = status_updater.finish_completed_bookings(
            date(2026, 8, 16)
        )

        assert result["started_eligible"] == 2
        assert result["started_updated"] == 2
        assert result["finished_eligible"] == 0
        assert result["finished_updated"] == 0
        assert table.update_item.call_count == 2

        for call in table.update_item.call_args_list:
            values = call.kwargs[
                "ExpressionAttributeValues"
            ]
            assert values[":target"] == "STARTED"
            assert set(
                value
                for key, value in values.items()
                if key.startswith(":allowed")
            ) == {"BOOKED", "CONFIRMED"}

    def test_future_pending_booking_does_not_start_early(
        self,
        mock_dynamodb,
    ):
        table = mock_dynamodb.Table.return_value
        future = _booking("BOOKED")
        future["tourDetails"]["date"] = (
            "2026-09-15 (7 days)"
        )
        table.scan.return_value = {"Items": [future]}

        result = status_updater.finish_completed_bookings(
            date(2026, 8, 16)
        )

        assert result["started_eligible"] == 0
        assert result["started_updated"] == 0
        assert result["finished_updated"] == 0
        table.update_item.assert_not_called()

    def test_started_transitions_to_finished_at_end_date(
        self,
        mock_dynamodb,
    ):
        table = mock_dynamodb.Table.return_value
        started = _booking("STARTED")
        started["tourDetails"]["date"] = (
            "2026-08-09 (7 days)"
        )
        table.scan.return_value = {"Items": [started]}

        result = status_updater.finish_completed_bookings(
            date(2026, 8, 16)
        )

        assert result["finished_eligible"] == 1
        assert result["finished_updated"] == 1
        update = table.update_item.call_args.kwargs
        assert update["ExpressionAttributeValues"][
            ":target"
        ] == "FINISHED"

    def test_terminal_states_never_transition(
        self,
        mock_dynamodb,
    ):
        table = mock_dynamodb.Table.return_value
        table.scan.return_value = {
            "Items": [
                _booking("FINISHED", "finished"),
                _booking("CANCELED", "canceled"),
                _booking("CANCELLED", "cancelled"),
            ]
        }

        result = status_updater.finish_completed_bookings(
            date(2026, 8, 30)
        )

        assert result["inactive"] == 3
        assert result["started_updated"] == 0
        assert result["finished_updated"] == 0
        table.update_item.assert_not_called()
