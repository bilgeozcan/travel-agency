# Test Plan and Test Strategy

## 1. Document control

| Field | Value |
|---|---|
| Project | EPM-EDAI Project Education – Travel Agency Application |
| Team | Team 3 |
| Document | Test Plan including Test Strategy |
| Version | 1.0 |
| Status | Working project document |
| Scope | Sprint 1 User Stories 1–6 |
| Primary test levels | Unit, component, API, integration, system and regression |
| Primary test methods | Manual and automated |

## 2. Purpose

This document defines what will be tested, how testing will be performed, the required evidence, and the entry/exit conditions for the six Travel Agency user stories.

## 3. In scope

- User registration and profile creation.
- Sign-in, refresh, sign-out, forgot-password and reset-password flows.
- Automatic Customer and Travel Agent role assignment, including allowlist handling.
- Tour destination lookup, filtering, sorting and pagination.
- Tour-detail and review retrieval.
- Booking creation, validation, ownership, assigned-agent access, lifecycle rules, cancellation, My Tours and automatic completion.
- API response status, body, headers, authorization scopes and OpenAPI alignment.
- Frontend user flows that implement these capabilities.

## 4. Out of scope

- Product rules not approved in Jira, the Knowledge Base, Figma or OpenAPI.
- Payment processing unless it is explicitly introduced into the approved US-6 scope.
- Production certification, penetration testing and load testing unless separately planned.
- Assumptions about missing fields, limits, messages or role rules.

## 5. Test approach

### 5.1 Functional testing

Functional testing validates acceptance criteria through API and UI flows. Tests must cover:

- Positive scenarios.
- Negative scenarios.
- Boundary values and invalid formats.
- Empty, unavailable and stale-data states.
- Authentication and authorization boundaries.
- State transitions and lifecycle restrictions.
- Error-response consistency.
- Data persistence and returned DTO structure.

### 5.2 Test-design techniques

- **Equivalence Partitioning:** valid and invalid email, password, query, guest and pagination groups.
- **Boundary Value Analysis:** minimum/maximum lengths, page/pageSize, guest capacity, date and rating boundaries.
- **Decision Tables:** role assignment, authorization and booking-state decisions.
- **State Transition Testing:** logged-out/logged-in/session-expired states and booking status transitions.
- **Error Guessing:** malformed JSON, missing headers, duplicate requests, unavailable dependencies and stale tour data.

### 5.3 Automation strategy

Automate scenarios that are deterministic, repeatable and high-risk:

- Authentication response and token handling.
- Authorization scopes and protected endpoints.
- Registration validation and duplicate-email handling.
- Role assignment and allowlist normalization.
- Tour filtering, sorting and pagination.
- Booking validation, ownership and lifecycle restrictions.
- Regression checks for response headers and OpenAPI JSON validity.

Keep exploratory UX, visual consistency, cross-browser interaction and ambiguous product behaviour in manual coverage until requirements stabilize.

## 6. Environments

| Environment | Purpose | Minimum checks |
|---|---|---|
| Local | Fast development feedback | Unit/component/API tests, syntax and OpenAPI validation |
| Personal AWS alias | Integration validation | API Gateway, Lambda, Cognito, DynamoDB and authorization |
| Shared QA/UAT | End-to-end and regression | UI/API integration, role-specific flows and release evidence |

Environment names, base URLs, credentials and seeded test users must not be committed to this directory.

## 7. Test data

Maintain isolated test identities for:

- New Customer.
- Existing Customer.
- Allowlisted Travel Agent.
- Non-allowlisted user.
- User with invalid/expired session.
- Customer A and Customer B for object-level authorization.
- Assigned and unassigned Travel Agent.
- Available, unavailable and missing tour.
- Booking in each supported status.

Use unique email addresses for registration tests and clean up generated data where possible.

## 8. Entry criteria

- User story and acceptance criteria are available.
- Relevant Figma and OpenAPI definitions are accessible.
- Target branch builds successfully.
- Required environment is deployed and reachable.
- Test data and credentials are available.
- Blocking requirement questions are resolved or explicitly marked `TBC`.

## 9. Exit criteria

- All critical and high-priority tests pass.
- No unresolved blocker or critical defect remains.
- Authorization-negative tests pass.
- Relevant automated suites pass with no unexplained regression.
- OpenAPI JSON and production build validation pass where applicable.
- Test evidence is attached to Jira/MR and the traceability matrix is updated.

## 10. Defect management

Defects must include:

- User story and test-case reference.
- Environment, branch and commit.
- Reproduction steps and test data.
- Expected and actual results.
- Response status/body, logs or screenshots with secrets removed.
- Severity and business impact.

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Requirement differs between Jira, KB, Figma and API | Incorrect implementation/test | Raise a targeted clarification and use the approved source of truth |
| Shared test data causes collisions | Flaky or misleading result | Use unique data and deterministic cleanup |
| Cognito/AWS instability | False failures | Separate application assertion failures from infrastructure failures |
| Object-level authorization gap | Data exposure | Maintain negative tests for other customers and unassigned agents |
| Booking concurrency or stale availability | Overbooking/inconsistent state | Validate at booking time and retain conflict-response tests |
| Frontend fallback masks backend failures | False-positive UI result | Test backend API directly and verify fallback conditions separately |

## 12. Deliverables

- User-story specifications.
- Manual API/UI test cases.
- Automated-test inventory and execution scripts.
- Requirements Traceability Matrix.
- Manual and automated test reports.
- Defect reports.
- Current test-evidence log.
