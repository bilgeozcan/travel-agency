# ADR-001 — Use an AWS Serverless Backend Architecture

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07 |
| Scope | Backend platform and deployment |
| Related stories | US-1 through US-6 |

## Context

The application requires authentication, API endpoints, role-aware business logic, persistent data access and scheduled booking updates. The project is implemented as an educational serverless application and must support independently deployable backend handlers and managed AWS services.

## Decision

Use an AWS serverless architecture built around:

- API Gateway for HTTP API exposure and authorization integration.
- AWS Lambda for authentication, tour, profile and booking handlers.
- Amazon Cognito for user identity and session management.
- Persistent managed storage for application records.
- Scheduled execution for automatic booking completion.
- Project deployment/configuration through the repository's existing serverless tooling.

## Consequences

### Positive

- Infrastructure scales without dedicated server management.
- Authentication integrates with managed Cognito capabilities.
- Functions can be tested independently.
- Scheduled work can be isolated from request handlers.
- The architecture fits the project's deployment model.

### Negative

- Local testing cannot reproduce every API Gateway/Cognito behaviour.
- IAM, authorizer and environment configuration become part of application correctness.
- Distributed logs and AWS dependency failures require explicit diagnostics.
- Integration testing in a deployed environment remains necessary.

## Alternatives considered

- Long-running monolithic application server.
- Containerized backend service.
- Self-hosted identity management.

These alternatives were not selected because they would add infrastructure and identity-management scope outside the current project baseline.
