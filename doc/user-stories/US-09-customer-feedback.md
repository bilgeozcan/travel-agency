# US-9 — Customer Feedback

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9970 |
| Primary actors | Customer |
| Business capability | Tour feedback submission, retrieval and update |
| Main APIs | Feedback submit/update routes and booking response feedback projection |
| Related work | EPMTPETA-12617, EPMTPETA-12620, EPMTPETA-12623, EPMTPETA-13053, EPMTPETA-13058, EPMTPETA-13605, EPMTPETA-13614 |
| Priority | Required |
| Dependencies | Authentication, booking ownership, booking lifecycle, reporting event queue, OpenAPI |

## 2. User story

**As a Customer, I want to submit, view and update feedback about my travel experience so that I can rate the completed service and provide useful comments to the Travel Agency.**

## 3. Business value

Feedback creates a measurable quality signal for the Travel Agency and feeds reporting/operational analysis. Ownership and lifecycle controls prevent feedback from being submitted for unrelated or ineligible bookings.

## 4. Scope

### In scope

- Feedback form UI.
- Star/rating validation.
- Comment validation.
- Feedback submission.
- Existing feedback retrieval/view.
- Feedback update.
- Existing feedback details included in booking responses.
- Booking ownership authorization.
- Eligible booking-state validation.
- Feedback events published to the reports queue.
- API integration and error handling.

### Out of scope

- Anonymous/public reviews.
- Feedback on another Customer's booking.
- Multiple independent feedback records for one booking where the implementation uses one current record.
- Free-form moderation workflows.
- Public marketplace review publishing.

## 5. Preconditions

- The Customer is authenticated.
- The booking belongs to the Customer.
- The booking is eligible for feedback according to lifecycle rules.
- Feedback validation rules are available.
- Reporting event infrastructure is configured when feedback events are published.

## 6. Main customer flow

1. The Customer opens an eligible booking.
2. The UI displays the feedback action/form.
3. The Customer selects a rating and optionally/mandatorily enters comment data according to the implemented rules.
4. Frontend validation runs.
5. The request is sent with the Access Token.
6. The backend verifies Customer ownership and feedback eligibility.
7. The backend validates feedback values.
8. Feedback is persisted.
9. The updated feedback is returned or reflected in the booking response.
10. A reporting event is published where configured.

## 7. Update/view flow

1. The Customer opens a booking that already has feedback.
2. Existing feedback details are returned in the booking response.
3. The UI renders the current feedback.
4. The Customer edits permitted feedback values.
5. The backend validates ownership and input again.
6. The existing feedback is updated according to the current contract.

## 8. Alternative and error flows

- Missing/invalid token: reject.
- Booking not owned by Customer: protected response.
- Booking not eligible for feedback: conflict/validation response.
- Invalid star/rating value: validation response.
- Invalid comment length/content according to rules: validation response.
- Update without existing/eligible feedback: return defined response.
- Report queue failure is handled according to the implemented event-publishing policy.

## 9. Business and security rules

- Feedback is associated with an authenticated Customer booking.
- Customers cannot submit or update feedback for foreign bookings.
- Rating/comment values follow server-side validation.
- Existing feedback is exposed only through authorized booking access.
- Update behavior follows the one-feedback-per-booking/current-record contract.
- Feedback reporting events contain only the data required by the reporting pipeline.

## 10. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US9-01** — An authenticated Customer can submit valid feedback for an owned eligible booking.
- [X] **AC-US9-02** — The backend verifies booking ownership before accepting feedback.
- [X] **AC-US9-03** — A Customer cannot submit feedback for another Customer's booking.
- [X] **AC-US9-04** — Feedback eligibility is validated against the implemented booking lifecycle rules.
- [X] **AC-US9-05** — Rating/star values are validated against the supported range.
- [X] **AC-US9-06** — Comment input is validated according to the implemented rules.
- [X] **AC-US9-07** — Invalid feedback requests do not create or corrupt feedback data.
- [X] **AC-US9-08** — Existing feedback details are included in the authorized booking response.
- [X] **AC-US9-09** — The frontend can display existing feedback for the Customer.
- [X] **AC-US9-10** — An authenticated Customer can update existing feedback through the supported update flow.
- [X] **AC-US9-11** — Feedback update repeats ownership and validation checks.
- [X] **AC-US9-12** — Unauthorized feedback access follows the protected response pattern.
- [X] **AC-US9-13** — Successful feedback activity publishes the required event to the reporting pipeline where configured.
- [X] **AC-US9-14** — Feedback submit/update contracts match the current OpenAPI definition.
- [X] **AC-US9-15** — Frontend feedback form, star/comment validation and API integration checks pass.
- [X] **AC-US9-16** — Relevant backend/QA feedback tests pass for submission, retrieval and update behavior.

## 11. Test references

### Automated / QA

- Jira QA task: `EPMTPETA-12623` — Feedback test cases.
- `pyapp/tests/test_api_handler/` — feedback, booking ownership and response projection coverage.
- Relevant frontend feedback form/API integration tests.

### Manual

- UI: feedback form, existing feedback view and update.
- DevTools Network: feedback payload/status/response.
- Swagger/Postman: submit and update flows.

## 12. Traceability

- Jira story: `EPMTPETA-9970`
- Reporting integration: feedback events to reports queue.
- Booking ownership/lifecycle rules.
- OpenAPI feedback routes.
- Sprint 2 demo evidence: feedback UI + payload/API verification.
