# ADR-005 — Enforce Booking Lifecycle Rules and Automatic Completion

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-30 |
| Scope | Booking state transitions and scheduled updates |
| Related story | US-6 |
| Related work | EPMTPETA-11672, EPMTPETA-11673 |

## Context

Booking operations must respect the current booking state. Completed tours also require a reliable transition to the finished state without depending on a user request.

## Decision

1. Booking update and cancellation permissions are evaluated against explicit lifecycle rules.
2. Only approved editable/cancellable states permit mutation.
3. Invalid transitions return a consistent state-conflict response.
4. Rejected transitions do not change the stored booking.
5. A scheduled Lambda/process identifies eligible completed bookings.
6. The scheduled process changes only eligible records to the finished state.
7. Repeated scheduled execution must not incorrectly modify already-finished or ineligible records.

## Consequences

### Positive

- Booking behaviour is predictable and testable.
- Invalid operations cannot bypass state restrictions.
- Completion does not depend on the customer revisiting the application.

### Negative

- Status names and transition rules must remain synchronized across code, tests, OpenAPI and UI.
- Date/time and scheduled-execution behaviour require deterministic tests.
- Operational monitoring is needed for scheduled failures.

## Rejected alternatives

- Allow update/cancellation regardless of current state.
- Mark bookings finished only when a user reads them.
- Let the frontend decide whether a transition is permitted.
