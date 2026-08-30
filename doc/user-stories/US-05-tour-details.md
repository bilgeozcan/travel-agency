# US-5 — Tour Details and Reviews

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9966 |
| Primary actor | Customer |
| Business capability | Tour evaluation |
| APIs | `GET /tours/{id}`, `GET /tours/{id}/reviews` |
| Priority | High |
| Dependencies | Tour catalogue, reviews, frontend details UI, OpenAPI |

## 2. User story

**As a Customer, I want to view a selected tour's details and reviews so that I can evaluate the offer before booking.**

## 3. Business value

Complete tour information and review navigation help customers make informed decisions and reduce invalid or stale booking attempts.

## 4. Scope

### In scope

- Tour retrieval by ID.
- Tour details DTO.
- Destination, rating, images and summary.
- Cancellation information.
- Duration and accommodation information.
- Meal plans and custom details.
- Dates, guest limits and prices.
- Review pagination.
- Review sorting.
- Loading, not-found and API-error states.
- Unavailable/stale-tour booking protection.

### Out of scope

- Creating or editing reviews.
- Payment.
- Unapproved recommendation logic.
- Changes to source catalogue content.

## 5. Preconditions

- A tour ID is selected from search or another valid navigation path.
- Tour/review data is accessible.
- OpenAPI defines details and review contracts.
- Frontend fallback behaviour exists for optional fields where approved.

## 6. Main flow

1. The Customer selects a tour.
2. The frontend requests the tour by ID.
3. The backend validates the ID and retrieves the matching tour.
4. The backend returns the current details contract.
5. The frontend renders available details and appropriate optional-field behaviour.
6. The frontend requests reviews using the selected page and sort order.
7. Reviews and pagination metadata are displayed.
8. The Customer proceeds to booking only when the tour is still eligible.

## 7. Alternative and error flows

- Missing/malformed ID: return the defined client error.
- Unknown ID: return the defined not-found response.
- Optional field absent: render approved fallback/omission without breaking the page.
- Tour unavailable/stale: disable or prevent active booking.
- Review page/sort invalid: return the defined validation error.
- API failure: show an error state and avoid displaying misleading stale data.

## 8. Business rules

- Returned data belongs to the requested tour ID.
- DTO, review sort options and pagination follow OpenAPI.
- Optional data absence must not corrupt page rendering.
- The booking action reflects current availability.
- Date and currency presentation follow approved Figma/localization rules.

## 9. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US5-01** — A valid tour ID returns the matching tour.
- [X] **AC-US5-02** — The response follows the current `TourDetailsDTO` contract.
- [X] **AC-US5-03** — Missing, malformed and unknown tour IDs return the defined client/not-found responses.
- [X] **AC-US5-04** — Core details such as destination, rating, summary, dates, guest limits and prices are presented when supplied.
- [X] **AC-US5-05** — Missing optional images, accommodation, meal-plan or custom-detail data does not break the details page.
- [X] **AC-US5-06** — Reviews support the page, pageSize and approved sort values defined by OpenAPI.
- [X] **AC-US5-07** — Review items and pagination metadata are consistent.
- [X] **AC-US5-08** — An unavailable or stale tour does not expose an active successful booking path.
- [X] **AC-US5-09** — Frontend loading, not-found and API-error states are distinguishable.
- [X] **AC-US5-10** — Date and currency presentation follows the approved design/localization rules.
- [X] **AC-US5-11** — OpenAPI detail/review schemas, parameters and responses match implementation.
- [X] **AC-US5-12** — Relevant backend and frontend tour-detail/review tests pass.

## 10. Test references

### Automated

- `pyapp/tests/test_api_handler/test_tours.py`
- `pyapp/tests/test_api_handler/test_api_response.py`
- `pyapp/tests/test_api_handler/test_component_validation.py`
- Relevant frontend tour-details/reviews tests.

### Manual

- `../qa/manual-tests/US-05-manual-tests.md`

## 11. Traceability

- PRD: `../prd/PRD-travel-agency-app.md`
- ADR-006: `../adr/ADR-006-openapi-contract.md`
- RTM: `../qa/traceability/requirements-traceability-matrix.md`
