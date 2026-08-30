# US-8 — Tour Booking Management by Travel Agent

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9969 |
| Primary actors | Travel Agent, Customer |
| Business capability | Travel Agent booking management |
| Main APIs | Booking confirmation, update/edit, cancellation, approval-state and document-rejection booking routes |
| Related work | EPMTPETA-12602, EPMTPETA-12604, EPMTPETA-12621, EPMTPETA-12792, EPMTPETA-12815, EPMTPETA-12826, EPMTPETA-12900, EPMTPETA-12916, EPMTPETA-12999, EPMTPETA-13046, EPMTPETA-13241, EPMTPETA-13242, EPMTPETA-13243, EPMTPETA-13659 |
| Priority | Required |
| Dependencies | Authentication, Access Token roles/scopes, booking storage, booking lifecycle rules, scheduled updater, OpenAPI |

## 2. User story

**As a Travel Agent, I want to manage assigned Customer bookings, including confirmation, date/accommodation changes and cancellation, so that I can process bookings safely throughout their lifecycle.**

**As a Customer, I want Travel Agent changes that require my approval to remain visible and controlled so that my booking is not silently changed.**

## 3. Business value

Travel Agent booking management is the main operational workflow after a booking is created. It enables confirmation and support while preserving assignment-based authorization, lifecycle integrity and customer visibility for material changes.

## 4. Scope

### In scope

- Booking confirmation by the assigned Travel Agent.
- Travel Agent cancellation with reason.
- Travel Agent booking edits according to approved editable states.
- Date/accommodation-related update rules.
- Staged booking edits and pending customer approval state.
- Cancellation penalty calculation where applicable.
- Automatic STARTED lifecycle transition.
- Customer email/details required by Travel Agent workflow.
- Document rejection flow.
- `canceledByRole`/cancellation actor tracking.
- Access Token based Travel Agent identity injection.
- Role-aware Travel Agent UI actions.
- Booking state-machine validation.

### Out of scope

- Travel Agent access to every booking.
- Bypassing booking lifecycle restrictions.
- Direct mutation of another agent's assigned booking.
- Silent customer-impacting edits where approval is required.
- Payment/refund settlement.
- Unapproved cancellation acceptance simulation.

## 5. Preconditions

- The Travel Agent is authenticated.
- The Access Token contains the required role/scope context.
- The booking exists and is assigned to the authenticated Travel Agent.
- The booking is in a state that permits the requested operation.
- Booking state-transition rules are configured.

## 6. Main Travel Agent flow

1. The Travel Agent signs in.
2. The Travel Agent opens the manage-bookings view.
3. The backend resolves the authenticated Travel Agent identity from the Access Token.
4. The Travel Agent opens an assigned booking.
5. The backend validates assignment and lifecycle state.
6. The Travel Agent confirms, edits, cancels or rejects a document as permitted.
7. The backend validates request-specific rules.
8. The booking is updated atomically/consistently.
9. Customer-impacting edits enter the required pending approval state.
10. The updated booking state/details are returned to the UI.

## 7. Customer interaction flow

1. A Travel Agent stages a change that requires Customer approval.
2. The booking records the pending edit.
3. The Customer sees the approval state in the permitted experience.
4. Only the approved lifecycle action applies the final mutation.

## 8. Alternative and error flows

- Invalid/missing token: reject.
- Wrong role/scope: reject.
- Booking not assigned to the Travel Agent: return protected response.
- Invalid state for confirmation/edit/cancel: return conflict and do not mutate.
- Invalid cancellation reason: return validation error.
- Invalid staged edit: reject without replacing current booking data.
- Concurrent state change: return conflict/conditional failure response.
- Scheduled transition sees ineligible booking: leave unchanged.

## 9. Business and security rules

- Travel Agents manage only assigned bookings.
- Travel Agent identity is derived from the authenticated context, not trusted from client input.
- Booking confirmation follows the defined state machine.
- Cancellation requires approved state and reason rules.
- Material edits follow staged/pending approval semantics where required.
- Invalid transitions never mutate booking data.
- Cancellation actor/role information is recorded according to the implemented contract.
- Automatic lifecycle transitions affect only eligible bookings.
- Document rejection is authorized at booking level.

## 10. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US8-01** — An authenticated assigned Travel Agent can open and manage an assigned booking.
- [X] **AC-US8-02** — Travel Agent identity is taken from the authenticated Access Token context.
- [X] **AC-US8-03** — An assigned Travel Agent can confirm a booking only from an approved lifecycle state.
- [X] **AC-US8-04** — Invalid confirmation transitions return the defined conflict/error response and do not mutate the booking.
- [X] **AC-US8-05** — An assigned Travel Agent can cancel a booking only when cancellation is permitted.
- [X] **AC-US8-06** — Travel Agent cancellation records the approved cancellation reason and cancellation actor/role data.
- [X] **AC-US8-07** — Applicable cancellation penalty logic is calculated according to the implemented rules.
- [X] **AC-US8-08** — An assigned Travel Agent can edit only the fields allowed in the current booking state.
- [X] **AC-US8-09** — Customer-impacting Travel Agent edits use staged/pending approval semantics where required.
- [X] **AC-US8-10** — Invalid or unauthorized edits leave the current booking unchanged.
- [X] **AC-US8-11** — An unassigned Travel Agent cannot read or mutate another agent's booking.
- [X] **AC-US8-12** — Unauthorized booking access does not disclose protected booking information.
- [X] **AC-US8-13** — Required Customer contact/details are available in the authorized Travel Agent booking view.
- [X] **AC-US8-14** — An assigned Travel Agent can reject a booking document through the approved document-rejection flow.
- [X] **AC-US8-15** — Eligible bookings transition automatically to STARTED according to lifecycle rules.
- [X] **AC-US8-16** — Repeated/irrelevant scheduled lifecycle execution leaves ineligible records unchanged.
- [X] **AC-US8-17** — The Travel Agent UI exposes role-appropriate confirm, edit and cancel actions.
- [X] **AC-US8-18** — Booking management routes, request/response schemas, security and status codes align with OpenAPI.
- [X] **AC-US8-19** — Booking state-machine QA coverage passes for the delivered Sprint 2 implementation.
- [X] **AC-US8-20** — Relevant backend and frontend booking-management regression checks pass.

## 11. Test references

### Automated

- `pyapp/tests/test_api_handler/test_booking_state_machine_qa.py`
- `pyapp/tests/test_api_handler/test_booking_authorization_lifecycle.py`
- `pyapp/tests/test_booking_status_updater/test_handler.py`
- Relevant frontend Travel Agent booking-management tests.

### QA / manual

- Jira QA task: `EPMTPETA-12621` — Booking state machine test suite.
- UI: Travel Agent manage booking.
- Swagger/Postman: confirm, edit, cancel, approval-state and document-rejection flows.

## 12. Traceability

- Jira story: `EPMTPETA-9969`
- Access Token authorization model.
- Booking lifecycle/state-machine rules.
- OpenAPI booking-management routes.
- Sprint 2 demo evidence: TA manage booking UI + API/network evidence.
