# US-4 Manual Test Cases – Tour Search and Selection

| ID | Type | Scenario | Preconditions | Steps | Expected result |
|---|---|---|---|---|---|
| US4-M-001 | Positive | Load default available tours | Available and unavailable tours exist | Open tours page/call `/tours/available` without filters | Only available tours are shown; default pagination/sort contract is respected |
| US4-M-002 | Positive | Filter by destination | Tours in multiple destinations | Select/search one destination | Only matching tours are returned |
| US4-M-003 | Boundary | Destination suggestion minimum query | Destination endpoint available | Submit queries shorter than and equal to required minimum | Short query returns no suggestions/defined validation; valid-length query returns matches |
| US4-M-004 | Positive | Combined filters | Matching test tour exists | Apply destination, date, duration, meal plan and type | Returned items satisfy every selected filter |
| US4-M-005 | Boundary | Guest capacity | Tours at and below requested capacity | Request guest counts at capacity and one above | At-capacity tour is eligible; insufficient-capacity tour is excluded |
| US4-M-006 | Positive | Sort results | Multiple tours with different price/rating | Execute each supported sort order | Ordering matches selected price/rating direction |
| US4-M-007 | Boundary | Pagination | More records than pageSize | Request pages 1, next, last and beyond range | Items/metadata are consistent; no duplicates across pages; out-of-range behaviour follows contract |
| US4-M-008 | Negative | Invalid query values | API client available | Use page 0, invalid pageSize, date, mealPlan, type and sortBy | Defined 400 validation response; no server error |
| US4-M-009 | Empty state | No matching tours | Use impossible filter combination | Execute search | 200 with empty list and zero/consistent metadata; UI shows empty state |
| US4-M-010 | UX | Return from details | Search results visible | Apply filters; open a tour; navigate back | Filter/scroll state follows approved UX and no duplicate request is triggered |
