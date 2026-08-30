import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from botocore.exceptions import ClientError

from pyapp.tests import ImportFromSourceContext

with ImportFromSourceContext():
    from lambdas.reports_sender import handler

_SENDER_EMAIL = "ahmetfaruk_bilgin@epam.com"
_RECIPIENT_EMAIL = "ahmetfarukbilgin5@gmail.com"
_USER_POOL_ID = "eu-west-3_testpool"


def _patch_config(cls):
    cls = patch("lambdas.reports_sender.handler._SENDER_EMAIL", _SENDER_EMAIL)(cls)
    cls = patch("lambdas.reports_sender.handler._RECIPIENT_EMAIL", _RECIPIENT_EMAIL)(cls)
    cls = patch("lambdas.reports_sender.handler._USER_POOL_ID", _USER_POOL_ID)(cls)
    return cls


def _cognito_user(given_name="Ada", family_name="Lovelace"):
    return {
        "UserAttributes": [
            {"Name": "email", "Value": "ta@example.com"},
            {"Name": "given_name", "Value": given_name},
            {"Name": "family_name", "Value": family_name},
        ]
    }


def _report_item(group_key, tours=1, revenue=1000, ratings=None):
    item = {"groupKey": group_key, "toursCount": tours, "revenue": revenue}
    for n in range(1, 6):
        item[f"rating{n}Count"] = (ratings or {}).get(n, 0)
    return item


class CompletedWeekStartTestCase(unittest.TestCase):
    def test_wednesday_resolves_to_monday_of_previous_week(self):
        reference = datetime(2026, 8, 26, tzinfo=timezone.utc)  # Wednesday
        self.assertEqual(
            handler._completed_week_start(reference).isoformat(), "2026-08-17"
        )

    def test_monday_resolves_to_monday_of_previous_week(self):
        reference = datetime(2026, 8, 24, tzinfo=timezone.utc)  # Monday
        self.assertEqual(
            handler._completed_week_start(reference).isoformat(), "2026-08-17"
        )


class PctDeltaTestCase(unittest.TestCase):
    def test_normal_growth(self):
        self.assertEqual(handler._pct_delta(150, 100), "50.0%")

    def test_normal_decline(self):
        self.assertEqual(handler._pct_delta(50, 100), "-50.0%")

    def test_zero_previous_is_not_a_number(self):
        self.assertEqual(handler._pct_delta(10, 0), "N/A")

    def test_missing_previous_is_not_a_number(self):
        self.assertEqual(handler._pct_delta(10, None), "N/A")


class RatingStatsTestCase(unittest.TestCase):
    def test_computes_average_and_minimum(self):
        item = _report_item("ta@example.com", ratings={5: 2, 3: 1})
        average, minimum = handler._rating_stats(item)
        self.assertEqual(average, 4.33)
        self.assertEqual(minimum, 3)

    def test_no_ratings_returns_zeros(self):
        item = _report_item("ta@example.com")
        self.assertEqual(handler._rating_stats(item), (0.0, 0))


class QueryReportRowsTestCase(unittest.TestCase):
    def test_queries_by_period_and_report_type_prefix(self):
        table = self._make_table()

        handler._query_report_rows(table, "2026-08-17", "AGENT_PERFORMANCE")

        table.query.assert_called_once_with(
            KeyConditionExpression="period = :p AND begins_with(sortKey, :prefix)",
            ExpressionAttributeValues={
                ":p": "2026-08-17", ":prefix": "AGENT_PERFORMANCE#"
            },
        )

    @staticmethod
    def _make_table():
        from unittest.mock import MagicMock

        table = MagicMock()
        table.query.return_value = {"Items": []}
        return table


