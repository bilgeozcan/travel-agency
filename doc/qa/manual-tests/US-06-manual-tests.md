# US-6 Manual Test Cases – Booking and My Tours

| ID | Type | Scenario | Preconditions | Steps | Expected result |
|---|---|---|---|---|---|
| US6-M-001 | Positive | Create valid booking | Authenticated Customer; available tour | Submit valid booking data | 201/defined success; one booking is created; confirmation details are returned |
| US6-M-002 | Security | Create booking without Access Token | Available tour | Submit booking without token | Unauthorized response; no booking created |
| US6-M-003 | Validation | Missing/invalid booking fields | Authenticated Customer | Omit or invalidate tour/date/duration/meal plan/guest/personal details | 400 validation response identifies invalid fields; no booking |
| US6-M-004 | Conflict | Tour no longer available | Tour is unavailable/missing | Validate/create booking | Conflict response such as package not available; no booking |
| US6-M-005 | Boundary | Guest capacity | Tour with known max capacity | Book at max and one above max | At-max request follows valid path; above-max is rejected |
| US6-M-006 | Integrity | Price changed after selection | Quoted price differs from current price | Call validate/create | Price conflict is returned and booking is not silently created at stale price |
| US6-M-007 | Authorization | Customer reads own booking | Customer owns booking | GET booking/My Tours | Own booking is returned |
| US6-M-008 | Authorization | Customer reads another customer's booking | Customer A token; Customer B booking | GET/PUT/DELETE B's booking | Consistent protected response; existence is not disclosed; no mutation |
| US6-M-009 | Authorization | Assigned Travel Agent access | Booking assigned to Agent A | Agent A reads/updates permitted fields | Operation succeeds according to role and lifecycle |
| US6-M-010 | Authorization | Unassigned Travel Agent access | Booking assigned to Agent A; Agent B token | Agent B attempts access | Protected response; no data/mutation |
| US6-M-011 | State transition | Modify/cancel editable booking | Booking in editable/cancellable status | Perform update and cancel separately | Allowed operation succeeds and state is persisted |
| US6-M-012 | State transition | Modify/cancel non-editable booking | Booking in finished/cancelled/restricted status | Attempt update/delete | State-conflict response; booking remains unchanged |
| US6-M-013 | My Tours | Customer booking list isolation | Two customers have bookings | Call list as each Customer | Each response contains only authenticated customer's records |
| US6-M-014 | Scheduled process | Auto-finish eligible booking | Booking end condition is met | Run scheduled updater | Eligible booking moves to finished state exactly once |
| US6-M-015 | Scheduled process | Do not finish ineligible booking | Future/invalid/non-target-status booking exists | Run updater | Booking is unchanged |
| US6-M-016 | Robustness | Repeat/duplicate booking request | Same logical request sent twice | Send duplicate requests rapidly | Result follows approved duplicate/idempotency rule; no unexplained duplicate records |
| US6-M-017 | Security | Validate endpoint authorization | `/bookings/validate` available | Call without token, wrong token type and valid Access Token | Only correctly authorized request reaches business validation |
