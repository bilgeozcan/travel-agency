# US-1 Manual Test Cases – Registration

| ID | Type | Scenario | Preconditions | Steps | Expected result |
|---|---|---|---|---|---|
| US1-M-001 | Positive | Register a new Customer with valid data | Email is not registered | Open Sign up; enter valid first name, last name, email, strong password and matching confirmation; submit | Registration succeeds once; confirmation is displayed; user is redirected to Sign in |
| US1-M-002 | Negative | Register with an existing email | Existing account is available | Submit the registration form with the existing email | Request is rejected with the documented duplicate/409 response; no second profile is created |
| US1-M-003 | Negative | Invalid email format | Sign-up page/API available | Submit representative invalid email formats | Each invalid value is rejected; the field/API error is specific to email format |
| US1-M-004 | Boundary | Password-strength boundaries | Current password rules are known from source of truth | Test values just below, at and above each password boundary | Only values satisfying every password rule are accepted |
| US1-M-005 | Negative | Password and confirmation differ | None | Enter two different valid-looking passwords; submit | Registration is blocked and mismatch feedback is shown |
| US1-M-006 | Negative | Missing/invalid name | None | Leave name blank and test invalid characters/lengths from Figma | Invalid values are rejected without creating an account |
| US1-M-007 | Security | Role injection in registration request | API client available | Add a privileged `role` value to an otherwise valid request | Client-supplied privileged role is ignored or rejected; assignment follows server rules |
| US1-M-008 | Data integrity | Email normalization | Unique mixed-case/spaced email available | Register using supported leading/trailing space and mixed-case variants; then retry normalized equivalent | Stored/comparison value is normalized consistently; duplicate equivalent cannot be created |
| US1-M-009 | Authorization | Attempt to change profile email | Existing Customer and Travel Agent | Send profile update containing a different email for each role | Email remains unchanged; API returns the documented immutable-field error |
| US1-M-010 | Robustness | Malformed JSON and missing body | API client available | Send malformed JSON, empty body and missing required properties | Client error is returned; no partial identity/profile remains |
