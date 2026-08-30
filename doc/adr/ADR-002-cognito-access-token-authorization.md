# ADR-002 — Use Cognito Authentication with Access Token Authorization

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-31 |
| Scope | Authentication, session handling and protected API authorization |
| Related stories | US-2, US-3 and US-6 |

## Context

The application previously risked treating token presence as sufficient authorization and could use the wrong token type for protected API calls. The frontend requires identity data and protected API access, while refresh-token exposure must be minimized.

## Decision

1. Cognito remains the authentication provider.
2. Successful sign-in and refresh responses provide the current ID Token and Access Token contract.
3. Protected frontend API requests use the Access Token.
4. API Gateway protected methods declare the required Cognito scopes.
5. The refresh token is handled through a secure HttpOnly cookie and is not returned in the JSON response body.
6. Sign-out attempts remote refresh-session revocation when a refresh session exists.
7. Sign-out remains safe and idempotent when the refresh cookie is absent.
8. Authentication failures use controlled error responses without exposing secrets.

## Consequences

### Positive

- Protected APIs use the token designed for authorization.
- Scope checks are explicit at the gateway/API boundary.
- Refresh-token exposure to frontend JavaScript is reduced.
- Session refresh and sign-out behaviour are testable.

### Negative

- Frontend auth code must distinguish ID Token and Access Token responsibilities.
- OpenAPI, authorizer configuration and tests must remain synchronized.
- Cookie configuration introduces CORS, Secure and SameSite considerations.

## Rejected alternatives

- Use the ID Token as the bearer token for protected API calls.
- Return the refresh token in the JSON body.
- Protect endpoints only inside business handlers without gateway scopes.
