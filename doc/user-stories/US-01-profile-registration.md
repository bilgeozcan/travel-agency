# US-1 — User Profile Registration

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9960 |
| Primary actor | New user |
| Business capability | Account creation |
| Main API | `POST /auth/sign-up` |
| Related work | EPMTPETA-11667 — Prevent email changes |
| Priority | High |
| Dependencies | Cognito, profile persistence, role assignment, Figma registration form, OpenAPI |

## 2. User story

**As a new user, I want to create a profile with my personal and authentication information so that I can sign in and use the Travel Agency Application.**

## 3. Business value

Registration is the entry point to authenticated customer journeys. Correct validation and uniqueness rules protect account integrity, while immutable email behaviour prevents identity inconsistencies after registration.

## 4. Scope

### In scope

- First name.
- Last name.
- Email.
- Password.
- Confirm password.
- Required-field validation.
- Email-format validation.
- Password-strength validation.
- Password-confirmation matching.
- Email normalization and uniqueness.
- Successful registration confirmation.
- Redirect to Sign in.
- Prevention of later email changes for Customer and Travel Agent profiles.

### Out of scope

- Public role selection.
- Public Admin registration.
- Social login.
- Unapproved profile fields.
- Email-change workflow.

## 5. Preconditions

- The registration API and registration page are available.
- Cognito and application profile storage are configured.
- Validation rules are available from Figma, the Knowledge Base and OpenAPI.
- The user is not already authenticated where the approved UX requires this.

## 6. Main flow

1. The user opens the registration page.
2. The user enters first name, last name, email, password and confirm password.
3. The frontend validates required and format constraints.
4. The backend validates the request independently.
5. The backend normalizes the email.
6. The system verifies that the normalized email is unique.
7. The system assigns the role through server-side role-assignment rules.
8. The identity and profile are created consistently.
9. The application shows a successful registration confirmation.
10. The application directs the user to Sign in.

## 7. Alternative and error flows

- Missing or invalid field: registration is rejected and no account is created.
- Password mismatch: registration is blocked.
- Weak password: registration is rejected according to the approved password policy.
- Existing normalized email: duplicate registration is rejected.
- Malformed JSON: the API returns a client error.
- Identity/profile dependency failure: no inconsistent partial profile should remain.
- Profile update includes another email: the email change is rejected.

## 8. Business rules

- Email uniqueness uses the normalized email value.
- Registration and allowlist matching use the same email normalization.
- Password and confirmation must match.
- Passwords and secrets are never returned in the response.
- Public request data cannot select a privileged role.
- Exact field lengths and UI messages follow the current Figma/Knowledge Base.

## 9. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US1-01** — The registration form and request contain first name, last name, email, password and confirm password.
- [X] **AC-US1-02** — Required fields, name values, email format and password strength are validated by the application.
- [X] **AC-US1-03** — Registration is rejected when password and confirm password do not match.
- [X] **AC-US1-04** — A valid registration request creates one consistent identity/profile.
- [X] **AC-US1-05** — Email is normalized before uniqueness and role-assignment checks.
- [X] **AC-US1-06** — An existing equivalent email cannot be registered again.
- [X] **AC-US1-07** — Malformed or invalid registration requests return the defined client error and create no partial account.
- [X] **AC-US1-08** — The successful response contains no password, refresh token or other secret.
- [X] **AC-US1-09** — Successful UI registration shows confirmation and redirects the user to Sign in.
- [X] **AC-US1-10** — Customer and Travel Agent profile updates cannot change the account email.
- [X] **AC-US1-11** — OpenAPI registration/profile definitions match implemented request, response and error behaviour.
- [X] **AC-US1-12** — Relevant registration and email-immutability automated tests pass.

## 10. Test references

### Automated

- `pyapp/tests/test_api_handler/test_signup.py`
- `pyapp/tests/test_api_handler/test_profile_email_immutability.py`
- Relevant API response/header regression tests.
- Relevant frontend registration tests where present.

### Manual

- `../qa/manual-tests/US-01-manual-tests.md`

## 11. Traceability

- PRD: `../prd/PRD-travel-agency-app.md`
- ADR-003: `../adr/ADR-003-server-side-role-assignment.md`
- ADR-006: `../adr/ADR-006-openapi-contract.md`
- RTM: `../qa/traceability/requirements-traceability-matrix.md`
