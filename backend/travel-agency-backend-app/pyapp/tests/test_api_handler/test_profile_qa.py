import json
from unittest.mock import patch

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError

from lambdas.api_handler import handler, profile


def event(method="PUT", body=None, role="CUSTOMER"):
    return {
        "resource": "/profile",
        "path": "/profile",
        "httpMethod": method,
        "authenticatedUser": {
            "sub": "mine",
            "username": "only-me",
            "email": "me@example.com",
            "role": role,
        },
        "body": json.dumps(
            body if body is not None else {"firstName": "Jane", "lastName": "Doe"}
        ),
    }


@pytest.mark.parametrize("role", ["CUSTOMER", "TRAVEL_AGENT"])
def test_get_profile_returns_authenticated_users_cognito_profile(role):
    client = profile.cognito_client
    with (
        patch.object(profile, "_CUP_ID", "pool"),
        patch.object(
            client,
            "admin_get_user",
            return_value={
                "UserAttributes": [
                    {"Name": "email", "Value": "me@example.com"},
                    {"Name": "given_name", "Value": "Jane"},
                    {"Name": "family_name", "Value": "Doe"},
                    {"Name": "picture", "Value": "photos/mine.jpg"},
                ]
            },
        ) as get,
    ):
        response = profile.handle_get_profile(event("GET", role=role))
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["user"] == {
        "email": "me@example.com",
        "firstName": "Jane",
        "lastName": "Doe",
        "role": role,
        "profilePhoto": "photos/mine.jpg",
    }
    get.assert_called_once_with(UserPoolId="pool", Username="only-me")


@pytest.mark.parametrize(
    "body,expected",
    [
        (
            {"firstName": "Jane"},
            [
                {
                    "Name": "given_name",
                    "Value": "Jane",
                }
            ],
        ),
        (
            {"lastName": "Doe"},
            [
                {
                    "Name": "family_name",
                    "Value": "Doe",
                }
            ],
        ),
        (
            {
                "firstName": "Jane",
                "lastName": "Doe",
            },
            [
                {
                    "Name": "given_name",
                    "Value": "Jane",
                },
                {
                    "Name": "family_name",
                    "Value": "Doe",
                },
            ],
        ),
    ],
)
def test_name_updates_and_partial_updates(
    body,
    expected,
):
    returned_first = body.get(
        "firstName",
        "Existing",
    )
    returned_last = body.get(
        "lastName",
        "Existing",
    )

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
                    "Value": "me@example.com",
                },
                {
                    "Name": "given_name",
                    "Value": returned_first,
                },
                {
                    "Name": "family_name",
                    "Value": returned_last,
                },
            ]
        },
    ):
        response = (
            profile.handle_update_profile(
                event(body=body)
            )
        )

    assert (
        response["statusCode"]
        == 200
    )
    update.assert_called_once_with(
        UserPoolId="pool",
        Username="only-me",
        UserAttributes=expected,
    )


def test_name_updates_do_not_require_an_email_claim():
    profile_event = event(body={"firstName": "Jane"})
    profile_event["authenticatedUser"].pop("email")

    with (
        patch.object(profile, "_CUP_ID", "pool"),
        patch.object(
            profile.cognito_client,
            "admin_update_user_attributes",
        ) as update,
        patch.object(
            profile.cognito_client,
            "admin_get_user",
            return_value={
                "UserAttributes": [
                    {"Name": "email", "Value": "me@example.com"},
                    {"Name": "given_name", "Value": "Jane"},
                ]
            },
        ),
    ):
        response = profile.handle_update_profile(profile_event)

    assert response["statusCode"] == 200

    update.assert_called_once_with(
        UserPoolId="pool",
        Username="only-me",
        UserAttributes=[
            {"Name": "given_name", "Value": "Jane"}
        ],
    )


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"nickname": "x"},
        {"firstName": ""},
        {"lastName": "D0e"},
        {"firstName": "a" * 51},
    ],
)
def test_invalid_profile_input_never_calls_cognito(body):
    e = event(body=body)
    e["body"] = json.dumps(body)
    with patch.object(profile.cognito_client, "admin_update_user_attributes") as update:
        response = profile.handle_update_profile(e)
    assert response["statusCode"] == 400
    update.assert_not_called()


def test_admin_behavior_is_supported_for_get_and_update():
    attrs = {
        "UserAttributes": [
            {
                "Name": "email",
                "Value": "me@example.com",
            },
            {
                "Name": "given_name",
                "Value": "Admin",
            },
            {
                "Name": "family_name",
                "Value": "User",
            },
        ]
    }

    with patch.object(
        profile,
        "_CUP_ID",
        "pool",
    ), patch.object(
        profile.cognito_client,
        "admin_get_user",
        return_value=attrs,
    ) as get, patch.object(
        profile.cognito_client,
        "admin_update_user_attributes",
    ) as update:
        assert (
            profile.handle_get_profile(
                event(
                    "GET",
                    role="ADMIN",
                )
            )["statusCode"]
            == 200
        )
        assert (
            profile.handle_update_profile(
                event(
                    role="ADMIN"
                )
            )["statusCode"]
            == 200
        )

    assert get.call_count >= 2
    update.assert_called_once()


def test_profile_route_requires_authentication():
    response = handler.lambda_handler(
        {"resource": "/profile", "path": "/profile", "httpMethod": "GET"}, None
    )
    assert response["statusCode"] == 401


@pytest.mark.parametrize(
    "error,status",
    [
        (
            ClientError(
                {"Error": {"Code": "UserNotFoundException", "Message": "missing"}},
                "AdminGetUser",
            ),
            401,
        ),
        (EndpointConnectionError(endpoint_url="https://cognito.invalid"), 503),
    ],
)
def test_profile_get_maps_cognito_failures(error, status):
    with (
        patch.object(profile, "_CUP_ID", "pool"),
        patch.object(profile.cognito_client, "admin_get_user", side_effect=error),
    ):
        assert profile.handle_get_profile(event("GET"))["statusCode"] == status
