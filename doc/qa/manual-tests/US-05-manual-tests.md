# US-5 Manual Test Cases – Tour Details and Reviews

| ID | Type | Scenario | Preconditions | Steps | Expected result |
|---|---|---|---|---|---|
| US5-M-001 | Positive | Open valid tour details | Known valid tour ID | Open details/call `/tours/{id}` | Correct tour is returned and mandatory DTO fields render |
| US5-M-002 | Negative | Invalid or missing tour ID | None | Call with malformed, unknown and missing ID | Defined validation/not-found result; UI shows appropriate state |
| US5-M-003 | Robustness | Optional detail fields absent | Tour fixture with missing optional image/hotel/custom data | Open details | Page remains usable; fallback/omission follows approved design |
| US5-M-004 | State | Unavailable/stale tour | Tour becomes unavailable | Open/refetch details and attempt booking | Unavailable state is visible; active booking action is disabled/rejected |
| US5-M-005 | Positive | Review pagination | Tour has more than one review page | Request first, next and last page | Correct reviews and consistent pagination metadata |
| US5-M-006 | Positive | Review sort orders | Reviews with varied ratings/dates | Execute each supported sort | Ordering matches rating/date selection |
| US5-M-007 | Boundary | Review page/pageSize validation | API client available | Use minimum, valid and invalid values | Valid boundaries succeed; invalid values follow API validation contract |
| US5-M-008 | UI | Loading and API failure | Network throttling/devtools available | Delay/fail details and review requests | Loading indicator appears; failure state does not display stale or broken details |
