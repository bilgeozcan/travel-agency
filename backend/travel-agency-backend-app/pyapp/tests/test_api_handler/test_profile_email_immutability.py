import json
from pathlib import Path
from unittest.mock import patch

import pytest

from pyapp.tests import ImportFromSourceContext

with ImportFromSourceContext():
    from lambdas.api_handler import handler as api_handler
    from lambdas.api_handler import profile


def _event(
    role="CUSTOMER",
    email="customer@example.com",
    body=None,
):
    return {
        "resource": "/profile",
        "path": "/profile",
        "httpMethod": "PUT",
        "headers": {
            "Origin": "http://localhost:5173",
        },
        "authenticatedUser": {
            "sub": "user-123",
            "user_id": "user-123",
            "username": "cognito-user-123",
            "email": email,
            "role": role,
            "groups": [role],
        },
        "body": json.dumps(
            body
            or {
                "firstName": "Updated",
                "lastName": "User",
            }
        ),
    }


@pytest.mark.parametrize(
    "role,email",
    [
        ("CUSTOMER", "customer@example.com"),
        ("TRAVEL_AGENT", "agent@example.com"),
    ],
)
def test_email_change_is_rejected_without_cognito_write(
    role,
    email,
):
    event = _event(
        role=role,
        email=email,
        body={
            "firstName": "Updated",
            "email": "different@example.com",
        },
    )

    with patch.object(
        profile,
        "cognito_client",
    ) as cognito:
        response = profile.handle_update_profile(
            event
        )

    assert response["statusCode"] == 400
    assert json.loads(response["body"]) == {
        "code": "EMAIL_CHANGE_NOT_ALLOWED",
        "message": "Email address cannot be changed",
    }
    cognito.admin_update_user_attributes.assert_not_called()


def test_same_normalized_email_is_not_written_to_cognito():
    request = _event(
        body={
            "firstName": "Jane",
            "email": (
                " CUSTOMER@EXAMPLE.COM "
            ),
        }
    )

    with patch.object(
        profile,
        "_CUP_ID",
        "test-user-pool",
    ), patch.object(
        profile,
        "cognito_client",
    ) as cognito:
        cognito.admin_get_user.return_value = {
            "UserAttributes": [
                {
                    "Name": "email",
                    "Value": (
                        "customer@example.com"
                    ),
                },
                {
                    "Name": "given_name",
                    "Value": "Jane",
                },
                {
                    "Name": "family_name",
                    "Value": "User",
                },
            ]
        }

        response = (
            profile.handle_update_profile(
                request
            )
        )

    assert (
        response["statusCode"]
        == 200
    )
    cognito.admin_update_user_attributes.assert_called_once_with(
        UserPoolId="test-user-pool",
        Username="cognito-user-123",
        UserAttributes=[
            {
                "Name": "given_name",
                "Value": "Jane",
            }
        ],
    )
    attributes = (
        cognito
        .admin_update_user_attributes
        .call_args
        .kwargs["UserAttributes"]
    )
    assert all(
        attribute["Name"]
        != "email"
        for attribute in attributes
    )


def test_same_email_only_is_a_no_op():
    event = _event(
        body={
            "email": "customer@example.com",
        }
    )

    with patch.object(
        profile,
        "cognito_client",
    ) as cognito:
        response = profile.handle_update_profile(
            event
        )

    assert response["statusCode"] == 200
    cognito.admin_update_user_attributes.assert_not_called()


def test_invalid_profile_field_is_rejected_before_write():
    event = _event(
        body={
            "phone": "555-0100",
        }
    )

    with patch.object(
        profile,
        "cognito_client",
    ) as cognito:
        response = profile.handle_update_profile(
            event
        )

    assert response["statusCode"] == 400
    assert json.loads(response["body"]) == {
        "code": "VALIDATION_ERROR",
        "message": "Request validation failed",
        "details": {
            "fields": ["phone"],
        },
    }
    cognito.admin_update_user_attributes.assert_not_called()


def test_unsupported_role_is_forbidden_without_write():
    request = _event(
        role="SUPPORT",
        body={
            "firstName": "Support",
        },
    )

    with patch.object(
        profile,
        "cognito_client",
    ) as cognito:
        response = (
            profile.handle_update_profile(
                request
            )
        )

    assert (
        response["statusCode"]
        == 403
    )
    cognito.admin_update_user_attributes.assert_not_called()
    cognito.admin_get_user.assert_not_called()


def test_lambda_route_rejects_customer_email_change():
    event = {
        "resource": "/profile",
        "path": "/profile",
        "httpMethod": "PUT",
        "headers": {
            "Origin": "http://localhost:5173",
        },
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "user-123",
                    "email": "customer@example.com",
                    "cognito:username": (
                        "cognito-user-123"
                    ),
                    "cognito:groups": "CUSTOMER",
                }
            }
        },
        "body": json.dumps(
            {
                "email": "different@example.com",
            }
        ),
    }

    with patch.object(
        profile,
        "cognito_client",
    ) as cognito:
        response = api_handler.lambda_handler(
            event,
            None,
        )

    assert response["statusCode"] == 400
    assert (
        json.loads(response["body"])["code"]
        == "EMAIL_CHANGE_NOT_ALLOWED"
    )
    cognito.admin_update_user_attributes.assert_not_called()


def test_openapi_and_iam_document_immutable_email():
    project_root = (
        Path(__file__).resolve().parents[3]
    )

    openapi = json.loads(
        (
            project_root
            / "openapi_travel_agency_sprint1_v1_oas_v3.json"
        ).read_text(encoding="utf-8-sig")
    )
    resources = json.loads(
        (
            project_root
            / "deployment_resources.json"
        ).read_text(encoding="utf-8-sig")
    )

    operation = openapi["paths"]["/profile"]["put"]
    assert operation["security"] == [
        {
            "bearerAuth": [
                "aws.cognito.signin.user.admin"
            ],
        }
    ]

    response_example = operation["responses"]["400"][
        "content"
    ]["application/json"]["examples"][
        "emailChangeNotAllowed"
    ]["value"]

    assert response_example == {
        "code": "EMAIL_CHANGE_NOT_ALLOWED",
        "message": "Email address cannot be changed",
    }

    request_schema = openapi["components"]["schemas"][
        "UpdateProfileRequestDTO"
    ]
    assert (
        "must match the registered email"
        in request_schema["properties"]["email"][
            "description"
        ]
    )

    actions = resources["lambda-basic-execution"][
        "policy_content"
    ]["Statement"][0]["Action"]

    assert (
        "cognito-idp:AdminUpdateUserAttributes"
        in actions
    )
