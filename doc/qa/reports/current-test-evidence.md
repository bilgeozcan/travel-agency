# Current Test Evidence

This file records implementation/test snapshots observed during the project. These results are historical evidence, not a substitute for rerunning the current `develop` branch.

| Date | Area | Evidence |
|---|---|---|
| 27–28 Jul 2026 | Forgot/reset password | Targeted `test_forgot_password.py`: 17 passed; full API-handler snapshot: 116 passed, 4 subtests passed |
| 30 Jul 2026 | Booking authorization/lifecycle | Targeted booking regression reported passing; later project snapshot reported 167 passed, 14 subtests |
| 30 Jul 2026 | Customer My Tours | Targeted suite: 5 passed; booking regression: 48 passed, 10 subtests; full API-handler suite: 167 passed, 14 subtests |
| 30 Jul 2026 | Automatic finish | Scheduled updater targeted tests: 7 passed; full API-handler snapshot reported passing |
| 30 Jul 2026 | Profile email immutability | Targeted profile immutability: 8 passed; authorization regression: 14 passed, 2 subtests |
| 31 Jul 2026 | Access-token authorization fix | Backend: 197 passed, 20 subtests; frontend auth tests: 32 passed; frontend production build passed |

## Required release evidence

Before declaring the current branch ready, replace/add an entry with:

- Date/time.
- Branch and commit SHA.
- Environment.
- Commands.
- Targeted result.
- Full backend result.
- Frontend result/build.
- OpenAPI validation.
- Known skipped/subtests and justification.
- Defects or blockers.
