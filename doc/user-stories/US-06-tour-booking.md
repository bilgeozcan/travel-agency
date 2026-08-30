# US-6 — Tour Booking and My Tours

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9967 |
| Primary actors | Customer, assigned Travel Agent |
| Business capability | Booking creation and lifecycle management |
| Main APIs | `POST /bookings`, `GET /bookings`, booking detail/update/delete routes, `POST /bookings/validate` |
| Related work | EPMTPETA-11672, EPMTPETA-11673, EPMTPETA-11674 |
| Priority | Critical |
| Dependencies | Authentication, authorization, tour availability, booking storage, scheduled updater, OpenAPI |

## 2. User story

**As a Customer, I want to book an available tour and view my tours so that I can manage my travel plans securely.**

**As an assigned Travel Agent, I want to access only my assigned bookings so that I can support customers without seeing unrelated booking data.**

## 3. Business value

Booking is the primary transactional capability of the application. Current-data validation protects availability and price integrity, while object-level authorization protects customer information and assigned-agent boundaries.

## 4. Scope

### In scope

- Booking validation.
- Booking creation.
- Required booking/personal fields.
- Availability, package, date, duration, capacity and price revalidation.
- Customer booking ownership.
- Assigned Travel Agent access.
- Read, update and cancellation authorization.
- Non-disclosing unauthorized responses.
- Booking-state/lifecycle restrictions.
- My Tours customer isolation.
- Automatic transition of eligible completed bookings.
- Access-token authorization for booking endpoints.

### Out of scope

- Payment execution.
- Refund settlement.
- Public booking without authentication.
- Access to all bookings by every Travel Agent.
- Frontend-only authorization.
- Unapproved duplicate/idempotency semantics.

## 5. Preconditions

- The Customer has a valid authenticated session.
- The selected tour/package exists and is available for validation.
- Booking status rules are defined.
- Customer and Travel Agent identities/roles are available in the authenticated context.
- The scheduled updater is deployed/configured where automatic completion is required.

## 6. Main customer flow

1. The Customer selects a tour and booking options.
2. The frontend submits validation or booking data with the Access Token.
3. The backend validates authentication and role.
4. The backend validates required request data.
5. The backend re-reads current tour/package data.
6. The backend validates date, duration, capacity, availability and quoted price.
7. The backend creates one consistent booking.
8. The Customer receives confirmation.
9. The booking appears in the authenticated Customer's My Tours list.
10. Later read/update/cancel operations validate ownership and lifecycle rules.

## 7. Travel Agent flow

1. The Travel Agent signs in and receives an authorized session.
2. The Travel Agent requests a booking.
3. The backend verifies that the booking is assigned to that Travel Agent.
4. The permitted data/operation is returned only when role, assignment and lifecycle rules allow it.

## 8. Alternative and error flows

- No/invalid token: reject before business processing.
- Wrong token type or missing scope: reject the protected operation.
- Invalid request fields: return the defined validation response.
- Unavailable/stale package or price: return conflict/validation result and create no booking.
- Customer requests another customer's booking: return a consistent non-disclosing response.
- Unassigned Travel Agent requests a booking: return the same protected response pattern.
- Invalid update/cancel state: reject without mutation.
- Scheduled process encounters ineligible booking: leave it unchanged.

## 9. Business and security rules

- Booking creation is server-authorized and server-validated.
- Frontend availability and price are not authoritative.
- Customers access only owned bookings.
- Travel Agents access only assigned bookings.
- Authorization is checked before returning or mutating booking data.
- Unauthorized object responses do not reveal whether the foreign booking exists.
- Only approved statuses permit update or cancellation.
- Invalid transitions do not mutate data.
- My Tours is filtered by authenticated customer identity.
- The scheduled updater changes only eligible records.
- Exact status names and transition matrix follow approved implementation/OpenAPI requirements.

## 10. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US6-01** — An authenticated Customer can create a valid booking for an available tour.
- [X] **AC-US6-02** — Unauthenticated, invalid-token, wrong-token-type and unauthorized booking requests are rejected.
- [X] **AC-US6-03** — Required tour, date, duration, meal-plan, guest and personal-detail values are validated.
- [X] **AC-US6-04** — Current package, date, duration, availability, capacity and quoted price are revalidated before booking creation.
- [X] **AC-US6-05** — Invalid, unavailable or stale selections return the defined conflict/validation response and create no booking.
- [X] **AC-US6-06** — A successful request creates one consistent booking and returns the current success contract.
- [X] **AC-US6-07** — The booking owner can retrieve permitted booking data.
- [X] **AC-US6-08** — A different Customer cannot read, update or cancel the booking.
- [X] **AC-US6-09** — An assigned Travel Agent can access the assigned booking only as permitted.
- [X] **AC-US6-10** — An unassigned Travel Agent cannot access or mutate the booking.
- [X] **AC-US6-11** — Unauthorized object access does not disclose whether another user's booking exists.
- [X] **AC-US6-12** — Booking update and cancellation are permitted only in approved lifecycle states.
- [X] **AC-US6-13** — Invalid state transitions return the defined conflict response and leave the booking unchanged.
- [X] **AC-US6-14** — My Tours returns only bookings owned by the authenticated Customer.
- [X] **AC-US6-15** — The scheduled updater marks only eligible completed bookings as finished.
- [X] **AC-US6-16** — Repeated scheduled execution leaves finished and otherwise ineligible bookings unchanged.
- [X] **AC-US6-17** — `POST /bookings/validate` is protected by the required Access Token authorization model.
- [X] **AC-US6-18** — OpenAPI booking routes, security, schemas, status codes and responses match implementation.
- [X] **AC-US6-19** — Relevant booking, authorization, My Tours and scheduled-updater tests pass.
- [X] **AC-US6-20** — Relevant frontend booking tests/build pass when frontend behaviour is affected.

## 11. Test references

### Automated

- `pyapp/tests/test_api_handler/test_bookings.py`
- `pyapp/tests/test_api_handler/test_booking_validation.py`
- `pyapp/tests/test_api_handler/test_booking_authorization_lifecycle.py`
- `pyapp/tests/test_api_handler/test_customer_my_tours.py`
- `pyapp/tests/test_api_handler/test_authorization.py`
- `pyapp/tests/test_booking_status_updater/test_handler.py`
- Relevant frontend booking tests.

### Manual

- `../qa/manual-tests/US-06-manual-tests.md`

## 12. Traceability

- PRD: `../prd/PRD-travel-agency-app.md`
- ADR-002: `../adr/ADR-002-cognito-access-token-authorization.md`
- ADR-004: `../adr/ADR-004-booking-object-authorization.md`
- ADR-005: `../adr/ADR-005-booking-lifecycle-auto-finish.md`
- ADR-006: `../adr/ADR-006-openapi-contract.md`
- RTM: `../qa/traceability/requirements-traceability-matrix.md`
