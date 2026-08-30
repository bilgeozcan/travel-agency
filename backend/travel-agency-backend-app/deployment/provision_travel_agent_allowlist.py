import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import boto3
import yaml
from botocore.exceptions import ClientError


_EMAIL_PATTERN = re.compile(
    r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
)
_DEFAULT_SEED_PATH = (
    Path(__file__).with_name(
        "travel_agent_allowlist_seed.json"
    )
)


def normalize_email(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("Travel Agent email must be a string")

    normalized = value.strip().casefold()

    if not _EMAIL_PATTERN.fullmatch(normalized):
        raise ValueError(
            f"Invalid Travel Agent email: {value!r}"
        )

    return normalized


def load_seed_emails(
    seed_path: str | Path = _DEFAULT_SEED_PATH,
) -> list[str]:
    path = Path(seed_path)
    data = json.loads(
        path.read_text(encoding="utf-8-sig")
    )

    if isinstance(data, dict):
        values = data.get("emails")
    else:
        values = data

    if not isinstance(values, list) or not values:
        raise ValueError(
            "Allowlist seed must contain a non-empty "
            "emails list"
        )

    return [
        normalize_email(value)
        for value in values
    ]


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as source:
        return yaml.safe_load(source) or {}


def load_syndicate_context(
    config_dir: str | None = None,
) -> dict[str, Any]:
    config_value = (
        config_dir
        or os.environ.get("SDCT_CONF")
    )

    if not config_value:
        raise ValueError("SDCT_CONF is not set")

    resolved_config_dir = Path(
        config_value
    ).expanduser()

    config = _load_yaml(
        resolved_config_dir / "syndicate.yml"
    )
    aliases = _load_yaml(
        resolved_config_dir / "syndicate_aliases.yml"
    )

    table_name = aliases.get(
        "travel_agents_table"
    )

    if not table_name:
        raise ValueError(
            "travel_agents_table is missing from "
            "syndicate_aliases.yml"
        )

    region = (
        aliases.get("region")
        or config.get("region")
    )

    if not region:
        raise ValueError(
            "AWS region is missing from "
            "Syndicate configuration"
        )

    return {
        "table_name": table_name,
        "region": region,
        "credentials": {
            "aws_access_key_id": config.get(
                "temp_aws_access_key_id"
            ),
            "aws_secret_access_key": config.get(
                "temp_aws_secret_access_key"
            ),
            "aws_session_token": config.get(
                "temp_aws_session_token"
            ),
        },
    }


def create_dynamodb_resource(
    context: dict[str, Any],
):
    credentials = {
        key: value
        for key, value in context[
            "credentials"
        ].items()
        if value
    }

    return boto3.resource(
        "dynamodb",
        region_name=context["region"],
        **credentials,
    )


def _unique_normalized_emails(
    emails: Iterable[str],
) -> tuple[list[str], int]:
    unique = []
    seen = set()
    duplicate_count = 0

    for email in emails:
        normalized = normalize_email(email)

        if normalized in seen:
            duplicate_count += 1
            continue

        seen.add(normalized)
        unique.append(normalized)

    return unique, duplicate_count


def ensure_allowlist_entries(
    table,
    emails: Iterable[str],
    *,
    created_at: str | None = None,
) -> dict[str, Any]:
    normalized_emails, duplicate_count = (
        _unique_normalized_emails(emails)
    )

    timestamp = (
        created_at
        or datetime.now(timezone.utc).isoformat()
    )

    created = []
    existing = []

    for email in normalized_emails:
        try:
            table.put_item(
                Item={
                    "email": email,
                    "source": "deployment-seed",
                    "createdAt": timestamp,
                },
                ConditionExpression=(
                    "attribute_not_exists(email)"
                ),
            )
            created.append(email)

        except ClientError as exc:
            error_code = (
                exc.response
                .get("Error", {})
                .get("Code")
            )

            if (
                error_code
                == "ConditionalCheckFailedException"
            ):
                existing.append(email)
                continue

            raise

    return {
        "created": created,
        "existing": existing,
        "duplicateInputCount": duplicate_count,
    }


def provision_travel_agent_allowlist(
    config_dir: str | None = None,
    seed_path: str | Path = _DEFAULT_SEED_PATH,
) -> dict[str, Any]:
    context = load_syndicate_context(
        config_dir
    )
    dynamodb = create_dynamodb_resource(
        context
    )
    table = dynamodb.Table(
        context["table_name"]
    )
    emails = load_seed_emails(seed_path)

    return ensure_allowlist_entries(
        table,
        emails,
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Populate the Travel Agent allowlist "
            "after Syndicate deployment."
        )
    )
    parser.add_argument(
        "--config-dir",
        help=(
            "Syndicate config directory. "
            "Defaults to SDCT_CONF."
        ),
    )
    parser.add_argument(
        "--seed-file",
        default=str(_DEFAULT_SEED_PATH),
        help="JSON file containing the initial emails.",
    )
    args = parser.parse_args()

    result = provision_travel_agent_allowlist(
        args.config_dir,
        args.seed_file,
    )

    print(
        "Travel Agent allowlist provisioned: "
        f"{len(result['created'])} created, "
        f"{len(result['existing'])} existing, "
        f"{result['duplicateInputCount']} "
        "duplicate seed entries ignored."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
