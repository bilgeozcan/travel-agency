from pathlib import Path
import ast
import json
import unittest


BACKEND_ROOT = Path(__file__).resolve().parents[3]

OPENAPI_PATH = (
    BACKEND_ROOT
    / "openapi_travel_agency_sprint1_v1_oas_v3.json"
)

HANDLER_PATH = (
    BACKEND_ROOT
    / "pyapp"
    / "src"
    / "lambdas"
    / "api_handler"
    / "handler.py"
)

AUTH_SCHEME_NAME = "bearerAuth"
ACCESS_TOKEN_SCOPE = "aws.cognito.signin.user.admin"

PUBLIC_AUTH_ROUTES = {
    ("POST", "/auth/sign-up"),
    ("POST", "/auth/sign-in"),
}


def _load_openapi():
    with OPENAPI_PATH.open(
        "r",
        encoding="utf-8-sig",
    ) as file:
        return json.load(file)


def _load_handler_protected_routes():
    source = HANDLER_PATH.read_text(
        encoding="utf-8-sig",
    )

    tree = ast.parse(source)

    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue

        assigned_names = {
            target.id
            for target in node.targets
            if isinstance(target, ast.Name)
        }

        if "PROTECTED_ROUTES" in assigned_names:
            return set(
                ast.literal_eval(node.value)
            )

    raise AssertionError(
        "PROTECTED_ROUTES was not found in handler.py"
    )


def _operation_uses_authorizer(operation):
    security = operation.get("security") or []

    return any(
        isinstance(requirement, dict)
        and AUTH_SCHEME_NAME in requirement
        for requirement in security
    )


def _openapi_protected_routes(document):
    protected_routes = set()

    for route, path_item in document[
        "paths"
    ].items():
        if not isinstance(path_item, dict):
            continue

        for method, operation in path_item.items():
            if not isinstance(operation, dict):
                continue

            if _operation_uses_authorizer(operation):
                protected_routes.add(
                    (
                        method.upper(),
                        route,
                    )
                )

    return protected_routes


class TestCognitoAuthorizerConfiguration(
    unittest.TestCase
):

    @classmethod
    def setUpClass(cls):
        cls.openapi = _load_openapi()

    def test_cognito_authorizer_scheme(self):
        schemes = (
            self.openapi
            ["components"]
            ["securitySchemes"]
        )

        self.assertIn(
            AUTH_SCHEME_NAME,
            schemes,
        )

        scheme = schemes[
            AUTH_SCHEME_NAME
        ]

        self.assertEqual(
            scheme["type"],
            "apiKey",
        )
        self.assertEqual(
            scheme["name"],
            "Authorization",
        )
        self.assertEqual(
            scheme["in"],
            "header",
        )
        self.assertEqual(
            scheme[
                "x-amazon-apigateway-authtype"
            ],
            "cognito_user_pools",
        )

        authorizer = scheme[
            "x-amazon-apigateway-authorizer"
        ]

        self.assertEqual(
            authorizer["type"],
            "cognito_user_pools",
        )
        self.assertEqual(
            authorizer[
                "x-syndicate-cognito-userpool-names"
            ],
            ["${booking_userpool}"],
        )

    def test_protected_routes_use_authorizer(self):
        protected_routes = (
            _openapi_protected_routes(
                self.openapi
            )
        )

        self.assertIn(
            ("GET", "/bookings"),
            protected_routes,
        )
        self.assertIn(
            ("POST", "/bookings"),
            protected_routes,
        )
        self.assertIn(
            ("POST", "/bookings/validate"),
            protected_routes,
        )

    def test_protected_routes_require_access_token_scope(
        self,
    ):
        for method, route in sorted(
            _openapi_protected_routes(self.openapi)
        ):
            with self.subTest(
                method=method,
                route=route,
            ):
                operation = (
                    self.openapi
                    ["paths"]
                    [route]
                    [method.lower()]
                )
                matching_requirements = [
                    requirement
                    for requirement in operation["security"]
                    if AUTH_SCHEME_NAME in requirement
                ]

                self.assertEqual(
                    len(matching_requirements),
                    1,
                )
                self.assertEqual(
                    matching_requirements[0][
                        AUTH_SCHEME_NAME
                    ],
                    [ACCESS_TOKEN_SCOPE],
                )

    def test_public_auth_routes_are_unprotected(
        self,
    ):
        for method, route in PUBLIC_AUTH_ROUTES:
            with self.subTest(
                method=method,
                route=route,
            ):
                operation = (
                    self.openapi
                    ["paths"]
                    [route]
                    [method.lower()]
                )

                self.assertFalse(
                    _operation_uses_authorizer(
                        operation
                    )
                )

    def test_options_operations_are_unprotected(
        self,
    ):
        for route, path_item in self.openapi[
            "paths"
        ].items():
            if not isinstance(path_item, dict):
                continue

            options = path_item.get(
                "options"
            )

            if options is None:
                continue

            self.assertFalse(
                _operation_uses_authorizer(
                    options
                ),
                msg=(
                    "OPTIONS operation must remain "
                    f"public: {route}"
                ),
            )

    def test_handler_and_openapi_routes_match(
        self,
    ):
        handler_routes = (
            _load_handler_protected_routes()
        )

        openapi_routes = (
            _openapi_protected_routes(
                self.openapi
            )
        )

        self.assertEqual(
            handler_routes,
            openapi_routes,
        )


if __name__ == "__main__":
    unittest.main()
