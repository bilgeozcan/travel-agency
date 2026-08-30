# Product Requirements Document — Travel Agency Application

## 1. Document control

| Field | Value |
|---|---|
| Product | Travel Agency Application |
| Project | EPM-EDAI Project Education |
| Team | Team 3 |
| Document type | Product Requirements Document |
| Version | 1.0 |
| Status | Sprint 1 baseline |
| Covered scope | User Stories 1–6 |
| Primary sources of truth | Jira, Knowledge Base, Figma, OpenAPI specification and approved implementation decisions |

## 2. Product summary

The Travel Agency Application enables customers to create an account, authenticate securely, search available tours, inspect tour details and reviews, create bookings and manage their own tours. Travel Agents receive role-based access to bookings assigned to them. Administrative privileges remain controlled and cannot be obtained through public registration input.

The Sprint 1 product scope is represented by six user stories:

| User Story | Jira | Capability |
|---|---|---|
| US-1 | EPMTPETA-9960 | User profile registration |
| US-2 | EPMTPETA-9961 | Login and authentication |
| US-3 | EPMTPETA-9962 | Automatic role assignment |
| US-4 | EPMTPETA-9965 | Tour search and selection |
| US-5 | EPMTPETA-9966 | Tour details and reviews |
| US-6 | EPMTPETA-9967 | Tour booking and My Tours |

## 3. Product vision

Provide a secure and understandable digital travel-booking journey in which:

- Customers can discover and book suitable tours without exposing or modifying another user's data.
- Travel Agents can work only with bookings assigned to them.
- Authentication and authorization rules are consistently enforced by the API and frontend.
- The OpenAPI contract, implementation and automated tests remain aligned.
- Errors are predictable and do not disclose sensitive account or booking information.

## 4. Product goals

1. Enable account creation with validated, unique identity data.
2. Provide secure sign-in, session refresh, sign-out and password-recovery flows.
3. Assign roles automatically and prevent privilege escalation.
4. Allow customers to search and compare available tours using defined filters.
5. Present complete tour and review information before booking.
6. Validate bookings against current availability and business rules.
7. Enforce customer ownership and assigned Travel Agent access.
8. Maintain a traceable QA process through acceptance criteria, manual tests, automated tests and the RTM.

## 5. Non-goals for this scope

The following items are outside the current six-user-story baseline unless introduced through an approved requirement:

- Payment processing and payment-provider integration.
- Public self-service Admin registration.
- Unapproved role-management interfaces.
- Production-scale performance certification.
- Full penetration testing.
- Loyalty, points, coupon or refund systems.
- Behaviour based only on assumptions not present in Jira, the Knowledge Base, Figma or OpenAPI.

## 6. Users and roles

### 6.1 Customer

A registered user who can:

- Sign in and maintain an authenticated session.
- Search available tours.
- View tour details and reviews.
- Create a booking.
- View and manage only their own permitted bookings.

### 6.2 Travel Agent

An allowlisted user who can:

- Sign in using the same authentication mechanism.
- Access only bookings assigned to them.
- Perform only operations permitted by role, assignment and booking state.

### 6.3 Admin

A privileged role controlled by trusted administration or deployment processes. Public registration input must not grant Admin privileges.

## 7. End-to-end product journey

1. A user opens the registration page.
2. The user submits first name, last name, email, password and password confirmation.
3. The system validates input and email uniqueness.
4. The system assigns the appropriate role.
5. The user signs in.
6. The system returns the authentication/session data required by the frontend.
7. Protected frontend API calls use the Access Token.
8. The customer searches available tours using supported criteria.
9. The customer opens a tour and reviews detailed information.
10. The customer submits booking information.
11. The backend revalidates the current tour package, date, duration, capacity and price.
12. A successful booking appears in the authenticated customer's My Tours view.
13. Ownership, assignment and lifecycle rules protect later booking operations.
14. Eligible completed bookings are moved to the finished state by the scheduled process.
15. The user signs out and the refresh session is revoked when available.

## 8. Functional requirements

### 8.1 Registration

- The form contains first name, last name, email, password and confirm password.
- Required fields are validated.
- Email format and password strength are validated.
- Password and confirmation must match.
- Email uniqueness is enforced using a normalized representation.
- Successful registration provides confirmation and redirects to Sign in.
- Password values and secrets are never returned.
- Customer and Travel Agent email values cannot be changed through profile update.

### 8.2 Authentication and session management

- Valid credentials produce a successful sign-in response.
- The current contract includes Access Token and ID Token data required by the application.
- Protected API requests use the Access Token and configured scopes.
- Refresh-token handling uses a secure HttpOnly cookie.
- Refresh succeeds only for a valid refresh session.
- Sign-out revokes the remote refresh session when possible and is safe when no session cookie is present.
- Forgot-password does not disclose whether an email is registered.
- Reset-password validates email, confirmation code and new password.
- CORS and standard response headers are applied consistently.

### 8.3 Automatic role assignment

- Public registration defaults to `CUSTOMER`.
- A normalized email present in the Travel Agent allowlist receives `TRAVEL_AGENT`.
- Allowlist matching is case-insensitive and uses the registration normalization rule.
- Duplicate allowlist entries are prevented.
- Client-supplied role values cannot override server assignment.
- Admin is not granted from untrusted registration input.
- The persisted role is used by later authorization decisions.

### 8.4 Tour search and selection

