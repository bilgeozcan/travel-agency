# US-2 Manual Test Cases – Login and Authentication

| ID | Type | Scenario | Preconditions | Steps | Expected result |
|---|---|---|---|---|---|
| US2-M-001 | Positive | Sign in with valid credentials | Confirmed active account | Submit valid email/password | Success response contains the documented tokens, expiry, token type and user data |
| US2-M-002 | Negative | Wrong password | Existing account | Submit valid email with wrong password | Generic authentication error; no account-existence detail |
| US2-M-003 | Negative | Unknown email | Unregistered email | Submit unknown email with any password | Same generic authentication error as wrong password |
| US2-M-004 | Security | Protected API without token | Protected route available | Call route without Authorization header | 401/defined unauthorized response; no protected data |
| US2-M-005 | Security | Protected API with ID Token instead of Access Token | Valid session | Call protected route using ID Token | Request is rejected when Access Token/scopes are required |
| US2-M-006 | Positive | Protected API with Access Token | Valid session and permitted role | Call protected route with Access Token | Request succeeds according to role/scope |
| US2-M-007 | Session | Refresh with valid secure cookie | Signed-in browser/client retains cookie | Call refresh endpoint without exposing token in JSON | New token response succeeds; refresh token remains HttpOnly and absent from body |
| US2-M-008 | Negative | Refresh with missing/invalid/expired cookie | None or invalid cookie | Call refresh for each condition | Defined 401/403 response; no renewed session |
| US2-M-009 | Session | Sign out with active refresh session | Signed-in user | Call sign-out; then attempt refresh | Sign-out succeeds; subsequent refresh fails |
| US2-M-010 | Idempotency | Sign out without refresh cookie | No active cookie | Call sign-out twice | Safe documented response both times; no server error |
| US2-M-011 | Privacy | Forgot password for registered and unknown email | One registered and one unknown email | Submit both separately | Externally visible response is generic and does not disclose registration |
| US2-M-012 | Negative | Reset with invalid/expired code | Reset flow initiated | Submit invalid and expired codes | Reset is rejected; password remains unchanged |
| US2-M-013 | Positive | Reset password and sign in | Valid code available | Reset with valid strong password; sign in using new password | Reset succeeds; new password works; old password fails |
| US2-M-014 | Browser | CORS and cookie attributes | Browser devtools available | Execute sign-in/refresh/sign-out and inspect headers/cookie | Allowed origin works; cookie has expected Secure/HttpOnly/SameSite attributes; disallowed origin is not trusted |