@_patch_config
class LookupTaNameTestCase(unittest.TestCase):
    @patch("lambdas.reports_sender.handler.cognito")
    def test_returns_full_name_on_success(self, mock_cognito):
        mock_cognito.admin_get_user.return_value = _cognito_user()
        self.assertEqual(handler._lookup_ta_name("ta@example.com"), "Ada Lovelace")
        mock_cognito.admin_get_user.assert_called_once_with(
            UserPoolId=_USER_POOL_ID, Username="ta@example.com"
        )

    @patch("lambdas.reports_sender.handler.cognito")
    def test_falls_back_to_na_on_client_error(self, mock_cognito):
        mock_cognito.admin_get_user.side_effect = ClientError(
            {"Error": {"Code": "UserNotFoundException"}}, "AdminGetUser"
        )
        self.assertEqual(handler._lookup_ta_name("ghost@example.com"), "N/A")

    @patch("lambdas.reports_sender.handler.cognito")
    def test_falls_back_to_na_when_names_are_blank(self, mock_cognito):
        mock_cognito.admin_get_user.return_value = _cognito_user(
            given_name="", family_name=""
        )
        self.assertEqual(handler._lookup_ta_name("ta@example.com"), "N/A")


class LookupTaNameWithoutUserPoolTestCase(unittest.TestCase):
    @patch("lambdas.reports_sender.handler._USER_POOL_ID", None)
    def test_returns_na_without_user_pool_configured(self):
        self.assertEqual(handler._lookup_ta_name("ta@example.com"), "N/A")


@_patch_config
class BuildRowsTestCase(unittest.TestCase):
    @patch("lambdas.reports_sender.handler.cognito")
    def test_agent_performance_row_includes_looked_up_name_and_deltas(
        self, mock_cognito
    ):
        mock_cognito.admin_get_user.return_value = _cognito_user()
        current = [_report_item("ta@example.com", tours=10, revenue=2000, ratings={5: 2})]
        previous_by_group = {
            "ta@example.com": _report_item(
                "ta@example.com", tours=5, revenue=1000, ratings={4: 1}
            )
        }

        rows = handler._build_rows(
            current, previous_by_group, "AGENT_PERFORMANCE", "2026-08-17", "2026-08-23"
        )

        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row[0], "Ada Lovelace")
        self.assertEqual(row[1], "ta@example.com")
        self.assertIn("100.0%", row)  # tours 5 -> 10

    def test_sales_row_has_no_name_column(self):
        current = [_report_item("antalya", tours=3, revenue=500)]
        rows = handler._build_rows(
            current, {}, "SALES_STATISTICS", "2026-08-17", "2026-08-23"
        )
        self.assertEqual(rows[0][0], "antalya")

    def test_missing_previous_period_data_yields_not_available_deltas(self):
        current = [_report_item("antalya", tours=3, revenue=500)]
        rows = handler._build_rows(
            current, {}, "SALES_STATISTICS", "2026-08-17", "2026-08-23"
        )
        self.assertIn("N/A", rows[0])


@_patch_config
@patch("lambdas.reports_sender.handler._REPORTS_TABLE", "reports-table-test")
class LambdaHandlerTestCase(unittest.TestCase):
    @patch("lambdas.reports_sender.handler.ses")
    @patch("lambdas.reports_sender.handler.cognito")
    @patch("lambdas.reports_sender.handler.dynamodb")
    def test_sends_report_email_with_expected_source_and_destination(
        self, mock_dynamodb, mock_cognito, mock_ses
    ):
        table = mock_dynamodb.Table.return_value
        table.query.return_value = {"Items": []}
        mock_cognito.admin_get_user.return_value = _cognito_user()
        mock_ses.send_raw_email.return_value = {"MessageId": "ses-msg-1"}

        result = handler.lambda_handler({}, None)

        self.assertTrue(result["sent"])
        self.assertEqual(result["messageId"], "ses-msg-1")
        self.assertIsInstance(result["period"], str)

        call_kwargs = mock_ses.send_raw_email.call_args.kwargs
        self.assertEqual(call_kwargs["Source"], _SENDER_EMAIL)
        self.assertEqual(call_kwargs["Destinations"], [_RECIPIENT_EMAIL])
        self.assertIn("RawMessage", call_kwargs)

    @patch("lambdas.reports_sender.handler.ses")
    @patch("lambdas.reports_sender.handler.cognito")
    @patch("lambdas.reports_sender.handler.dynamodb")
    def test_queries_both_report_types_for_current_and_previous_period(
        self, mock_dynamodb, mock_cognito, mock_ses
    ):
        table = mock_dynamodb.Table.return_value
        table.query.return_value = {"Items": []}
        mock_ses.send_raw_email.return_value = {"MessageId": "ses-msg-1"}

        handler.lambda_handler({}, None)

        self.assertEqual(table.query.call_count, 4)
        prefixes = {
            call.kwargs["ExpressionAttributeValues"][":prefix"]
            for call in table.query.call_args_list
        }
        self.assertEqual(prefixes, {"AGENT_PERFORMANCE#", "SALES_STATISTICS#"})


