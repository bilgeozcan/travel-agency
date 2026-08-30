"""Authentication context and protected API regression tests."""

from copy import deepcopy
from unittest.mock import patch

from commons.auth.user_context import get_authenticated_user
from lambdas.api_handler import handler


def _protected_event(
    method: str = "GET",
    path: str = "/bookings",
    claims: dict | None = None,
) -> dict:
    event = {
        "httpMethod": method,
        "path": path,
        "headers": {
            "Authorization": "Bearer sensitive-token",
            "X-Request-Id": "request-id",
        },
        "multiValueHeaders": {
            "authorization": [
                "Bearer sensitive-token"
            ],
        },
    }

    if claims is not None:
        event["requestContext"] = {
            "authorizer": {
                "claims": claims,
            },
        }

    return event


def test_protected_routes_without_claims_return_401():
    with patch.object(
        handler.HANDLER,
        "lambda_handler",
    ) as downstream_handler:
        for method in ("GET", "POST"):
            response = handler.lambda_handler(
                _protected_event(method),
                context=None,
            )

            assert response["statusCode"] == 401

    downstream_handler.assert_not_called()


def test_booking_validation_without_claims_returns_401():
    with patch.object(
        handler.HANDLER,
        "lambda_handler",
    ) as downstream_handler:
        response = handler.lambda_handler(
            _protected_event(
                method="POST",
                path="/bookings/validate",
            ),
            context=None,
        )

    assert response["statusCode"] == 401
    downstream_handler.assert_not_called()


def test_valid_rest_authorizer_claims_are_attached_and_masked():
    claims = {
        "sub": "user-123",
        "email": "customer@example.com",
        "cognito:username": "customer",
        "cognito:groups": (
            "[CUSTOMER, TRAVEL_AGENT]"
        ),
    }

    event = _protected_event(
        method="GET",
        claims=claims,
    )

    original_event = deepcopy(event)

    expected_response = {
        "statusCode": 200,
        "body": "downstream-response",
    }

    with patch.object(
        handler.HANDLER,
        "lambda_handler",
        return_value=expected_response,
    ) as downstream_handler:
        response = handler.lambda_handler(
            event,
            context="lambda-context",
        )

    assert response == expected_response

    downstream_handler.assert_called_once()

    forwarded_event = (
        downstream_handler
        .call_args
        .kwargs["event"]
    )

    forwarded_context = (
        downstream_handler
        .call_args
        .kwargs["context"]
    )

    expected_user = {
        "sub": "user-123",
        "user_id": "user-123",
        "email": "customer@example.com",
        "username": "customer",
        "role": "CUSTOMER",
        "groups": [
            "CUSTOMER",
            "TRAVEL_AGENT",
        ],
    }

    assert forwarded_context == "lambda-context"

    assert forwarded_event["authenticatedUser"] == (
        expected_user
    )

    assert (
        forwarded_event["requestContext"]
        ["authenticatedUser"]
        == expected_user
    )

    assert (
        forwarded_event["headers"]["Authorization"]
        == "***"
    )

    assert (
        forwarded_event["multiValueHeaders"]
        ["authorization"]
        == ["***"]
    )

    assert (
        forwarded_event["headers"]["X-Request-Id"]
        == "request-id"
    )

    # The original API Gateway event must not be modified.
    assert event == original_event

    assert (
        event["headers"]["Authorization"]
        == "Bearer sensitive-token"
    )


def test_http_api_jwt_claims_are_normalized():
    event = {
        "requestContext": {
            "authorizer": {
                "jwt": {
                    "claims": {
                        "sub": "jwt-user-456",
                        "email": "admin@example.com",
                        "username": "admin-user",
                        "cognito:groups": [
                            "CUSTOMER",
                        ],
                        "custom:role": "ADMIN",
                    },
                },
            },
        },
    }

    user = get_authenticated_user(event)

    assert user == {
        "sub": "jwt-user-456",
        "user_id": "jwt-user-456",
        "email": "admin@example.com",
        "username": "admin-user",
        "role": "ADMIN",
        "groups": [
            "CUSTOMER",
        ],
    }


def test_claims_without_subject_return_401():
    event = _protected_event(
        claims={
            "email": "customer@example.com",
            "cognito:username": "customer",
        },
    )

    with patch.object(
        handler.HANDLER,
        "lambda_handler",
    ) as downstream_handler:
        response = handler.lambda_handler(
            event,
            context=None,
        )

    assert response["statusCode"] == 401
    downstream_handler.assert_not_called()


def test_public_sign_in_bypasses_protected_route_context():
    event = {
        "httpMethod": "POST",
        "path": "/auth/sign-in",
        "body": "{}",
    }

    expected_response = {
        "statusCode": 200,
        "body": "sign-in-response",
    }

    with (
        patch.object(
            handler,
            "handle_sign_in",
            return_value=expected_response,
        ) as sign_in_handler,
        patch.object(
            handler,
            "_attach_authenticated_user",
        ) as attach_user,
        patch.object(
            handler.HANDLER,
            "lambda_handler",
        ) as downstream_handler,
    ):
        response = handler.lambda_handler(
            event,
            context=None,
        )

    assert response == expected_response

    sign_in_handler.assert_called_once_with(event)
    attach_user.assert_not_called()
    downstream_handler.assert_not_called()
