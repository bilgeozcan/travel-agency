# Travel Agency Application Documentation

This `docs` directory contains the Sprint 1 product, architecture, user-story and QA documentation for the Travel Agency Application.

## Documentation structure

```text
docs/
├── README.md
├── prd/
│   └── PRD-travel-agency-app.md
├── adr/
│   ├── README.md
│   ├── ADR-001-serverless-aws-architecture.md
│   ├── ADR-002-cognito-access-token-authorization.md
│   ├── ADR-003-server-side-role-assignment.md
│   ├── ADR-004-booking-object-authorization.md
│   ├── ADR-005-booking-lifecycle-auto-finish.md
│   └── ADR-006-openapi-contract.md
├── user-stories/
│   ├── US-01-profile-registration.md
│   ├── US-02-login-authentication.md
│   ├── US-03-automatic-role-assignment.md
│   ├── US-04-tour-search-and-selection.md
│   ├── US-05-tour-details.md
│   └── US-06-tour-booking.md
├── test-plan-and-strategy.md
└── qa/
    ├── manual-tests/
    ├── automated-tests/
    ├── traceability/
    ├── reports/
    └── templates/
```

## Covered user stories

| User Story | Jira | Capability |
|---|---|---|
| US-1 | EPMTPETA-9960 | User profile registration |
| US-2 | EPMTPETA-9961 | Login and authentication |
| US-3 | EPMTPETA-9962 | Automatic role assignment |
| US-4 | EPMTPETA-9965 | Tour search and selection |
| US-5 | EPMTPETA-9966 | Tour details and reviews |
| US-6 | EPMTPETA-9967 | Tour booking and My Tours |

## Source-of-truth order

Product behaviour must be verified against the current approved:

1. Jira requirements and acceptance information.
2. Knowledge Base.
3. Figma.
4. OpenAPI specification.
5. Accepted ADRs and implementation/tests.

A discrepancy must be resolved explicitly. Documentation must not invent missing requirements.

## Acceptance-criteria checklist rule

Every User Story contains an Acceptance Criteria section with Markdown task-list items.

```markdown
- [ ] **AC-US2-01** — Not yet verified.
- [X] **AC-US2-02** — Verified against the current branch.
```

During verification, only the checkbox marker may change:

- Allowed: `[ ]` → `[X]`
- Not allowed: rewriting, deleting, reordering or adding criteria
- Not allowed: adding Copilot prompts or verification reports to User Story documents
- Not allowed: changing application or test code as part of checklist verification

A criterion stays `[ ]` when it is missing, partial, failing, blocked, ambiguous or not proven.

## Documentation responsibilities

- Product requirements belong in `prd/`.
- Significant technical/security decisions belong in `adr/`.
- User-level behaviour and acceptance criteria belong in `user-stories/`.
- Test strategy, test cases, automation mapping, evidence and traceability belong in `qa/`.
- Exact API routes, schemas, parameters and security declarations belong in OpenAPI.

## Repository placement

Copy this `docs` directory into the repository root:

```text
travel-agency-app/
├── backend/
├── docs/
├── frontend/
└── README.md
```
