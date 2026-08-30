# Architecture Decision Records

This directory records significant technical and security decisions affecting the Travel Agency Application.

## Status values

- `Proposed` — under review.
- `Accepted` — approved/current implementation baseline.
- `Superseded` — replaced by a later ADR.
- `Deprecated` — retained for history but no longer recommended.

## ADR index

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | Use an AWS serverless backend architecture | Accepted |
| ADR-002 | Use Cognito authentication with Access Token authorization | Accepted |
| ADR-003 | Assign roles server-side using a Travel Agent allowlist | Accepted |
| ADR-004 | Enforce booking ownership and assigned-agent authorization | Accepted |
| ADR-005 | Enforce booking lifecycle rules and automatic completion | Accepted |
| ADR-006 | Use OpenAPI as the API contract and test reference | Accepted |

## ADR maintenance rule

A new ADR should be created when a change materially affects architecture, security boundaries, data ownership, external contracts, deployment topology or irreversible implementation direction. Existing ADR text should not be rewritten to hide a former decision; use a new ADR and mark the old one as superseded.
