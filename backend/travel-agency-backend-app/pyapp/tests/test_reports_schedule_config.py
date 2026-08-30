import json
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEPLOYMENT_RESOURCES = BACKEND_ROOT / "deployment_resources.json"


def _load_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def test_reports_sender_schedule_runs_daily_at_1700_trt():
    """EPMTPETA-12603: 17:00 TRT is 14:00 UTC for EventBridge cron."""
    resources = _load_json(DEPLOYMENT_RESOURCES)

    schedule = resources["reports-sender-schedule"]

    assert schedule == {
        "resource_type": "eventbridge_rule",
        "rule_type": "schedule",
        "region": "${region}",
        "expression": "cron(0 14 * * ? *)",
        "tags": {
            "purpose": "reports-pipeline",
        },
    }