- Customers can request destination suggestions.
- Customers can retrieve available tours.
- Supported filters may include destination, start date, duration, guest quantity, meal plan and tour type.
- Supported sorting includes rating and price directions defined in OpenAPI.
- Results are paginated.
- Invalid values return a client error.
- No-match queries return a successful empty result.
- The frontend distinguishes loading, empty and error states.

### 8.5 Tour details and reviews

- A selected tour can be retrieved by ID.
- The response follows the current tour-details contract.
- Tour information may include destination, rating, images, summary, cancellation information, duration, accommodation, meal plans, custom details, dates, guest limits and prices.
- Reviews support pagination and approved sort options.
- Invalid or missing tour IDs return the defined error response.
- An unavailable or stale tour cannot proceed as if it were bookable.
- Optional fields do not break the details page.

### 8.6 Booking and My Tours

- Booking creation requires an authenticated and authorized customer.
- Required booking and personal-detail fields are validated.
- Availability, package, date, duration, capacity and quoted price are revalidated before creation.
- Invalid or stale selections do not create a booking.
- Customers access only their own bookings.
- Travel Agents access only bookings assigned to them.
- Unauthorized object access does not disclose whether another booking exists.
- Update and cancellation follow booking-state rules.
- Invalid state transitions are rejected consistently.
- My Tours contains only the authenticated customer's bookings.
- The scheduled updater changes only eligible completed bookings to the finished state.
- `POST /bookings/validate` follows the same Access Token authorization model as other protected booking operations.

## 9. Business rules

1. Email comparison uses one consistent normalized representation.
2. A public client cannot choose its own privileged role.
3. Authentication and object authorization are separate controls; a valid token alone is not sufficient to access another user's object.
4. Booking authorization is evaluated using authenticated identity, role, ownership or Travel Agent assignment.
5. A rejected booking request must not leave a partial booking record.
6. Booking rules are evaluated against current backend data, not only frontend state.
7. Rejected unauthorized access must avoid revealing another customer's booking existence.
8. Exact field lengths, UI labels and messages must follow the current approved Figma/Knowledge Base.
9. Exact API request/response schemas, enum values and status codes must follow the current OpenAPI contract.
10. When approved sources disagree, the discrepancy must be resolved explicitly rather than silently assumed.

## 10. API capability map

| Capability | Representative endpoint |
|---|---|
| Registration | `POST /auth/sign-up` |
| Sign in | `POST /auth/sign-in` |
| Refresh | `POST /auth/refresh` |
| Sign out | `POST /auth/sign-out` |
| Forgot password | `POST /auth/forgot-password` |
| Reset password | `POST /auth/reset-password` |
| Profile update | `PUT /profile` |
| Destination suggestions | `GET /tours/destinations` |
| Available tours | `GET /tours/available` |
| Tour details | `GET /tours/{id}` |
| Tour reviews | `GET /tours/{id}/reviews` |
| Booking creation/list | `POST /bookings`, `GET /bookings` |
| Booking validation | `POST /bookings/validate` |
| Booking object operations | Booking detail/update/delete routes |

The OpenAPI document remains authoritative for exact route names, parameters, schemas, enum values, security declarations and response codes.

## 11. Non-functional requirements

### Security

- Secrets, passwords, full tokens and secure cookies are not logged or exposed.
- Protected operations require the correct token type and scope.
- Role and object-level authorization are enforced server-side.
- Error responses do not disclose account or foreign-booking existence.
- CORS allows only approved origins and headers.

### Reliability and integrity

- Rejected operations do not create partial records.
- Session operations are safe under repeated sign-out requests.
- Scheduled booking completion is repeatable and does not alter ineligible records.
- API error handling remains deterministic for dependency failures.

### Maintainability

- API behaviour is documented in OpenAPI.
- Acceptance criteria are traceable to manual and automated tests.
- Shared response and validation behaviour is reusable.
- Implementation changes include related tests and documentation updates.

### Usability

- Forms provide understandable validation feedback.
- Loading, success, empty, not-found and error states are distinguishable.
- Successful registration and booking produce clear confirmation.
- Date, currency and display rules follow approved design/localization sources.

## 12. Dependencies

- AWS Cognito for user identity and authentication.
- API Gateway authorization and scope configuration.
- Lambda-based backend handlers.
- Persistent application data storage.
- Frontend authentication, tour and booking services/components.
- OpenAPI specification.
- Jira, Knowledge Base and Figma requirements.
- Seeded/managed Travel Agent allowlist.
- Scheduled execution mechanism for automatic booking completion.

## 13. Quality and release criteria

A user story is ready for review only when:

- Every applicable acceptance criterion is implemented or explicitly left unchecked.
- Relevant manual tests are defined.
- Relevant automated tests pass.
- Authorization-negative cases pass.
- OpenAPI remains valid and aligned.
- Frontend tests/build pass where the story changes frontend behaviour.
- No blocker or critical defect remains unresolved.
- Test evidence is attached to the related Jira item or merge request.

## 14. Traceability

- Detailed user-story requirements: `../user-stories/`
- Test plan and strategy: `../test-plan-and-strategy.md`
- Manual tests: `../qa/manual-tests/`
- Automated-test map: `../qa/automated-tests/existing-test-suite-map.md`
- Requirements Traceability Matrix: `../qa/traceability/requirements-traceability-matrix.md`
- Architecture Decision Records: `../adr/`

## 15. Open items

The following must remain aligned with the latest approved source:

- Exact registration field lengths and frontend validation messages.
- Exact response payload fields and status codes.
- Exact review sort options and pagination constraints.
- Exact booking status names and permitted transition matrix.
- Exact Travel Agent operational permissions beyond assignment-based access.
