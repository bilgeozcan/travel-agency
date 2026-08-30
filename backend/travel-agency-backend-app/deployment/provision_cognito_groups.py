import argparse
import os
from pathlib import Path
from typing import Any

import boto3
import yaml


COGNITO_GROUPS = (
    {
        "GroupName": "CUSTOMER",
        "Description": "Customer role group",
    },
    {
        "GroupName": "TRAVEL_AGENT",
        "Description": "Travel Agent role group",
    },
    {
        "GroupName": "ADMIN",
        "Description": "Administrator role group",
    },
)


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as source:
        return yaml.safe_load(source) or {}


def load_syndicate_context(config_dir: str | None = None) -> dict[str, Any]:
    config_value = config_dir or os.environ.get("SDCT_CONF")
    if not config_value:
        raise ValueError("SDCT_CONF is not set")
    resolved_config_dir = Path(config_value).expanduser()

    config = _load_yaml(resolved_config_dir / "syndicate.yml")
    aliases = _load_yaml(resolved_config_dir / "syndicate_aliases.yml")

    user_pool_name = aliases.get("booking_userpool")
    if not user_pool_name:
        raise ValueError(
            "booking_userpool is missing from syndicate_aliases.yml"
        )

    region = aliases.get("region") or config.get("region")
    if not region:
        raise ValueError("AWS region is missing from Syndicate configuration")

    return {
        "user_pool_name": user_pool_name,
        "region": region,
        "credentials": {
            "aws_access_key_id": config.get("temp_aws_access_key_id"),
            "aws_secret_access_key": config.get(
                "temp_aws_secret_access_key"
            ),
            "aws_session_token": config.get("temp_aws_session_token"),
        },
    }


def create_cognito_client(context: dict[str, Any]):
    credentials = {
        key: value
        for key, value in context["credentials"].items()
        if value
    }
    return boto3.client(
        "cognito-idp",
        region_name=context["region"],
        **credentials,
    )


def find_user_pool_id(cognito_client, user_pool_name: str) -> str:
    next_token = None
    while True:
        request = {"MaxResults": 60}
        if next_token:
            request["NextToken"] = next_token

        response = cognito_client.list_user_pools(**request)
        for user_pool in response.get("UserPools", []):
            if user_pool.get("Name") == user_pool_name:
                return user_pool["Id"]

        next_token = response.get("NextToken")
        if not next_token:
            break

    raise RuntimeError(
        f'Cognito User Pool "{user_pool_name}" was not found'
    )


def ensure_cognito_groups(cognito_client, user_pool_id: str) -> list[str]:
    existing_groups = set()
    next_token = None
    while True:
        request = {
            "UserPoolId": user_pool_id,
            "Limit": 60,
        }
        if next_token:
            request["NextToken"] = next_token

        response = cognito_client.list_groups(**request)
        existing_groups.update(
            group["GroupName"]
            for group in response.get("Groups", [])
        )

        next_token = response.get("NextToken")
        if not next_token:
            break

    created_groups = []
    for group in COGNITO_GROUPS:
        if group["GroupName"] in existing_groups:
            continue
        cognito_client.create_group(
            UserPoolId=user_pool_id,
            **group,
        )
        created_groups.append(group["GroupName"])

    return created_groups


def provision_cognito_groups(config_dir: str | None = None) -> list[str]:
    context = load_syndicate_context(config_dir)
    cognito_client = create_cognito_client(context)
    user_pool_id = find_user_pool_id(
        cognito_client,
        context["user_pool_name"],
    )
    return ensure_cognito_groups(cognito_client, user_pool_id)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Provision required Cognito groups after deployment."
    )
    parser.add_argument(
        "--config-dir",
        help="Syndicate config directory. Defaults to SDCT_CONF.",
    )
    args = parser.parse_args()

    created_groups = provision_cognito_groups(args.config_dir)
    if created_groups:
        print(f"Created Cognito groups: {', '.join(created_groups)}")
    else:
        print("All required Cognito groups already exist.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
