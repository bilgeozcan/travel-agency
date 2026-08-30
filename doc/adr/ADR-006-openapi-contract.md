# ADR-006 — Use OpenAPI as the API Contract and Test Reference

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07 |
| Scope | API documentation, integration and regression |
| Related stories | US-1 through US-6 |

## Context

Backend handlers, API Gateway security, frontend services and tests must agree on routes, parameters, request/response bodies, enums, status codes and authorization requirements. Uncoordinated changes create integration failures.

## Decision

1. The repository OpenAPI document is the formal API contract.
2. Endpoint changes include corresponding OpenAPI updates.
3. Protected methods declare their security scheme and required scopes.
4. Schemas, enum values and status codes are kept aligned with implementation.
5. Automated tests validate important OpenAPI security and behavioural declarations.
6. OpenAPI JSON validity is checked before merge/deployment.
7. Frontend integrations follow the approved contract instead of undocumented handler behaviour.

## Consequences

### Positive

- API expectations are visible to backend, frontend and QA.
- Security changes become reviewable contract changes.
- Contract drift can be detected through tests and validation.

### Negative

- Every API change requires documentation maintenance.
- A syntactically valid document can still be semantically inconsistent, so behavioural tests remain necessary.
- Merge conflicts may occur in the shared OpenAPI file.

## Rejected alternatives

- Treat implementation code as the only documentation.
- Maintain separate, manually synchronized endpoint notes.
- Update OpenAPI only after development is complete.
