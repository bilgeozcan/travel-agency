# US-12 — Update Profile Information

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9963 |
| Primary actors | Authenticated user |
| Business capability | Profile and account-security management |
| Main APIs | Profile retrieval/update, password change, email change initiation/verification/resend |
| Related work | EPMTPETA-13015, EPMTPETA-13016, EPMTPETA-13017, EPMTPETA-13018, EPMTPETA-13019, EPMTPETA-13020, EPMTPETA-13021, EPMTPETA-13022, EPMTPETA-13023, EPMTPETA-13024, EPMTPETA-13902, EPMTPETA-13903 |
| Priority | Optional |
| Dependencies | Cognito, authenticated user context, Access Token authorization, profile storage, OpenAPI |

## 2. User story

**As an authenticated user, I want to retrieve and update my profile information and securely manage password/email changes so that my account data remains current without weakening account security.**

## 3. Business value

Profile management reduces support overhead while secure password/email workflows protect account ownership. Separating general profile updates from security-sensitive changes prevents clients from bypassing verification requirements.

## 4. Scope

### In scope

- Authenticated profile retrieval.
- General profile information update.
- Server-side validation of editable profile fields.
- Email immutability in the general profile-update flow.
- Secure password change.
- Secure email change initiation.
- Email verification.
- Verification resend.
- Cognito/deployment configuration for account security.
- Router integration for account-security handlers.
- QA coverage for retrieval/update, password changes and verified email change.
- Swagger/Postman verification where frontend profile editing is not available.

### Out of scope

- Unauthenticated profile changes.
- Direct email mutation through general profile update.
- Password return/readback.
- Changing another user's profile.
- Bypassing verification for security-sensitive changes.
- Frontend-only enforcement of protected account rules.

## 5. Preconditions

- The user is authenticated.
- The backend can resolve the current user from the Access Token context.
- Cognito/account-security resources are configured.
- Profile storage is available.
- Verification delivery is configured where required.

## 6. Main profile flow

1. The user requests the current profile.
2. The backend resolves the authenticated user identity.
3. The backend returns only permitted profile fields.
4. The user submits editable general-information changes.
5. The backend validates the request.
6. The backend explicitly prevents general profile update from changing the email/security identity.
7. Valid general fields are persisted.
8. The updated profile is returned.

## 7. Security-sensitive flows

### Password change

1. The authenticated user submits the required password-change data.
2. The backend validates authentication and password policy/security requirements.
3. Cognito/account provider performs the change.
4. The response does not expose password data.

### Email change

1. The authenticated user initiates an email change through the dedicated security flow.
2. Verification is sent according to the implementation.
3. The user submits the verification code.
4. The backend validates the code and finalizes the verified email change.
5. Resend is available according to the approved rules.

## 8. Alternative and error flows

- Invalid/missing token: reject.
- Attempt to update another user: reject.
- General profile request includes email mutation: reject/ignore according to the approved contract; email remains unchanged.
- Invalid profile fields: validation response.
- Weak/invalid password change: reject.
- Invalid/expired email verification code: reject without changing verified email.
- Resend abuse/invalid state: controlled error according to provider rules.

## 9. Business and security rules

- User identity comes from the authenticated context, not a client-supplied user ID.
- General profile update cannot directly change email.
- Password changes use the dedicated secure account-security flow.
- Email changes require the dedicated verification flow.
- Verification failures never partially update the verified identity.
- Sensitive credential values are never returned.
- Backend authorization/validation is authoritative.
- OpenAPI security and schemas match the implemented account APIs.

## 10. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US12-01** — An authenticated user can retrieve the permitted current profile.
- [X] **AC-US12-02** — Unauthenticated profile retrieval/update requests are rejected.
- [X] **AC-US12-03** — Profile operations act on the identity resolved from the authenticated user context.
- [X] **AC-US12-04** — An authenticated user can update supported general profile fields.
- [X] **AC-US12-05** — Invalid general profile values return the defined validation response.
- [X] **AC-US12-06** — The general profile-update flow cannot directly change the account email.
- [X] **AC-US12-07** — Email immutability is enforced server-side, not only in the UI.
- [X] **AC-US12-08** — An authenticated user can initiate the secure password-change flow.
- [X] **AC-US12-09** — Invalid password-change requests are rejected without exposing credential information.
- [X] **AC-US12-10** — An authenticated user can initiate a secure email-change request through the dedicated endpoint/flow.
- [X] **AC-US12-11** — Email change is finalized only after successful verification.
- [X] **AC-US12-12** — Invalid or expired verification does not change the verified email.
- [X] **AC-US12-13** — Verification resend follows the implemented security/provider rules.
- [X] **AC-US12-14** — Account-security handlers are integrated into the API router.
- [X] **AC-US12-15** — Cognito/deployment configuration required by the profile/security APIs is present.
- [X] **AC-US12-16** — Profile/security API schemas, authorization and responses match OpenAPI.
- [X] **AC-US12-17** — QA coverage passes for profile retrieval/general updates, password change security and verified email change.
- [X] **AC-US12-18** — Sprint 2 delivered profile/security functionality can be verified through Swagger/Postman when the frontend profile-edit screen is unavailable.

## 11. Test references

### Automated / QA

- `pyapp/tests/test_api_handler/test_profile_email_immutability.py`
- Relevant profile retrieval/general update tests.
- Relevant password-change security tests.
- Relevant verified email-change integration/regression tests.
- Jira QA tasks: `EPMTPETA-13022`, `EPMTPETA-13023`, `EPMTPETA-13024`.

### Manual

- Swagger/Postman: get profile, update general info, change password, email-change initiation, verify/resend.
- Confirm email cannot be changed through general profile update.

## 12. Traceability

- Jira story: `EPMTPETA-9963`
- API/security contract: `EPMTPETA-13015`
- Profile GET/UPDATE: `EPMTPETA-13016`, `EPMTPETA-13017`
- Password: `EPMTPETA-13018`
- Verified email change: `EPMTPETA-13019`, `EPMTPETA-13020`
- QA: `EPMTPETA-13022`, `EPMTPETA-13023`, `EPMTPETA-13024`
- Sprint 2 demo evidence: profile/security APIs + validation.
