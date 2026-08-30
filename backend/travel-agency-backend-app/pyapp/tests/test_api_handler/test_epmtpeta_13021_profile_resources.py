import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8-sig"))

def test_cognito_client_permissions_and_profile_routes():
    resources = load("deployment_resources.json")
    pool = resources["${booking_userpool}"]
    assert set(pool["client"]["read_attributes"]) >= {"email", "email_verified", "given_name", "family_name", "picture"}
    assert set(pool["client"]["write_attributes"]) >= {"email", "given_name", "family_name", "picture"}
    statements = resources["lambda-basic-execution"]["policy_content"]["Statement"]
    actions = {
        action
        for statement in statements
        for action in statement.get("Action", [])
    }
    assert "cognito-idp:AdminGetUser" in actions
    assert "cognito-idp:ListUsers" in actions
    oas = load("openapi_travel_agency_sprint1_v1_oas_v3.json")
    for path, method in [
        ("/profile", "get"), ("/profile", "put"), ("/profile/change-password", "post"),
        ("/profile/email-change", "post"), ("/profile/email-change/confirm", "post"),
        ("/profile/email-change/resend", "post"),
    ]:
        operation = oas["paths"][path][method]
        assert operation["security"] == [{"bearerAuth": ["aws.cognito.signin.user.admin"]}]
        assert operation["x-amazon-apigateway-integration"]["type"] == "aws_proxy"

def test_postman_has_all_us12_requests_and_safe_cognito_helper_exists():
    collection = load("postman/Travel_agency_api_tests.postman_collection.json")
    folder = next(item for item in collection["item"] if item.get("name") == "US12 - Profile Management")
    urls = [item["request"]["url"]["raw"] for item in folder["item"]]
    assert "{{baseUrl}}/profile" in urls
    assert "{{baseUrl}}/profile/change-password" in urls
    assert "{{baseUrl}}/profile/email-change" in urls
    assert "{{baseUrl}}/profile/email-change/confirm" in urls
    assert "{{baseUrl}}/profile/email-change/resend" in urls
    helper = (ROOT / "deployment" / "configure_us12_cognito.py").read_text(encoding="utf-8")
    assert "AttributesRequireVerificationBeforeUpdate" in helper
    assert "update_user_pool(**payload)" in helper
