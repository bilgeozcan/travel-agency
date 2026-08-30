import json
from unittest.mock import patch

import pytest

from lambdas.api_handler import profile

def event(body, role="CUSTOMER"):
    return {
        "authenticatedUser": {
            "sub": "u1",
            "username": "only-me",
            "email": "old@example.com",
            "role": role,
            "groups": [role],
        },
        "body": json.dumps(body),
    }

@pytest.mark.parametrize(
    "role",
    [
        "CUSTOMER",
        "TRAVEL_AGENT",
        "ADMIN",
    ],
)
def test_update_names_and_profile_photo_returns_complete_profile(
    role,
):
    body = {
        "firstName": "Anne-Marie",
        "lastName": "O'Neil",
        "profilePhoto": (
            "profiles/u1.jpg"
        ),
    }

    with patch.object(
        profile,
        "_CUP_ID",
        "pool",
    ), patch.object(
        profile.cognito_client,
        "admin_update_user_attributes",
    ) as update, patch.object(
        profile.cognito_client,
        "admin_get_user",
        return_value={
            "UserAttributes": [
                {
                    "Name": "email",
                    "Value": (
                        "old@example.com"
                    ),
                },
                {
                    "Name": "given_name",
                    "Value": "Anne-Marie",
                },
                {
                    "Name": "family_name",
                    "Value": "O'Neil",
                },
                {
                    "Name": "picture",
                    "Value": (
                        "profiles/u1.jpg"
                    ),
                },
            ]
        },
    ):
        response = (
            profile.handle_update_profile(
                event(
                    body,
                    role,
                )
            )
        )

    assert (
        response["statusCode"]
        == 200
    )
    assert (
        json.loads(
            response["body"]
        )["user"]
        == {
            "email": "old@example.com",
            "firstName": "Anne-Marie",
            "lastName": "O'Neil",
            "role": role,
            "profilePhoto": (
                "profiles/u1.jpg"
            ),
        }
    )
    update.assert_called_once_with(
        UserPoolId="pool",
        Username="only-me",
        UserAttributes=[
            {
                "Name": "given_name",
                "Value": "Anne-Marie",
            },
            {
                "Name": "family_name",
                "Value": "O'Neil",
            },
            {
                "Name": "picture",
                "Value": (
                    "profiles/u1.jpg"
                ),
            },
        ],
    )

@pytest.mark.parametrize(
    "body",
    [
        {"firstName": ""},
        {
            "firstName": (
                "A" * 51
            )
        },
        {
            "firstName": (
                "Jane Doe"
            )
        },
        {"lastName": "D0e"},
        {"profilePhoto": ""},
        {
            "profilePhoto": (
                "x" * 2049
            )
        },
        {"phone": "555"},
    ],
)
def test_invalid_or_unknown_fields_do_not_write(
    body,
):
    with patch.object(
        profile.cognito_client,
        "admin_update_user_attributes",
    ) as update:
        response = (
            profile.handle_update_profile(
                event(body)
            )
        )

    assert (
        response["statusCode"]
        == 400
    )
    update.assert_not_called()

def test_general_update_cannot_change_email_directly():
    with patch.object(
        profile.cognito_client,
        "admin_update_user_attributes",
    ) as update:
        response = (
            profile.handle_update_profile(
                event(
                    {
                        "email": (
                            "other@example.com"
                        )
                    }
                )
            )
        )

    assert (
        response["statusCode"]
        == 400
    )
    assert (
        json.loads(
            response["body"]
        )["code"]
        == "EMAIL_CHANGE_NOT_ALLOWED"
    )
    update.assert_not_called()
