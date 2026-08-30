# US-13 — User Password Recovery

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9964 |
| Primary actors | User |
| Business capability | Forgotten-password recovery |
| Main APIs | Forgot-password initiation, verification-code validation, password reset |
| Related work | EPMTPETA-12612, EPMTPETA-12614, EPMTPETA-12615, EPMTPETA-12618, EPMTPETA-12619, EPMTPETA-13070, EPMTPETA-13291, EPMTPETA-13293 |
| Priority | Optional |
| Dependencies | Cognito/password provider, verification delivery, recovery session/state, frontend auth flow |

## 2. User story

**As a user who forgot my password, I want to request a recovery code, verify it and set a new password so that I can regain access to my account securely.**

## 3. Business value

Password recovery prevents avoidable account lockout and support tickets while maintaining account security through provider-backed verification and password policy enforcement.

## 4. Scope

### In scope

- Recovery initiation by email/username according to the implemented contract.
- Provider-backed verification code delivery.
- Verification-code screen/endpoint.
- Password reset endpoint.
- New-password validation.
- Three-screen frontend reset flow.
- Success notification/toast.
- Redirect to login after successful reset.
- QA reset-flow coverage.
- Controlled handling of invalid/expired recovery state.

### Out of scope

- Displaying whether arbitrary accounts exist beyond the approved response model.
- Resetting another user's password without verification.
- Returning verification codes from the API.
- Admin-forced reset workflow.
- Bypassing provider password policy.

## 5. Preconditions

- Password recovery is enabled in the identity provider.
- Verification delivery is configured.
- The user can access the configured recovery channel.
- The frontend password-recovery routes/screens are available.

## 6. Main recovery flow

1. The user opens the forgot-password screen.
2. The user submits the account email/identifier.
3. The backend/provider starts password recovery.
4. A verification code is delivered through the configured channel.
5. The user enters the verification code.
6. The backend verifies the recovery code/session.
7. The user enters a new password.
8. The backend validates password policy and recovery state.
9. The provider updates the password.
10. The UI shows success and redirects the user to login.

## 7. Alternative and error flows

- Invalid email/identifier format: validation response.
- Unknown account: response follows the approved non-disclosing/provider behavior.
- Invalid verification code: reject.
- Expired verification code/session: reject and require a valid recovery flow.
- Weak/invalid new password: reject without completing recovery.
- Reused/invalid recovery state: reject.
- Provider failure: return controlled error and do not claim success.

## 8. Business and security rules

- Recovery verification codes are never returned to the client as sensitive data.
- Recovery endpoints do not expose password values.
- Password policy is enforced by backend/provider.
- Password reset completes only after valid recovery verification.
- Invalid/expired recovery sessions cannot be used to set a password.
- UI success is shown only after backend/provider success.
- After success, the user returns to the normal sign-in flow.

## 9. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US13-01** — A user can initiate the forgot-password flow with a valid account identifier.
- [X] **AC-US13-02** — Invalid initiation input returns the defined validation response.
- [X] **AC-US13-03** — Recovery initiation follows the approved non-disclosing/provider response behavior.
- [X] **AC-US13-04** — A verification code is sent through the configured recovery channel when the provider accepts the request.
- [X] **AC-US13-05** — The user can submit a verification code through the supported verification step.
- [X] **AC-US13-06** — Invalid or expired verification codes are rejected.
- [X] **AC-US13-07** — A verified recovery flow can submit a new password.
- [X] **AC-US13-08** — New passwords are validated against the required password policy.
- [X] **AC-US13-09** — Invalid recovery state cannot be used to reset a password.
- [X] **AC-US13-10** — A successful reset updates the password through the configured identity provider.
- [X] **AC-US13-11** — Recovery/verification responses never expose the user's password or verification secret.
- [X] **AC-US13-12** — The frontend implements the email, verification-code and new-password recovery screens.
- [X] **AC-US13-13** — Successful password reset shows the approved success notification.
- [X] **AC-US13-14** — Successful password reset redirects the user to login.
- [X] **AC-US13-15** — Forgot-password, verification and reset API contracts align with OpenAPI.
- [X] **AC-US13-16** — QA reset-flow test cases pass for success, validation and invalid/expired-code behavior.
- [X] **AC-US13-17** — Relevant frontend password-recovery tests/build pass.

## 10. Test references

### Automated / QA

- `pyapp/tests/test_api_handler/test_forgot_password.py`
- `pyapp/tests/test_api_handler/test_forgot_password_initiation.py`
- `pyapp/tests/test_api_handler/test_reset_password.py`
- Jira QA task: `EPMTPETA-12619` — Reset flow test cases.
- Relevant frontend password-recovery tests.

### Manual

- Screen 1: recovery email.
- Screen 2: verification code.
- Screen 3: new password.
- Success toast + login redirect.
- Swagger/Postman fallback for backend recovery endpoints.

## 11. Traceability

- Jira story: `EPMTPETA-9964`
- Forgot password initiation: `EPMTPETA-12612`
- Verification endpoint: `EPMTPETA-12614`
- Password reset endpoint: `EPMTPETA-12615`
- Frontend success/redirect: `EPMTPETA-12618`
- QA: `EPMTPETA-12619`
- Frontend screens: `EPMTPETA-13070`, `EPMTPETA-13291`, `EPMTPETA-13293`
- Sprint 2 demo evidence: UI reset flow + Cognito-backed API.
