# US-11 — Reporting Interface

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9972 |
| Primary actors | Admin |
| Business capability | On-demand report generation, review and download |
| Main APIs | Report generation and report download routes |
| Related work | EPMTPETA-12622, EPMTPETA-13642, EPMTPETA-13643, EPMTPETA-13645, EPMTPETA-13651, EPMTPETA-13653, EPMTPETA-13654, EPMTPETA-13805, EPMTPETA-13806, EPMTPETA-13948, EPMTPETA-13949, EPMTPETA-13950 |
| Priority | Optional |
| Dependencies | Admin authorization, report data, S3/report cache, PDF/XLSX generation, OpenAPI |

## 2. User story

**As an Admin, I want to generate, review and download operational reports so that I can analyze Travel Agency performance for a selected reporting period.**

## 3. Business value

The reporting interface makes aggregated operational data consumable on demand. It complements scheduled US-10 delivery by allowing authorized Admin users to request report artifacts in supported formats and date ranges.

## 4. Scope

### In scope

- Admin authorization for reporting operations.
- Report generation endpoint.
- Report download endpoint.
- Date/date-range filtering.
- Multi-week date-range aggregation.
- Report cache/storage integration.
- Native PDF generation.
- Native Excel `.xlsx` generation.
- Travel Agent names in staff-performance reports.
- Backend unit/integration coverage.
- End-to-end API/report artifact verification.
- Swagger/Postman fallback for backend-complete functionality.

### Out of scope

- Non-admin report access.
- Public report links.
- Arbitrary file formats.
- Unlimited date-range requests without validation.
- Treating a generated report artifact as the same thing as the API metadata response.
- Frontend-only authorization.

## 5. Preconditions

- The Admin is authenticated with the required role/scope.
- Reporting data is available.
- Report storage/cache resources are configured.
- PDF/XLSX generation dependencies are deployed.
- The requested date range is valid.

## 6. Main generation flow

1. The Admin requests a report with supported type/format/date parameters.
2. The backend validates authentication and Admin authorization.
3. The backend validates report parameters and date range.
4. Reporting data is queried/aggregated.
5. Staff names and other required display data are resolved.
6. The selected PDF/XLSX artifact is generated.
7. The artifact is stored/cached according to the implementation.
8. Report metadata/reference is returned.

## 7. Download flow

1. The Admin requests download for a generated report.
2. The backend validates authentication and authorization.
3. The backend validates report identity/availability.
4. The stored artifact is resolved.
5. The supported download response is returned.
6. The Admin receives the report artifact separately from the report-generation API response.

## 8. Alternative and error flows

- Non-admin user: reject.
- Invalid date range: validation response.
- Unsupported report type/format: validation response.
- No data: return the approved empty/no-data report behavior.
- Artifact missing/expired: return the defined not-found/regeneration behavior.
- PDF/XLSX generation failure: return controlled error without corrupting cache metadata.
- Storage failure: do not return a false successful artifact reference.

## 9. Business and security rules

- Reporting operations are Admin-protected.
- Report parameters are server-validated.
- Generated artifacts are not public by default.
- PDF and XLSX outputs use native supported generation paths.
- Date aggregation supports the implemented multi-week behavior.
- Staff-performance output uses Travel Agent names where required.
- API metadata and downloaded file artifact are treated as distinct outputs.
- OpenAPI reflects reporting security, request and response contracts.

## 10. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US11-01** — An authenticated Admin can request generation of a supported report.
- [X] **AC-US11-02** — Non-admin and unauthenticated report-generation requests are rejected.
- [X] **AC-US11-03** — Report type, format and date inputs are validated before generation.
- [X] **AC-US11-04** — Supported date filtering is applied to report data.
- [X] **AC-US11-05** — Multi-week date ranges are aggregated according to the implemented rules.
- [X] **AC-US11-06** — Staff-performance reports populate required Travel Agent names.
- [X] **AC-US11-07** — A valid PDF report can be generated using the deployed native PDF path.
- [X] **AC-US11-08** — A valid native `.xlsx` report can be generated for the supported Excel format.
- [X] **AC-US11-09** — Generated artifacts are stored/cached using the configured report storage resources.
- [X] **AC-US11-10** — An authenticated Admin can request download of an available generated report.
- [X] **AC-US11-11** — Unauthorized users cannot download report artifacts.
- [X] **AC-US11-12** — Missing/invalid artifacts return the defined error behavior.
- [X] **AC-US11-13** — Report generation/download API contracts match the current OpenAPI definition.
- [X] **AC-US11-14** — Backend unit/integration tests for reporting endpoints pass.
- [X] **AC-US11-15** — End-to-end report generation and artifact download can be verified through the available Admin UI or Swagger/Postman fallback.
- [X] **AC-US11-16** — Sprint 2 backend reporting scope is demonstrable independently of frontend availability.

## 11. Test references

### Automated / QA

- Jira QA task: `EPMTPETA-12622` — Reporting interface test cases.
- Jira QA task: `EPMTPETA-13651` — End-to-end US-11 reporting flow test.
- Jira QA task: `EPMTPETA-13654` — Backend unit & integration tests for reporting endpoints.
- Reporting generation/download backend tests.

### Manual

- Swagger/Postman: generate report → inspect metadata → download artifact.
- Validate PDF and `.xlsx` artifacts.
- Verify date filtering and multi-week aggregation.

## 12. Traceability

- Jira story: `EPMTPETA-9972`
- Infrastructure/IAM: `EPMTPETA-13642`, `EPMTPETA-13643`
- Generate/download: `EPMTPETA-13645`, `EPMTPETA-13653`
- PDF/XLSX: `EPMTPETA-13805`, `EPMTPETA-13949`
- Date aggregation: `EPMTPETA-13806`, `EPMTPETA-13950`
- Sprint 2 demo evidence: report generate/download + PDF/XLSX + date filtering.
