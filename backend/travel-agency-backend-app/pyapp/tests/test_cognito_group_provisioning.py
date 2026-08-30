import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, call

import yaml

from deployment.provision_cognito_groups import (
    ensure_cognito_groups,
    find_user_pool_id,
    load_syndicate_context,
)


class TestCognitoGroupProvisioning(unittest.TestCase):
    def test_loads_pool_name_region_and_temporary_credentials(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            config_dir = Path(temp_dir)
            (config_dir / "syndicate.yml").write_text(
                yaml.safe_dump({
                    "region": "eu-west-3",
                    "temp_aws_access_key_id": "access-key",
                    "temp_aws_secret_access_key": "secret-key",
                    "temp_aws_session_token": "session-token",
                }),
                encoding="utf-8",
            )
            (config_dir / "syndicate_aliases.yml").write_text(
                yaml.safe_dump({
                    "booking_userpool": "booking-userpool-test",
                    "region": "eu-west-3",
                }),
                encoding="utf-8",
            )

            context = load_syndicate_context(temp_dir)

        self.assertEqual(
            context["user_pool_name"],
            "booking-userpool-test",
        )
        self.assertEqual(context["region"], "eu-west-3")
        self.assertEqual(
            context["credentials"]["aws_session_token"],
            "session-token",
        )

    def test_finds_user_pool_across_pages(self):
        cognito_client = MagicMock()
        cognito_client.list_user_pools.side_effect = [
            {
                "UserPools": [{"Id": "pool-1", "Name": "other-pool"}],
                "NextToken": "next-page",
            },
            {
                "UserPools": [
                    {"Id": "pool-2", "Name": "booking-userpool-test"}
                ]
            },
        ]

        user_pool_id = find_user_pool_id(
            cognito_client,
            "booking-userpool-test",
        )

        self.assertEqual(user_pool_id, "pool-2")
        self.assertEqual(cognito_client.list_user_pools.call_count, 2)

    def test_creates_only_missing_groups(self):
        cognito_client = MagicMock()
        cognito_client.list_groups.return_value = {
            "Groups": [{"GroupName": "CUSTOMER"}]
        }

        created_groups = ensure_cognito_groups(
            cognito_client,
            "pool-1",
        )

        self.assertEqual(created_groups, ["TRAVEL_AGENT", "ADMIN"])
        cognito_client.create_group.assert_has_calls([
            call(
                UserPoolId="pool-1",
                GroupName="TRAVEL_AGENT",
                Description="Travel Agent role group",
            ),
            call(
                UserPoolId="pool-1",
                GroupName="ADMIN",
                Description="Administrator role group",
            ),
        ])

    def test_is_idempotent_when_all_groups_exist(self):
        cognito_client = MagicMock()
        cognito_client.list_groups.return_value = {
            "Groups": [
                {"GroupName": "CUSTOMER"},
                {"GroupName": "TRAVEL_AGENT"},
                {"GroupName": "ADMIN"},
            ]
        }

        created_groups = ensure_cognito_groups(
            cognito_client,
            "pool-1",
        )

        self.assertEqual(created_groups, [])
        cognito_client.create_group.assert_not_called()


if __name__ == "__main__":
    unittest.main()
