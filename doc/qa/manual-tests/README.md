# Manual Test Documentation

Manual test cases are organized by user story. Each case is atomic and includes a requirement reference, scenario type, precondition, steps and expected result.

## Execution status

Use one of:

- `Not Run`
- `Pass`
- `Fail`
- `Blocked`
- `Not Applicable`

Record actual results and evidence in the manual test execution template under `../templates`.

## General API checks for every case

- HTTP status.
- Response body and schema.
- Required response headers.
- Error code/message consistency.
- No secret/token leakage.
- Correct authorization behaviour.
- No unintended data change after a rejected request.

## General UI checks for every case

- Correct navigation and visible feedback.
- Loading, success, empty and error states.
- No duplicate submission.
- No stale privileged content after sign-out.
- Responsive behaviour for supported viewport sizes.
