import json
from pathlib import Path

import pytest


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PYAPP_ROOT = BACKEND_ROOT / "pyapp"

DEPLOYMENT_RESOURCES = BACKEND_ROOT / "deployment_resources.json"
REPORTS_HANDLER_CONFIG = (
    PYAPP_ROOT / "src" / "lambdas" / "reports_handler" / "lambda_config.json"
)
REPORTS_SENDER_CONFIG = (
    PYAPP_ROOT / "src" / "lambdas" / "reports_sender" / "lambda_config.json"
)


def _load_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def test_scheduled_reporting_pipeline_reaches_sqs_processor():
    """EPMTPETA-12610: validate the currently available schedule -> SQS processor chain."""
    resources = _load_json(DEPLOYMENT_RESOURCES)
    handler_config = _load_json(REPORTS_HANDLER_CONFIG)

    schedule = resources["reports-sender-schedule"]
    assert schedule["resource_type"] == "eventbridge_rule"
    assert schedule["rule_type"] == "schedule"
    assert schedule["expression"] == "cron(0 14 * * ? *)"

    reports_queue = resources["${reports_queue}"]
    assert reports_queue["resource_type"] == "sqs_queue"

    queue_dependency = {
        "resource_name": "${reports_queue}",
        "resource_type": "sqs_queue",
    }
    assert queue_dependency in handler_config["dependencies"]

    sqs_sources = [
        source
        for source in handler_config["event_sources"]
        if source.get("resource_type") == "sqs_trigger"
    ]
    assert any(
        source.get("target_queue") == "${reports_queue}"
        for source in sqs_sources
    )


def test_full_schedule_to_email_delivery_when_sender_dependency_is_available():
    """
    EPMTPETA-12610 full E2E gate.

    EPMTPETA-12605 owns Reports Sender Lambda + SES integration and
    EPMTPETA-12607 owns SES verified identity setup. Until those resources
    exist in the branch, the final email-delivery stage cannot be truthfully
    executed or asserted.
    """
    if not REPORTS_SENDER_CONFIG.exists():
        pytest.skip(
            "Blocked by EPMTPETA-12605/EPMTPETA-12607: "
            "reports_sender Lambda/SES integration is not present yet"
        )

    sender_config = _load_json(REPORTS_SENDER_CONFIG)

    # Once the dependency lands, require the sender Lambda to be wired to the
    # EPMTPETA-12603 EventBridge rule before this E2E gate can turn green.
    expected_trigger = {
        "resource_type": "eventbridge_rule_trigger",
        "target_rule": "reports-sender-schedule",
        "input": {
            "source": "EPMTPETA-12603",
            "action": "send-scheduled-reports",
        },
    }
    assert expected_trigger in sender_config.get("event_sources", [])

    expected_dependency = {
        "resource_name": "reports-sender-schedule",
        "resource_type": "eventbridge_rule",
    }
    assert expected_dependency in sender_config.get("dependencies", [])
