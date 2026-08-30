import json
from unittest.mock import patch
import pytest
from botocore.exceptions import ClientError, EndpointConnectionError
from lambdas.api_handler import profile

def event(role="ADMIN"):
    return {"authenticatedUser": {"sub": "u1", "username": "only-me", "email": "old@example.com", "role": role, "groups": [role]}}

@pytest.mark.parametrize("role", ["CUSTOMER", "TRAVEL_AGENT", "ADMIN"])
def test_get_profile_uses_authenticated_principal_only(role):
    with patch.object(profile, "_CUP_ID", "pool"), patch.object(
        profile.cognito_client, "admin_get_user",
        return_value={"UserAttributes": [
            {"Name": "email", "Value": "me@example.com"},
            {"Name": "given_name", "Value": "Jane"},
            {"Name": "family_name", "Value": "Doe"},
            {"Name": "picture", "Value": "profiles/me.jpg"},
        ]},
    ) as get:
        e = event(role)
        e["queryStringParameters"] = {"userId": "other-user"}
        response = profile.handle_get_profile(e)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["user"] == {
        "email": "me@example.com", "firstName": "Jane", "lastName": "Doe", "role": role, "profilePhoto": "profiles/me.jpg"
    }
    get.assert_called_once_with(UserPoolId="pool", Username="only-me")

@pytest.mark.parametrize("error,status", [
    (ClientError({"Error": {"Code": "UserNotFoundException", "Message": "missing"}}, "AdminGetUser"), 401),
    (EndpointConnectionError(endpoint_url="https://cognito.invalid"), 503),
])
def test_get_profile_maps_cognito_failures(error, status):
    with patch.object(profile, "_CUP_ID", "pool"), patch.object(profile.cognito_client, "admin_get_user", side_effect=error):
        assert profile.handle_get_profile(event())["statusCode"] == status
