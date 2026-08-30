"""Lists AWS resources for this Syndicate sandbox: name, live AWS ID/ARN, status.

Read-only (list/describe calls only) - never deploys, creates, or modifies
anything. Resource names are resolved the same way Syndicate does: literal
names come from deployment_resources.json / lambda_config.json, ${alias}
placeholders are resolved via syndicate_aliases.yml. This mirrors the "no
hardcoded resource names" rule in CLAUDE.md - if the aliases change (e.g. a
different developer's sandbox), the script follows them.

Usage:
    python deployment/list_deployed_resources.py
    python deployment/list_deployed_resources.py --json-out resources.json
    python deployment/list_deployed_resources.py --config-dir /path/to/.syndicate-config-dev
"""

import argparse
import json
import os
from pathlib import Path
from typing import Any

import boto3
import yaml
from botocore.exceptions import ClientError

REPO_ROOT = Path(__file__).resolve().parent.parent
LAMBDA_DIRS = ("api_handler", "booking_status_updater")


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as source:
        return yaml.safe_load(source) or {}


def _load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def load_syndicate_context(config_dir: str | None = None) -> dict[str, Any]:
    config_value = config_dir or os.environ.get("SDCT_CONF")
    if not config_value:
        raise ValueError("SDCT_CONF is not set and --config-dir was not provided")
    resolved_config_dir = Path(config_value).expanduser()

    config = _load_yaml(resolved_config_dir / "syndicate.yml")
    aliases = _load_yaml(resolved_config_dir / "syndicate_aliases.yml")

    region = aliases.get("region") or config.get("region")
    if not region:
        raise ValueError("AWS region is missing from Syndicate configuration")

    return {
        "aliases": aliases,
        "region": region,
        "account_id": aliases.get("account_id") or config.get("account_id"),
        "credentials": {
            "aws_access_key_id": config.get("temp_aws_access_key_id"),
            "aws_secret_access_key": config.get("temp_aws_secret_access_key"),
            "aws_session_token": config.get("temp_aws_session_token"),
        },
    }


def _resolve(value: str, aliases: dict[str, Any]) -> str:
    """Resolve a single ${alias} placeholder the way Syndicate does."""
    if value.startswith("${") and value.endswith("}"):
        alias_key = value[2:-1]
        resolved = aliases.get(alias_key)
        if resolved is None:
            raise ValueError(f"Alias '{alias_key}' is not defined in syndicate_aliases.yml")
        return str(resolved)
    return value


def _boto3_session(context: dict[str, Any]) -> boto3.Session:
    credentials = {k: v for k, v in context["credentials"].items() if v}
    return boto3.Session(region_name=context["region"], **credentials)


