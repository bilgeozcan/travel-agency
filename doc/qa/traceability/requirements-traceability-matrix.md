# Requirements Traceability Matrix

| Requirement ID | User Story / Requirement | Manual test coverage | Automated coverage | Status |
|---|---|---|---|---|
| US1-R1 | Valid profile registration | US1-M-001 | `test_signup.py` | Covered |
| US1-R2 | Field validation and password confirmation | US1-M-003–006 | `test_signup.py` | Covered |
| US1-R3 | Unique and normalized email | US1-M-002, US1-M-008 | `test_signup.py` | Covered |
| US1-R4 | Email immutable after registration | US1-M-009 | `test_profile_email_immutability.py` | Covered |
| US2-R1 | Valid/invalid sign-in | US2-M-001–003 | `test_sign_in.py` | Covered |
| US2-R2 | Access Token protects APIs | US2-M-004–006 | `test_authorization.py`, `test_auth_session_protected_api.py` | Covered |
| US2-R3 | Secure refresh session | US2-M-007–008 | `test_refresh.py`, `test_secure_refresh_session.py` | Covered |
| US2-R4 | Sign-out/revocation | US2-M-009–010 | `test_sign_out_session_revocation.py` | Covered |
| US2-R5 | Forgot/reset password privacy and validation | US2-M-011–013 | `test_forgot_password.py` | Covered |
| US3-R1 | Default Customer role | US3-M-001 | `test_role_assignment.py` | Covered |
| US3-R2 | Allowlisted Travel Agent role | US3-M-002–004 | `test_role_assignment.py` | Covered |
| US3-R3 | Prevent role injection/privilege escalation | US3-M-005–007 | `test_authorization.py`, `test_signup.py` | Covered |
| US4-R1 | Available-tour listing and destination search | US4-M-001–003 | `test_tour_search.py` | Covered |
| US4-R2 | Filtering and capacity | US4-M-004–005 | `test_tour_search.py` | Covered |
| US4-R3 | Sorting, pagination and empty results | US4-M-006–009 | `test_tour_search.py` | Covered |
| US4-R4 | Preserve search UI state | US4-M-010 | Frontend test TBC | Manual / TBC |
| US5-R1 | Retrieve valid tour details | US5-M-001 | `test_tours.py` | Covered |
| US5-R2 | Invalid/not-found details state | US5-M-002 | `test_tours.py` | Verify current coverage |
| US5-R3 | Optional/stale/unavailable UI state | US5-M-003–004 | Frontend tests TBC | Manual / TBC |
| US5-R4 | Reviews pagination and sorting | US5-M-005–007 | `test_tours.py` or dedicated review tests TBC | Verify current coverage |
| US6-R1 | Valid protected booking creation | US6-M-001–003 | `test_bookings.py`, `test_booking_validation.py` | Covered |
| US6-R2 | Availability/capacity/price conflict | US6-M-004–006 | `test_booking_validation.py` | Covered |
| US6-R3 | Customer ownership isolation | US6-M-007–008 | `test_booking_authorization_lifecycle.py` | Covered |
| US6-R4 | Assigned Travel Agent isolation | US6-M-009–010 | `test_booking_authorization_lifecycle.py` | Covered |
| US6-R5 | Booking lifecycle restrictions | US6-M-011–012 | `test_booking_authorization_lifecycle.py` | Covered |
| US6-R6 | Customer My Tours | US6-M-013 | `test_customer_my_tours.py` | Covered |
| US6-R7 | Automatic finish | US6-M-014–015 | `test_booking_status_updater/test_handler.py` | Covered |
| US6-R8 | Duplicate/concurrent request rule | US6-M-016 | Integration test recommended | Gap/TBC |
| US6-R9 | Protected booking validation endpoint | US6-M-017 | `test_authorization.py`, `test_booking_validation.py` | Covered |
| QA-X1 | Standard headers and response structure | Included in all API cases | `test_api_response.py` | Covered |
| QA-X2 | OpenAPI validity | Review against all API cases | JSON validation command | Covered |
