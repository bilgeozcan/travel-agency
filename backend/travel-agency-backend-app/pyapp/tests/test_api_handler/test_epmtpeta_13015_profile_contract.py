import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OAS = (
    ROOT
    / "openapi_travel_agency_sprint1_v1_oas_v3.json"
)

def test_us12_contract_security_and_schemas():
    doc = json.loads(
        OAS.read_text(encoding="utf-8-sig")
    )
    targets = [
        ("/profile", "get"),
        ("/profile", "put"),
        ("/profile/change-password", "post"),
        ("/profile/email-change", "post"),
        (
            "/profile/email-change/confirm",
            "post",
        ),
        (
            "/profile/email-change/resend",
            "post",
        ),
    ]

    for path, method in targets:
        operation = doc["paths"][path][method]
        assert operation["security"] == [
            {
                "bearerAuth": [
                    "aws.cognito.signin.user.admin"
                ]
            }
        ]
        integration = operation[
            "x-amazon-apigateway-integration"
        ]
        assert integration["type"] == "aws_proxy"
        assert integration["httpMethod"] == "POST"

    schemas = doc["components"]["schemas"]

    assert (
        schemas["ProfileDTO"]["properties"][
            "role"
        ]["enum"]
        == [
            "CUSTOMER",
            "TRAVEL_AGENT",
            "ADMIN",
        ]
    )
    assert (
        "profilePhoto"
        in schemas["ProfileDTO"]["properties"]
    )

    update = schemas["UpdateProfileRequestDTO"]
    assert update["additionalProperties"] is False
    assert "profilePhoto" in update["properties"]
    assert (
        update["properties"]["firstName"][
            "pattern"
        ]
        == "^[A-Za-z'-]+$"
    )
    assert (
        update["properties"]["lastName"][
            "pattern"
        ]
        == "^[A-Za-z'-]+$"
    )
    description = update["properties"]["email"][
        "description"
    ]
    assert (
        "must match the registered email"
        in description
    )
    assert (
        "/profile/email-change"
        in description
    )

    password = schemas[
        "ChangePasswordRequestDTO"
    ]
    assert (
        password["properties"]["newPassword"][
            "minLength"
        ]
        == 8
    )
    assert (
        password["properties"]["newPassword"][
            "maxLength"
        ]
        == 64
    )
    assert (
        schemas["EmailChangeRequestDTO"][
            "required"
        ]
        == [
            "newEmail",
            "currentPassword",
        ]
    )
    assert (
        schemas[
            "EmailChangeConfirmRequestDTO"
        ]["required"]
        == ["code"]
    )
