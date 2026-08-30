import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _load_root_resources():
    return json.loads(
        (PROJECT_ROOT / "deployment_resources.json").read_text(encoding="utf-8")
    )


def test_reports_queue_and_dlq_are_declared_via_aliases():
    resources = _load_root_resources()

    assert "${reports_queue}" in resources
    assert "${reports_dlq}" in resources


def test_reports_dlq_is_a_standard_sqs_queue_with_max_retention():
    dlq = _load_root_resources()["${reports_dlq}"]

    assert dlq["resource_type"] == "sqs_queue"
    assert dlq["region"] == "${region}"
    # 1,209,600s = 14 days, the maximum SQS allows - failed messages should
    # stay inspectable for as long as possible before they age out.
    assert dlq["message_retention_period"] == 1209600


def test_reports_queue_redrives_into_the_dlq_after_three_failures():
    queue = _load_root_resources()["${reports_queue}"]

    assert queue["resource_type"] == "sqs_queue"
    assert queue["redrive_policy"] == {
        "deadLetterTargetArn": "arn:aws:sqs:${region}:${account_id}:${reports_dlq}",
        "maxReceiveCount": 3,
    }


def test_reports_queue_depends_on_the_dlq_for_deploy_ordering():
    queue = _load_root_resources()["${reports_queue}"]

    assert {
        "resource_name": "${reports_dlq}",
        "resource_type": "sqs_queue",
    } in queue["dependencies"]
