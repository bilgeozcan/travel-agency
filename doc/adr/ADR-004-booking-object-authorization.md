# ADR-004 — Enforce Booking Ownership and Assigned-Agent Authorization

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-30 |
| Scope | Booking read, update, cancellation and listing |
| Related story | US-6 |
| Related work | EPMTPETA-11672, EPMTPETA-11674 |

## Context

Role-level authorization alone does not prevent one Customer from accessing another Customer's booking or an unassigned Travel Agent from accessing unrelated bookings. Error behaviour must not reveal whether a foreign booking exists.

## Decision

1. Every protected booking operation derives identity and role from the authenticated context.
2. A Customer can access only bookings they own.
3. A Travel Agent can access only bookings assigned to them.
4. Authorization applies to booking read, update and delete/cancel operations.
5. Customer booking-list/My Tours results are filtered to the authenticated Customer.
6. Unauthorized foreign-object access returns a consistent response that does not disclose object existence.
7. Authorization is evaluated before returning or mutating protected booking data.

## Consequences

### Positive

- Booking data is protected at object level.
- The same rule applies across read and write operations.
- Foreign-booking enumeration is reduced.
- My Tours provides isolated customer data.

### Negative

- Every handler requires reliable authenticated identity context.
- Tests require multiple Customers and multiple Travel Agents.
- Consistent not-found/forbidden handling can make diagnostics less obvious without internal logs.

## Rejected alternatives

- Check only whether the caller has a valid token.
- Let all Travel Agents access all bookings.
- Return different public errors for nonexistent and unauthorized foreign bookings.
