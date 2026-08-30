# Existing Automated Test Suite Map

| User Story / Cross-cutting area | Observed test file | Main coverage |
|---|---|---|
| US-1 | `pyapp/tests/test_api_handler/test_signup.py` | Happy path, email/name/password validation, malformed JSON, duplicate email, normalization |
| US-1 | `pyapp/tests/test_api_handler/test_profile_email_immutability.py` | Prevent Customer and Travel Agent email changes |
| US-2 | `pyapp/tests/test_api_handler/test_sign_in.py` | Cognito sign-in and mapped authentication responses |
| US-2 | `pyapp/tests/test_api_handler/test_refresh.py` | Refresh request behaviour |
| US-2 | `pyapp/tests/test_api_handler/test_secure_refresh_session.py` | Secure refresh-cookie and response contract |
| US-2 | `pyapp/tests/test_api_handler/test_sign_out_session_revocation.py` | Sign-out, revocation and idempotency |
| US-2 | `pyapp/tests/test_api_handler/test_forgot_password.py` | Forgot/reset positive, negative, throttling and service errors |
| US-2/3 | `pyapp/tests/test_api_handler/test_auth_session_protected_api.py` | Auth session and protected API use |
| US-2/3 | `pyapp/tests/test_api_handler/test_cognito_authorizer_config.py` | API Gateway/Cognito authorizer configuration |
| US-2/3/6 | `pyapp/tests/test_api_handler/test_authorization.py` | Role/scope authorization and protected routes |
| US-3 | `pyapp/tests/test_api_handler/test_role_assignment.py` | Automatic role assignment |
| US-4 | `pyapp/tests/test_api_handler/test_tour_search.py` | Availability, filters, capacity, sorting, pagination, invalid query and empty results |
| US-5 | `pyapp/tests/test_api_handler/test_tours.py` | Tour data/details routes |
| US-6 | `pyapp/tests/test_api_handler/test_bookings.py` | Booking CRUD/business flow |
| US-6 | `pyapp/tests/test_api_handler/test_booking_validation.py` | Availability, data and conflict validation |
| US-6 | `pyapp/tests/test_api_handler/test_booking_authorization_lifecycle.py` | Ownership, assigned-agent access and state rules |
| US-6 | `pyapp/tests/test_api_handler/test_customer_my_tours.py` | Customer-only My Tours result |
| US-6 | `pyapp/tests/test_booking_status_updater/test_handler.py` | Automatic finish scheduled Lambda |
| Cross-cutting | `pyapp/tests/test_api_handler/test_api_response.py` | Standard response headers/body behaviour |
| Cross-cutting | `pyapp/tests/test_api_handler/test_component_validation.py` | Shared validation |
| Cross-cutting | `pyapp/tests/test_api_handler/test_success.py` | Handler routing/general response |
| Frontend auth | Project frontend test suite | Access Token usage, auth state and protected calls |
| Frontend integration | Production build | Type/build integration and bundling |

## Recommended additions

- Contract tests that compare implemented routes/status/schema with OpenAPI.
- Frontend component tests for registration validation and post-success redirect.
- Frontend tests for tour loading, empty, failure and stale-tour states.
- Browser-level smoke tests for sign-up → sign-in → search → details → booking → My Tours → sign-out.
- A concurrency/idempotency integration test for duplicate booking creation.
- Accessibility checks for forms, focus order, error association and keyboard operation.
