# US-7 — Documents Upload by Customer

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9968 |
| Primary actors | Customer, assigned Travel Agent |
| Business capability | Booking document upload and management |
| Main APIs | Booking document POST/GET/PUT/DELETE routes |
| Related work | EPMTPETA-12656, EPMTPETA-12657, EPMTPETA-12659, EPMTPETA-13283, EPMTPETA-13284, EPMTPETA-13285, EPMTPETA-13666, EPMTPETA-13990 |
| Priority | Optional |
| Dependencies | Authentication, booking authorization, object storage, booking persistence, OpenAPI |

## 2. User story

**As a Customer, I want to upload passports and confirmations to my booking so that the Travel Agency has the documents required to process my trip.**

**As an authorized Travel Agent, I want permitted access to booking documents so that I can review the material associated with an assigned booking.**

## 3. Business value

Booking documents are operational data required for travel processing. Secure document handling reduces manual exchange, keeps files linked to the correct booking, and preserves customer/agent authorization boundaries.

## 4. Scope

### In scope

- Uploading a document for an authorized booking.
- Retrieving document metadata for an authorized booking.
- Updating/replacing permitted document information.
- Deleting a permitted document.
- Upload/update frontend flow.
- Save-button validation.
- Type-based document classification.
- Storage-key based document references.
- Booking-level authorization for document operations.
- Validation of supported request data.
- Non-disclosing unauthorized responses.
- OpenAPI alignment for document routes.

### Out of scope

- Public unauthenticated document access.
- Permanent public URLs.
- Cross-customer document access.
- Unassigned Travel Agent access.
- Arbitrary executable-file processing.
- Document OCR or content extraction unless separately approved.
- Long-lived presigned download URLs.

## 5. Preconditions

- The user has a valid authenticated session.
- The target booking exists.
- The authenticated user is authorized for the booking.
- Document storage is configured.
- Booking/document metadata storage is available.

## 6. Main customer flow

1. The Customer opens an owned booking.
2. The Customer opens the document upload/update UI.
3. The frontend validates required input.
4. The request is sent with the authenticated Access Token.
5. The backend validates identity and booking ownership.
6. The backend validates document metadata/type.
7. The document is stored using the configured storage mechanism.
8. The booking stores a document reference/storage key rather than a public permanent URL.
9. The updated document information is returned.
10. The Customer can later retrieve, update or delete the permitted document.

## 7. Travel Agent flow

1. The Travel Agent opens an assigned booking.
2. The backend verifies Travel Agent role and booking assignment.
3. Permitted document metadata/actions are returned.
4. Access to unrelated booking documents is rejected.

## 8. Alternative and error flows

- Missing/invalid token: reject before document processing.
- Unauthorized booking: return the protected non-disclosing response.
- Missing/invalid document metadata: return validation error.
- Unsupported document type: reject without persistence.
- Missing document: return the defined not-found/protected response.
- Storage failure: do not leave inconsistent booking metadata.
- Delete/update on an unauthorized document: reject without mutation.

## 9. Business and security rules

- Documents are always linked to a booking.
- Customers can operate only on documents belonging to owned bookings.
- Travel Agents can access only documents for assigned bookings and only where permitted.
- Authorization is checked before metadata or storage details are returned.
- Stored document records use internal storage references.
- Permanent public document URLs are not exposed.
- Document type/classification follows the approved implementation.
- Update/delete operations preserve booking/document consistency.

## 10. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US7-01** — An authenticated Customer can upload a valid document to an owned booking.
- [X] **AC-US7-02** — The backend validates authentication and booking authorization before document processing.
- [X] **AC-US7-03** — Invalid or unsupported document input is rejected without creating an inconsistent document record.
- [X] **AC-US7-04** — Uploaded documents are linked to the correct booking using an internal storage reference.
- [X] **AC-US7-05** — An authorized user can retrieve permitted booking document metadata.
- [X] **AC-US7-06** — An authorized Customer can update/replace permitted document data.
- [X] **AC-US7-07** — An authorized Customer can delete a permitted document.
- [X] **AC-US7-08** — A Customer cannot read, update or delete another Customer's booking documents.
- [X] **AC-US7-09** — An unassigned Travel Agent cannot access unrelated booking documents.
- [X] **AC-US7-10** — Unauthorized document access follows the protected non-disclosing response pattern.
- [X] **AC-US7-11** — The frontend upload/update flow validates required data before enabling save.
- [X] **AC-US7-12** — Document type-based classification is applied according to the implemented rules.
- [X] **AC-US7-13** — Failed storage/update operations do not leave inconsistent booking metadata.
- [X] **AC-US7-14** — Document POST/GET/PUT/DELETE routes match the current OpenAPI contract.
- [X] **AC-US7-15** — Relevant backend, frontend and QA document tests/checks pass for the delivered Sprint 2 scope.

## 11. Test references

### Automated / QA

- `pyapp/tests/test_api_handler/` — document and booking authorization coverage.
- Relevant frontend document upload/update tests.
- Jira QA task: `EPMTPETA-12659` — Document upload test cases.

### Manual

- Swagger/Postman verification for document POST/GET/PUT/DELETE flows.
- UI verification of upload/update popup and save-button rules.

## 12. Traceability

- Jira story: `EPMTPETA-9968`
- OpenAPI: `openapi_travel_agency_sprint1_v1_oas_v3.json`
- Related booking authorization rules.
- Sprint 2 demo evidence: document upload/update UI + document API operations.
