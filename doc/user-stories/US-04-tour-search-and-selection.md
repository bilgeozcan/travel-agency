# US-4 — Tour Search and Selection

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9965 |
| Primary actor | Customer |
| Business capability | Tour discovery and selection |
| APIs | `GET /tours/destinations`, `GET /tours/available` |
| Priority | High |
| Dependencies | Tour catalogue data, frontend search UI, OpenAPI |

## 2. User story

**As a Customer, I want to search and filter available tours so that I can select an option matching my destination, date, duration, guest and package preferences.**

## 3. Business value

Search and filtering reduce the time needed to identify a suitable tour and ensure customers proceed only with currently available options.

## 4. Scope

### In scope

- Destination suggestions.
- Available-tour listing.
- Destination filter.
- Start-date filter.
- Duration filter.
- Guest-quantity/capacity filter.
- Meal-plan filter.
- Tour-type filter.
- Rating and price sorting.
- Pagination.
- Loading, empty and error states.
- Search-state preservation where required by approved UX.

### Supported contract values

Sort values currently include:

- `RATING_DESC`
- `RATING_ASC`
- `PRICE_DESC`
- `PRICE_ASC`

Meal plans currently include:

- `BB`
- `HB`
- `FB`
- `AI`

Tour types currently include:

- `RESORT`
- `CRUISE`
- `HIKE`

The current OpenAPI document is authoritative if these values change.

### Out of scope

- Free-form AI recommendations.
- Payment or booking creation.
- Unapproved filters.
- Persisting searches across devices unless separately approved.

## 5. Preconditions

- Tour catalogue data is available.
- Availability data can be evaluated.
- OpenAPI defines supported query parameters and constraints.
- The frontend can distinguish request states.

## 6. Main flow

1. The Customer opens the tour search page.
2. The page loads available tours or waits for search criteria according to the approved UX.
3. The Customer enters/selects destination and optional filters.
4. The frontend sends supported query parameters.
5. The backend validates the query.
6. The backend filters to available tours satisfying all selected criteria.
7. The backend sorts and paginates the result.
8. The frontend displays matching tours and pagination state.
9. The Customer selects a tour to view details.

## 7. Alternative and error flows

- Short/invalid destination query: use the defined validation/empty-suggestion behaviour.
- Invalid enum/date/page values: return a client error.
- No matching tours: return a successful empty result.
- API failure: show an error state rather than stale success data.
- Capacity below requested guests: exclude the tour.
- Page outside the result range: follow the current API pagination contract.

## 8. Business rules

- Only available tours are returned from the available-tour operation.
- Combined filters use logical AND unless the approved contract states otherwise.
- Guest capacity must satisfy the requested guest quantity.
- Sorting must match the selected direction.
- Pagination metadata must match returned items.
- OpenAPI defines exact boundaries and enum values.

## 9. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US4-01** — Destination search returns matching unique suggestions according to the API query rules.
- [X] **AC-US4-02** — The available-tour operation returns only tours considered available by backend data.
- [X] **AC-US4-03** — Destination, start date, duration, guest quantity, meal plan and tour type filters are supported according to OpenAPI.
- [X] **AC-US4-04** — Filters work individually and in valid combinations.
- [X] **AC-US4-05** — Tours with insufficient guest capacity are excluded.
- [X] **AC-US4-06** — Rating and price sorting matches the selected supported sort direction.
- [X] **AC-US4-07** — Pagination items, page values and total metadata are consistent.
- [X] **AC-US4-08** — Invalid query parameters return the defined client error rather than a server error.
- [X] **AC-US4-09** — No-match searches return a successful empty result.
- [x] **AC-US4-10** — Frontend loading, populated, empty and API-error states are distinguishable.
- [x] **AC-US4-11** — Returning from tour details preserves search state when required by the approved UX.
- [x] **AC-US4-12** — OpenAPI query parameters, enum values, schemas and responses match implementation.
- [X] **AC-US4-13** — Relevant backend and frontend tour-search tests pass.

## 10. Test references

### Automated

- `pyapp/tests/test_api_handler/test_tour_search.py`
- `pyapp/tests/test_api_handler/test_api_response.py`
- `pyapp/tests/test_api_handler/test_component_validation.py`
- Relevant frontend tour service/component tests.

### Manual

- `../qa/manual-tests/US-04-manual-tests.md`

## 11. Traceability

- PRD: `../prd/PRD-travel-agency-app.md`
- ADR-006: `../adr/ADR-006-openapi-contract.md`
- RTM: `../qa/traceability/requirements-traceability-matrix.md`
