# US-3 — Automatic Role Assignment

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9962 |
| Primary actor | New user / system |
| Business capability | Server-side role assignment |
| Related work | EPMTPETA-11668 — Travel Agent allowlist |
| Roles | `CUSTOMER`, `TRAVEL_AGENT`, controlled `ADMIN` |
| Priority | Critical |
| Dependencies | Registration, allowlist storage/seed, Cognito/user attributes, authorization |

## 2. User story

**As the system, I want to assign a trusted role automatically during registration so that users receive the correct access without being able to grant themselves privileges.**

## 3. Business value

Automatic role assignment reduces manual registration friction while preventing client-controlled privilege escalation. A managed Travel Agent allowlist supports approved agents without opening public privileged registration.

## 4. Scope

### In scope

- Default Customer assignment.
- Travel Agent assignment from an allowlist.
- Email normalization and case-insensitive matching.
- Duplicate allowlist prevention.
- Role persistence and consistent session return.
- Prevention of client role override.
- Controlled Admin handling.
- Role/scope enforcement on protected APIs.

### Out of scope

- Public Admin registration.
- Arbitrary frontend role selector.
- Domain-only role assignment.
- Full role-administration UI unless separately approved.

## 5. Preconditions

- Registration flow is available.
- Travel Agent allowlist storage exists and can be seeded/managed through an approved process.
- Email normalization is defined consistently.
- Protected endpoints define their allowed roles/scopes.

## 6. Decision flow

1. The registration request is validated.
2. The backend normalizes the email.
3. The backend queries the Travel Agent allowlist using the normalized value.
4. If a valid allowlist entry exists, assign `TRAVEL_AGENT`.
5. Otherwise assign `CUSTOMER`.
6. Ignore or reject untrusted role input from the client.
7. Persist the assigned role.
8. Return/use the role consistently in later session and authorization decisions.

## 7. Alternative and error flows

- Equivalent duplicate allowlist entry: prevent creation.
- Allowlist lookup failure: do not silently grant a privileged role.
- Role persistence failure: avoid inconsistent identity/profile state.
- Client requests Admin/Travel Agent role directly: do not honor the request.
- Mixed-case equivalent email: produce the same allowlist result.

## 8. Business and security rules

- Public registration defaults to Customer.
- Travel Agent requires a matching approved allowlist entry.
- Registration and allowlist use the same normalization.
- Admin cannot be granted from public input.
- Persisted role, not frontend state, drives authorization.
- Role claims/session data and protected scopes must remain consistent.

## 9. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US3-01** — A normal public registration receives the `CUSTOMER` role.
- [X] **AC-US3-02** — A normalized email present in the Travel Agent allowlist receives the `TRAVEL_AGENT` role.
- [X] **AC-US3-03** — Registration and allowlist matching use the same case-insensitive email normalization.
- [X] **AC-US3-04** — Duplicate equivalent allowlist entries are prevented.
- [X] **AC-US3-05** — Client-supplied role data cannot assign or override a privileged role.
- [X] **AC-US3-06** — Public registration cannot grant `ADMIN`.
- [X] **AC-US3-07** — The assigned role is persisted and returned consistently in sign-in/session user data.
- [X] **AC-US3-08** — Protected endpoints enforce the persisted role and required scopes.
- [X] **AC-US3-09** — A role-assignment or allowlist failure does not grant elevated access.
- [X] **AC-US3-10** — Role-assignment failure handling does not leave an inconsistent identity/profile.
- [X] **AC-US3-11** — OpenAPI security declarations are consistent with role and scope enforcement.
- [X] **AC-US3-12** — Relevant role-assignment and authorization tests pass.

## 10. Test references

### Automated

- `pyapp/tests/test_api_handler/test_role_assignment.py`
- `pyapp/tests/test_api_handler/test_signup.py`
- `pyapp/tests/test_api_handler/test_authorization.py`
- `pyapp/tests/test_api_handler/test_cognito_authorizer_config.py`
- Protected API session tests.

### Manual

- `../qa/manual-tests/US-03-manual-tests.md`

## 11. Traceability

- PRD: `../prd/PRD-travel-agency-app.md`
- ADR-003: `../adr/ADR-003-server-side-role-assignment.md`
- ADR-002: `../adr/ADR-002-cognito-access-token-authorization.md`
- RTM: `../qa/traceability/requirements-traceability-matrix.md`
