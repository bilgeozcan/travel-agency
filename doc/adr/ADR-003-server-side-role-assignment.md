# ADR-003 — Assign Roles Server-Side Using a Travel Agent Allowlist

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07 |
| Scope | Registration and role assignment |
| Related stories | US-1 and US-3 |

## Context

Public registration must support normal Customers and pre-approved Travel Agents. Allowing clients to submit a trusted role would create a privilege-escalation path. Email variations could also create inconsistent allowlist results.

## Decision

1. Role assignment is performed by trusted backend logic.
2. Public registration defaults to `CUSTOMER`.
3. A normalized email present in the Travel Agent allowlist is assigned `TRAVEL_AGENT`.
4. Registration and allowlist storage use the same normalization rule.
5. Matching is case-insensitive.
6. Duplicate equivalent allowlist entries are prevented.
7. Client-supplied privileged role data is ignored or rejected.
8. `ADMIN` is not granted from public registration input.
9. The assigned role is persisted and used by authorization decisions.

## Consequences

### Positive

- Public users cannot select their own privileged role.
- Travel Agent onboarding is deterministic and auditable.
- Email case differences do not create inconsistent assignments.

### Negative

- The allowlist requires an approved management/seed process.
- Incorrect allowlist data can assign the wrong non-admin role.
- Registration depends on consistent identity and application-data handling.

## Rejected alternatives

- Let the frontend send the requested role.
- Infer Travel Agent status from email domain alone.
- Grant Admin through the same public allowlist.
