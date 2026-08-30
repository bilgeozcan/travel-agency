# US-3 Manual Test Cases – Automatic Role Assignment

| ID | Type | Scenario | Preconditions | Steps | Expected result |
|---|---|---|---|---|---|
| US3-M-001 | Positive | Default Customer assignment | Email not on allowlist | Register and sign in | Persisted/returned role is `CUSTOMER` |
| US3-M-002 | Positive | Travel Agent allowlist assignment | Normalized email is on allowlist | Register/sign in using that email | Persisted/returned role is `TRAVEL_AGENT` |
| US3-M-003 | Boundary | Case-insensitive allowlist match | Mixed-case allowlist/email variants | Register with case variation | Match uses normalization and assigns Travel Agent |
| US3-M-004 | Data integrity | Duplicate allowlist entry | Entry already exists | Attempt to create equivalent duplicate | Duplicate is prevented with documented response |
| US3-M-005 | Security | Self-assign Admin | Public registration client | Include `ADMIN` or privileged role in request | Admin is not granted |
| US3-M-006 | Security | Customer calls Travel Agent endpoint | Customer access token | Call agent-only route | 403/defined forbidden response; no protected data |
| US3-M-007 | Positive | Travel Agent calls permitted endpoint | Travel Agent access token | Call agent-permitted route | Request succeeds where scope/assignment permits |
| US3-M-008 | Consistency | Role remains consistent across refresh | User with assigned role | Sign in, refresh, then call protected route | User role/permissions remain consistent |
