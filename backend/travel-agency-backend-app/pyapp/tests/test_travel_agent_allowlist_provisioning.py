import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import yaml
from botocore.exceptions import ClientError

from deployment.provision_travel_agent_allowlist import (
    ensure_allowlist_entries,
    load_seed_emails,
    load_syndicate_context,
    normalize_email,
)

from pyapp.tests import ImportFromSourceContext

with ImportFromSourceContext():
    from lambdas.api_handler import signup


class TestTravelAgentAllowlist(unittest.TestCase):
    def test_normalizes_email_before_storage(self):
        self.assertEqual(
            normalize_email(
                "  AGENT@TravelCo.COM "
            ),
            "agent@travelco.com",
        )

    def test_invalid_email_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize_email("not-an-email")

    @patch(
        "lambdas.api_handler.signup._dynamodb"
    )
    def test_registration_lookup_normalizes_email(
        self,
        mock_dynamodb,
    ):
        table = MagicMock()
        table.get_item.return_value = {
            "Item": {
                "email": "agent@travelco.com",
            }
        }
        mock_dynamodb.Table.return_value = table

        role = signup.get_role_for_email(
            "  AGENT@TravelCo.COM "
        )

        self.assertEqual(role, "TRAVEL_AGENT")
        table.get_item.assert_called_once_with(
            Key={
                "email": "agent@travelco.com",
            }
        )

    @patch(
        "lambdas.api_handler.signup._dynamodb"
    )
    def test_non_matching_email_defaults_to_customer(
        self,
        mock_dynamodb,
    ):
        table = MagicMock()
        table.get_item.return_value = {}
        mock_dynamodb.Table.return_value = table

        role = signup.get_role_for_email(
            "Customer@Example.com"
        )

        self.assertEqual(role, "CUSTOMER")
        table.get_item.assert_called_once_with(
            Key={
                "email": "customer@example.com",
            }
        )

    def test_seed_file_is_normalized(self):
        with tempfile.TemporaryDirectory() as temp:
            seed_path = Path(temp) / "seed.json"
            seed_path.write_text(
                json.dumps(
                    {
                        "emails": [
                            " AGENT@TravelCo.COM ",
                            "second.agent@example.com",
                        ]
                    }
                ),
                encoding="utf-8",
            )

            emails = load_seed_emails(seed_path)

        self.assertEqual(
            emails,
            [
                "agent@travelco.com",
                "second.agent@example.com",
            ],
        )

    def test_seed_inserts_each_normalized_email_once(
        self,
    ):
        table = MagicMock()

        result = ensure_allowlist_entries(
            table,
            [
                "AGENT@TravelCo.com",
                " agent@travelco.com ",
                "second.agent@example.com",
            ],
            created_at="2026-07-30T00:00:00+00:00",
        )

        self.assertEqual(
            result,
            {
                "created": [
                    "agent@travelco.com",
                    "second.agent@example.com",
                ],
                "existing": [],
                "duplicateInputCount": 1,
            },
        )
        self.assertEqual(
            table.put_item.call_count,
            2,
        )
        table.put_item.assert_has_calls(
            [
                call(
                    Item={
                        "email": "agent@travelco.com",
                        "source": "deployment-seed",
                        "createdAt": (
                            "2026-07-30T00:00:00+00:00"
                        ),
                    },
                    ConditionExpression=(
                        "attribute_not_exists(email)"
                    ),
                ),
                call(
                    Item={
                        "email": (
                            "second.agent@example.com"
                        ),
                        "source": "deployment-seed",
                        "createdAt": (
                            "2026-07-30T00:00:00+00:00"
                        ),
                    },
                    ConditionExpression=(
                        "attribute_not_exists(email)"
                    ),
                ),
            ]
        )

    def test_existing_email_is_not_overwritten(self):
        table = MagicMock()
        table.put_item.side_effect = ClientError(
            {
                "Error": {
                    "Code": (
                        "ConditionalCheckFailedException"
                    ),
                    "Message": "already exists",
                }
            },
            "PutItem",
        )

        result = ensure_allowlist_entries(
            table,
            ["agent@travelco.com"],
            created_at="2026-07-30T00:00:00+00:00",
        )

        self.assertEqual(
            result["created"],
            [],
        )
        self.assertEqual(
            result["existing"],
            ["agent@travelco.com"],
        )

    def test_loads_table_alias_and_credentials(self):
        with tempfile.TemporaryDirectory() as temp:
            config_dir = Path(temp)
            (
                config_dir / "syndicate.yml"
            ).write_text(
                yaml.safe_dump(
                    {
                        "region": "eu-west-3",
                        "temp_aws_access_key_id": (
                            "access-key"
                        ),
                        "temp_aws_secret_access_key": (
                            "secret-key"
                        ),
                        "temp_aws_session_token": (
                            "session-token"
                        ),
                    }
                ),
                encoding="utf-8",
            )
            (
                config_dir
                / "syndicate_aliases.yml"
            ).write_text(
                yaml.safe_dump(
                    {
                        "travel_agents_table": (
                            "travel-agents-test"
                        ),
                        "region": "eu-west-3",
                    }
                ),
                encoding="utf-8",
            )

            context = load_syndicate_context(
                temp
            )

        self.assertEqual(
            context["table_name"],
            "travel-agents-test",
        )
        self.assertEqual(
            context["region"],
            "eu-west-3",
        )
        self.assertEqual(
            context["credentials"][
                "aws_session_token"
            ],
            "session-token",
        )

    def test_deployment_metadata_manages_allowlist(self):
        project_root = (
            Path(__file__).resolve().parents[2]
        )
        resources = json.loads(
            (
                project_root
                / "deployment_resources.json"
            ).read_text(
                encoding="utf-8-sig"
            )
        )
        lambda_config = json.loads(
            (
                project_root
                / "pyapp"
                / "src"
                / "lambdas"
                / "api_handler"
                / "lambda_config.json"
            ).read_text(
                encoding="utf-8-sig"
            )
        )
        seed = json.loads(
            (
                project_root
                / "deployment"
                / "travel_agent_allowlist_seed.json"
            ).read_text(
                encoding="utf-8-sig"
            )
        )

        table = resources[
            "${travel_agents_table}"
        ]

        self.assertEqual(
            table["resource_type"],
            "dynamodb_table",
        )
        self.assertEqual(
            table["hash_key_name"],
            "email",
        )
        self.assertEqual(
            table["tags"]["purpose"],
            "travel-agent-allowlist",
        )

        actions = resources[
            "lambda-basic-execution"
        ]["policy_content"]["Statement"][0][
            "Action"
        ]
        self.assertIn(
            "dynamodb:GetItem",
            actions,
        )

        self.assertEqual(
            lambda_config["env_variables"][
                "travel_agents_table"
            ],
            "${travel_agents_table}",
        )
        self.assertIn(
            "agent@travelco.com",
            seed["emails"],
        )


if __name__ == "__main__":
    unittest.main()