class MissingSesConfigTestCase(unittest.TestCase):
    @patch("lambdas.reports_sender.handler._SENDER_EMAIL", "")
    @patch("lambdas.reports_sender.handler._RECIPIENT_EMAIL", _RECIPIENT_EMAIL)
    def test_missing_sender_email_raises_before_touching_aws(self):
        with self.assertRaises(RuntimeError):
            handler.lambda_handler({}, None)

    @patch("lambdas.reports_sender.handler._SENDER_EMAIL", _SENDER_EMAIL)
    @patch("lambdas.reports_sender.handler._RECIPIENT_EMAIL", "")
    def test_missing_recipient_email_raises_before_touching_aws(self):
        with self.assertRaises(RuntimeError):
            handler.lambda_handler({}, None)


class ReportsSenderConfigWiringTestCase(unittest.TestCase):
    _CONFIG_PATH = (
        Path(__file__).resolve().parents[2]
        / "src" / "lambdas" / "reports_sender" / "lambda_config.json"
    )
    _RESOURCES_PATH = (
        Path(__file__).resolve().parents[3] / "deployment_resources.json"
    )

    @staticmethod
    def _load(path):
        return json.loads(path.read_text(encoding="utf-8-sig"))

    def test_event_source_matches_epmtpeta_12610_e2e_gate_expectation(self):
        config = self._load(self._CONFIG_PATH)
        expected_trigger = {
            "resource_type": "eventbridge_rule_trigger",
            "target_rule": "reports-sender-schedule",
            "input": {
                "source": "EPMTPETA-12603",
                "action": "send-scheduled-reports",
            },
        }
        self.assertIn(expected_trigger, config["event_sources"])

        expected_dependency = {
            "resource_name": "reports-sender-schedule",
            "resource_type": "eventbridge_rule",
        }
        self.assertIn(expected_dependency, config["dependencies"])

    def test_env_variables_reference_sender_and_recipient_aliases(self):
        config = self._load(self._CONFIG_PATH)
        self.assertEqual(config["env_variables"]["sender_email"], "${sender_email}")
        self.assertEqual(
            config["env_variables"]["recipient_email"], "${recipient_email}"
        )
        self.assertEqual(config["env_variables"]["reports_table"], "${reports_table}")

    def test_iam_policy_scopes_send_raw_email_to_sender_and_recipient_identities(self):
        # SES's SendRawEmail sending-authorization check (confirmed live,
        # 2026-08-26) evaluates IAM Resource permission against both the
        # Source identity AND every Destinations identity when
        # `Destinations` is passed alongside a raw message -- not just the
        # sender, as ses:SendEmail's simpler API would suggest.
        resources = self._load(self._RESOURCES_PATH)
        policy = resources["reports-sender-policy"]["policy_content"]
        ses_statement = next(
            s for s in policy["Statement"] if "ses:SendRawEmail" in s["Action"]
        )
        self.assertEqual(
            ses_statement["Resource"],
            [
                "arn:aws:ses:${region}:${account_id}:identity/${sender_email}",
                "arn:aws:ses:${region}:${account_id}:identity/${recipient_email}",
            ],
        )