def _collect_declared_resources(aliases: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    """Read deployment_resources.json + each lambda's own files, resolve names."""
    declared: dict[str, list[dict[str, str]]] = {
        "lambda": [],
        "iam_role": [],
        "dynamodb_table": [],
        "cognito_idp": [],
        "eventbridge_rule": [],
    }

    root_resources = _load_json(REPO_ROOT / "deployment_resources.json")
    for raw_name, spec in root_resources.items():
        rtype = spec.get("resource_type")
        if rtype not in declared:
            continue
        declared[rtype].append({"declared_name": raw_name, "resolved_name": _resolve(raw_name, aliases)})

    for lambda_dir in LAMBDA_DIRS:
        lambda_config_path = REPO_ROOT / "pyapp" / "src" / "lambdas" / lambda_dir / "lambda_config.json"
        lambda_resources_path = REPO_ROOT / "pyapp" / "src" / "lambdas" / lambda_dir / "deployment_resources.json"

        if lambda_config_path.exists():
            spec = _load_json(lambda_config_path)
            name = spec.get("name", lambda_dir)
            declared["lambda"].append({"declared_name": name, "resolved_name": _resolve(name, aliases)})

        if lambda_resources_path.exists():
            for raw_name, spec in _load_json(lambda_resources_path).items():
                rtype = spec.get("resource_type")
                if rtype not in declared:
                    continue
                declared[rtype].append({"declared_name": raw_name, "resolved_name": _resolve(raw_name, aliases)})

    return declared


def _describe_lambda(session: boto3.Session, name: str) -> dict[str, Any]:
    client = session.client("lambda")
    try:
        fn = client.get_function(FunctionName=name)["Configuration"]
        return {
            "status": "FOUND",
            "id": fn["FunctionArn"],
            "runtime": fn.get("Runtime"),
            "last_modified": fn.get("LastModified"),
        }
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ResourceNotFoundException":
            return {"status": "NOT FOUND"}
        raise


def _describe_iam_role(session: boto3.Session, name: str) -> dict[str, Any]:
    client = session.client("iam")
    try:
        role = client.get_role(RoleName=name)["Role"]
        return {"status": "FOUND", "id": role["Arn"], "created": role["CreateDate"].isoformat()}
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "NoSuchEntity":
            return {"status": "NOT FOUND"}
        raise


def _describe_dynamodb_table(session: boto3.Session, name: str) -> dict[str, Any]:
    client = session.client("dynamodb")
    try:
        table = client.describe_table(TableName=name)["Table"]
        return {"status": table["TableStatus"], "id": table["TableArn"], "item_count": table["ItemCount"]}
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ResourceNotFoundException":
            return {"status": "NOT FOUND"}
        raise


def _describe_cognito_pool(session: boto3.Session, name: str) -> dict[str, Any]:
    client = session.client("cognito-idp")
    next_token = None
    while True:
        request = {"MaxResults": 60}
        if next_token:
            request["NextToken"] = next_token
        response = client.list_user_pools(**request)
        for pool in response.get("UserPools", []):
            if pool.get("Name") == name:
                pool_id = pool["Id"]
                clients = client.list_user_pool_clients(UserPoolId=pool_id).get("UserPoolClients", [])
                client_info = ", ".join(f"{c['ClientName']} ({c['ClientId']})" for c in clients)
                return {"status": "FOUND", "id": pool_id, "clients": client_info}
        next_token = response.get("NextToken")
        if not next_token:
            break
    return {"status": "NOT FOUND"}


def _describe_eventbridge_rule(session: boto3.Session, name: str) -> dict[str, Any]:
    client = session.client("events")
    try:
        rule = client.describe_rule(Name=name)
        return {
            "status": rule.get("State", "UNKNOWN"),
            "id": rule["Arn"],
            "schedule": rule.get("ScheduleExpression", ""),
        }
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ResourceNotFoundException":
            return {"status": "NOT FOUND"}
        raise


def _find_api_gateways(session: boto3.Session, name_hint: str) -> list[dict[str, Any]]:
    """API Gateway REST APIs aren't uniquely named in this project's config,
    so this returns every candidate whose name contains the hint instead of
    guessing a single match."""
    client = session.client("apigateway")
    matches = []
    paginator = client.get_paginator("get_rest_apis")
    for page in paginator.paginate():
        for api in page.get("items", []):
            if name_hint.lower() in api.get("name", "").lower():
                matches.append(
                    {
                        "name": api["name"],
                        "id": api["id"],
                        "created": api["createdDate"].isoformat(),
                    }
                )
    return matches


def collect_inventory(config_dir: str | None = None) -> dict[str, Any]:
    context = load_syndicate_context(config_dir)
    session = _boto3_session(context)
    aliases = context["aliases"]
    declared = _collect_declared_resources(aliases)

    inventory: dict[str, list[dict[str, Any]]] = {}

    inventory["lambda"] = [
        {**entry, **_describe_lambda(session, entry["resolved_name"])} for entry in declared["lambda"]
    ]
    inventory["iam_role"] = [
        {**entry, **_describe_iam_role(session, entry["resolved_name"])} for entry in declared["iam_role"]
    ]
    inventory["dynamodb_table"] = [
        {**entry, **_describe_dynamodb_table(session, entry["resolved_name"])} for entry in declared["dynamodb_table"]
    ]
    inventory["cognito_idp"] = [
        {**entry, **_describe_cognito_pool(session, entry["resolved_name"])} for entry in declared["cognito_idp"]
    ]
    inventory["eventbridge_rule"] = [
        {**entry, **_describe_eventbridge_rule(session, entry["resolved_name"])} for entry in declared["eventbridge_rule"]
    ]
    inventory["api_gateway_candidates"] = _find_api_gateways(session, "travel")

    return {
        "region": context["region"],
        "account_id": context["account_id"],
        "resources": inventory,
    }


def _print_table(inventory: dict[str, Any]) -> None:
    print(f"Account: {inventory['account_id']}  Region: {inventory['region']}\n")
    for resource_type, entries in inventory["resources"].items():
        if not entries:
            continue
        print(f"=== {resource_type} ===")
        for entry in entries:
            name = entry.get("resolved_name") or entry.get("name")
            status = entry.get("status", "?")
            rid = entry.get("id", "-")
            print(f"  [{status:12s}] {name:45s} {rid}")
        print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="List AWS resources deployed for this Syndicate sandbox (read-only)."
    )
    parser.add_argument("--config-dir", help="Syndicate config directory. Defaults to SDCT_CONF.")
    parser.add_argument("--json-out", help="Optional path to also write the inventory as JSON.")
    args = parser.parse_args()

    inventory = collect_inventory(args.config_dir)
    _print_table(inventory)

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(inventory, f, indent=2, default=str)
        print(f"Wrote {args.json_out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
