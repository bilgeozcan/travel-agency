# US-2 — Login and Authentication

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9961 |
| Primary actor | Registered user |
| Business capability | Authentication and session management |
| Main APIs | `POST /auth/sign-in`, `POST /auth/refresh`, `POST /auth/sign-out`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Priority | Critical |
| Dependencies | Cognito, API Gateway authorizer, secure cookies, frontend auth service, OpenAPI |

## 2. User story

**As a registered user, I want to sign in and maintain a secure session so that I can access the application features permitted for my account.**

## 3. Business value

Authentication protects customer and agent data while allowing the frontend to call secured APIs. Correct token handling, refresh-session protection and non-disclosing recovery flows reduce account and session risks.

## 4. Scope

### In scope

- Sign in.
- Access Token and ID Token response contract.
- Secure refresh session.
- Session refresh.
- Sign out and remote revocation.
- Forgot password.
- Reset password.
- Protected API authorization scopes.
- Access Token use by the frontend.
- CORS and standard response headers.

### Out of scope

- Social login.
- Multi-factor authentication unless separately approved.
- Public token inspection/debug interfaces.
- Browser storage of refresh tokens.
- Account deletion.

## 5. Preconditions

- A confirmed registered account exists for positive sign-in.
- Cognito client and authorizer configuration are available.
- Approved frontend origin and cookie settings are configured.
- Protected API routes have declared security requirements.

## 6. Main flow

1. The user submits valid email and password.
2. Cognito authenticates the credentials.
3. The backend returns the current authentication response contract.
4. The refresh token is set through a secure HttpOnly cookie.
5. The frontend stores/uses session data according to the auth design.
6. Protected API calls send the Access Token.
7. The refresh endpoint renews token data while the refresh session is valid.
8. Sign-out revokes the remote refresh session when present.
9. The local authenticated state is cleared.

## 7. Alternative and error flows

- Invalid email/password: return a generic authentication error.
- Missing/malformed/expired/invalid bearer token: reject the protected request.
- ID Token used where Access Token scope is required: reject the request.
- Missing/invalid refresh cookie: refresh is rejected.
- Sign-out without refresh cookie: return the safe documented result.
- Forgot password for unknown email: return the same external confirmation as a known email.
- Invalid/expired reset code: reject password reset.
- Cognito/dependency failure: return the mapped service error without exposing secrets.

## 8. Business and security rules

- Protected API requests use the Access Token.
- ID Token and Access Token serve different responsibilities.
- Refresh token is not returned in JSON.
- Secure-cookie attributes and CORS must support the approved browser flow.
- Error responses do not reveal unnecessary account information.
- Tokens, passwords and cookies are not logged.
- API Gateway scopes and OpenAPI security declarations remain aligned.

## 9. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US2-01** — Valid credentials return a successful sign-in response.
- [X] **AC-US2-02** — The sign-in response follows the current contract for Access Token, ID Token, expiry, token type and user data.
- [X] **AC-US2-03** — The refresh token is absent from the JSON body and is handled through a secure HttpOnly cookie.
- [X] **AC-US2-04** — Wrong-password and unknown-email attempts return a generic authentication error without account disclosure.
- [X] **AC-US2-05** — Missing, malformed, expired and invalid bearer tokens are rejected by protected endpoints.
- [X] **AC-US2-06** — Protected frontend requests use the Access Token rather than the ID Token.
- [X] **AC-US2-07** — Protected API Gateway methods declare and enforce the required Cognito scopes.
- [XX] **AC-US2-08** — A valid refresh session returns renewed token data according to the current contract.
- [X] **AC-US2-09** — Missing, invalid or expired refresh sessions are rejected without creating a new session.
- [X] **AC-US2-10** — Sign-out revokes the remote refresh session when available and remains idempotent when no cookie exists.
- [X] **AC-US2-11** — Forgot-password returns a non-disclosing external confirmation for registered and unknown emails.
- [X] **AC-US2-12** — Reset-password validates email, confirmation code and new-password rules.
- [X] **AC-US2-13** — CORS, cookie and standard API response headers match the approved authentication flow.
- [X] **AC-US2-14** — OpenAPI authentication schemas, responses and security declarations match implementation.
- [X] **AC-US2-15** — Relevant backend and frontend authentication tests pass.
- [X] **AC-US2-16** — The frontend production build passes after authentication-contract changes.

## 10. Test references

### Automated

- `pyapp/tests/test_api_handler/test_sign_in.py`
- `pyapp/tests/test_api_handler/test_refresh.py`
- `pyapp/tests/test_api_handler/test_secure_refresh_session.py`
- `pyapp/tests/test_api_handler/test_sign_out_session_revocation.py`
- `pyapp/tests/test_api_handler/test_forgot_password.py`
- `pyapp/tests/test_api_handler/test_auth_session_protected_api.py`
- `pyapp/tests/test_api_handler/test_cognito_authorizer_config.py`
- `pyapp/tests/test_api_handler/test_authorization.py`
- `frontend/src/api/services/auth.service.test.ts`
- Relevant frontend auth-state tests.

### Manual

- `../qa/manual-tests/US-02-manual-tests.md`

## 11. Traceability

- PRD: `../prd/PRD-travel-agency-app.md`
- ADR-002: `../adr/ADR-002-cognito-access-token-authorization.md`
- ADR-006: `../adr/ADR-006-openapi-contract.md`
- RTM: `../qa/traceability/requirements-traceability-matrix.md`
