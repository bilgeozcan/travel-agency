"""Apply Cognito verification-before-update without resetting unrelated pool settings."""
import argparse
import os
from typing import Any
import boto3

def _filter(value: Any, shape: Any) -> Any:
    if value is None or shape is None:
        return value
    kind = getattr(shape, "type_name", None)
    if kind == "structure":
        if not isinstance(value, dict):
            return value
        members = getattr(shape, "members", {})
        return {k: _filter(value[k], members[k]) for k in value if k in members}
    if kind == "list":
        member = getattr(shape, "member", None)
        return [_filter(v, member) for v in (value or [])]
    if kind == "map":
        value_shape = getattr(shape, "value", None)
        return {k: _filter(v, value_shape) for k, v in (value or {}).items()}
    return value

def build_update_payload(client, user_pool_id: str) -> dict:
    pool = client.describe_user_pool(UserPoolId=user_pool_id)["UserPool"]
    shape = client.meta.service_model.operation_model("UpdateUserPool").input_shape
    payload = {"UserPoolId": user_pool_id}
    for key, member_shape in shape.members.items():
        if key == "UserPoolId" or key not in pool:
            continue
        payload[key] = _filter(pool[key], member_shape)
    settings = dict(payload.get("UserAttributeUpdateSettings") or {})
    attrs = list(settings.get("AttributesRequireVerificationBeforeUpdate", []))
    if "email" not in attrs:
        attrs.append("email")
    settings["AttributesRequireVerificationBeforeUpdate"] = attrs
    payload["UserAttributeUpdateSettings"] = settings
    return payload

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-pool-id", default=os.environ.get("cup_id", ""))
    parser.add_argument("--region", default=os.environ.get("region") or os.environ.get("AWS_REGION") or "eu-west-3")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.user_pool_id:
        parser.error("--user-pool-id is required when cup_id is not set")
    client = boto3.client("cognito-idp", region_name=args.region)
    payload = build_update_payload(client, args.user_pool_id)
    if args.dry_run:
        print(payload["UserAttributeUpdateSettings"])
        return 0
    client.update_user_pool(**payload)
    verified = client.describe_user_pool(UserPoolId=args.user_pool_id)["UserPool"].get("UserAttributeUpdateSettings", {}).get("AttributesRequireVerificationBeforeUpdate", [])
    if "email" not in verified:
        raise RuntimeError("Cognito email verification-before-update was not applied")
    print("Cognito email verification-before-update: OK")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
