# EPMTPETA-12622 Reporting Interface Test Cases

## Scope

This QA task covers the reporting interface scenarios explicitly requested in Jira: report listing, report download, and the empty state when no reports are available.

The current `develop` snapshot (`e75e57d`) does not contain a reporting UI, reporting API route, or report service implementation. These are therefore executable manual acceptance cases for the reporting interface once the feature is present; this task does not invent application behaviour that is not implemented in the repository.

## Preconditions

- User is authenticated and allowed to open the reporting interface.
- A test environment is available with controllable report data.
- For populated-state cases, at least two distinguishable reports exist.
- For empty-state cases, no reports exist for the current user/context.
- Browser download handling is enabled.

## Test cases

| ID | Type | Scenario | Preconditions | Steps | Expected result | Status |
|---|---|---|---|---|---|---|
| EPMTPETA-12622-RI-001 | Positive | List available reports | At least two reports exist | Open the reporting interface | All available reports are shown exactly once; the page remains usable and no empty-state message is shown | Not Run |
| EPMTPETA-12622-RI-002 | Positive | Refresh populated report list | At least one report exists | Open the interface, refresh/reload the list | The list is rendered again without duplicate rows or stale loading indicators | Not Run |
| EPMTPETA-12622-RI-003 | Positive | Download a selected report | At least one downloadable report exists | Select the download action for one report | A download starts for the selected report; the downloaded file is non-empty and corresponds to that report | Not Run |
| EPMTPETA-12622-RI-004 | Negative | Download failure is handled safely | A report exists but its download request is unavailable/fails | Trigger the report download | The UI reports the failure; no successful-download state is shown and no corrupted/empty file is presented as a valid report | Not Run |
| EPMTPETA-12622-RI-005 | Empty state | No reports yet | No reports exist | Open the reporting interface | A clear no-reports/empty-state message is shown; no stale report rows appear and no report download can be triggered | Not Run |
| EPMTPETA-12622-RI-006 | State change | Empty state becomes populated | Start with no reports, then make one report available | Open the empty state, make a report available, then refresh/reload | The empty state disappears and the new report is listed once | Not Run |

## Acceptance mapping

- Listing: `RI-001`, `RI-002`
- Download: `RI-003`, `RI-004`
- Empty state (no reports yet): `RI-005`, `RI-006`

## Evidence to capture during execution

For each executed case record:

- Environment and build/commit SHA.
- Test user/role without storing credentials.
- Actual result and Pass/Fail/Blocked status.
- Screenshot of the list or empty state when relevant.
- Downloaded filename and non-sensitive file metadata for download cases.
- Defect ID for any failure.
