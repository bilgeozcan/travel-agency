# US-10 — Automated Reports

## 1. Story metadata

| Field | Value |
|---|---|
| Jira | EPMTPETA-9971 |
| Primary actors | Travel Agency Admin, automated reporting services |
| Business capability | Automated operational report generation and delivery |
| Main components | SQS, Reports Handler Lambda, Reports DynamoDB table, EventBridge, Reports Sender Lambda, SES |
| Related work | EPMTPETA-12597, EPMTPETA-12598, EPMTPETA-12599, EPMTPETA-12603, EPMTPETA-12605, EPMTPETA-12607, EPMTPETA-12610, EPMTPETA-13789, EPMTPETA-13790 |
| Priority | Required |
| Dependencies | Booking/feedback events, AWS IAM, SQS, DynamoDB, EventBridge, SES |

## 2. User story

**As a Travel Agency Admin, I want the system to automatically aggregate operational events and send scheduled reports so that I can review booking and service statistics without manual data collection.**

## 3. Business value

Automated reporting converts booking and feedback activity into operational information with minimal manual effort. The event-driven design decouples transactional APIs from report processing and provides a repeatable scheduled delivery path.

## 4. Scope

### In scope

- Reports SQS queue.
- Booking-finished event publication.
- Feedback event publication.
- Reports Handler Lambda.
- Reports DynamoDB table/schema.
- Event processing and aggregation.
- EventBridge schedule.
- Reports Sender Lambda.
- SES verified identity.
- Scheduled email/report delivery.
- End-to-end report flow validation.
- Idempotent/safe event processing according to implementation.

### Out of scope

- Public unauthenticated report delivery.
- Arbitrary external recipients.
- Full BI/data-warehouse platform.
- Manual spreadsheet editing inside the system.
- Real-time streaming dashboard unless separately approved.

## 5. Preconditions

- Required AWS resources are deployed.
- IAM permissions allow queue, table, schedule and SES operations.
- SES sender/recipient requirements are satisfied for the environment.
- Booking/feedback producers can publish reporting events.
- EventBridge schedule is configured.

## 6. Event ingestion flow

1. A reportable business event occurs.
2. The source component publishes a message to the reports SQS queue.
3. The Reports Handler Lambda receives the event.
4. The handler validates/parses the event.
5. The relevant reporting aggregate is updated in the reports table.
6. Processing completes without affecting the originating transaction flow.

## 7. Scheduled report flow

1. EventBridge reaches the configured reporting schedule.
2. EventBridge invokes the Reports Sender Lambda.
3. The sender reads the required reporting data.
4. The sender formats the report content.
5. SES sends the report to the configured Travel Agency/Admin destination.
6. Delivery/processing errors follow the configured retry/failure handling.

## 8. Alternative and error flows

- Invalid queue event: reject/record according to handler policy.
- Duplicate/replayed event: processing follows idempotency/aggregation rules.
- DynamoDB write failure: invocation fails/retries according to AWS configuration.
- EventBridge invocation failure: AWS retry/failure policy applies.
- SES identity not verified: delivery fails with observable error.
- Missing report data: sender produces the approved empty/no-data behavior.

## 9. Business and security rules

- Transactional booking/feedback APIs do not synchronously perform full report generation.
- Reporting events contain only required operational data.
- Queue/table/sender access is controlled by IAM.
- Scheduled delivery is performed by the dedicated sender component.
- SES identity and environment restrictions are respected.
- Booking-finished and feedback events use the approved event contract.
- Report data aggregation remains deterministic for the same accepted event set.

## 10. Acceptance criteria

> Only the checkbox marker may be changed during verification. Criterion wording must remain unchanged.

- [X] **AC-US10-01** — A reports SQS queue is configured for asynchronous reporting events.
- [X] **AC-US10-02** — Eligible BOOKING_FINISHED activity publishes the required reporting event.
- [X] **AC-US10-03** — Eligible feedback activity publishes the required reporting event.
- [X] **AC-US10-04** — The Reports Handler Lambda consumes and validates supported queue events.
- [X] **AC-US10-05** — Supported events update the Reports DynamoDB data model as designed.
- [X] **AC-US10-06** — Invalid processing does not silently corrupt reporting aggregates.
- [X] **AC-US10-07** — EventBridge is configured to invoke the report-sending workflow on schedule.
- [X] **AC-US10-08** — The Reports Sender Lambda reads the required reporting data.
- [X] **AC-US10-09** — The Reports Sender produces the approved report message/content.
- [X] **AC-US10-10** — SES identity configuration supports report delivery in the target environment.
- [X] **AC-US10-11** — The scheduled workflow can send a report to the configured Travel Agency/Admin destination.
- [X] **AC-US10-12** — Required IAM permissions are scoped to the reporting resources used by each component.
- [X] **AC-US10-13** — Queue, handler, table, scheduler, sender and SES resources are represented in deployment/configuration.
- [X] **AC-US10-14** — Reporting failures follow observable AWS retry/error behavior rather than being silently ignored.
- [X] **AC-US10-15** — End-to-end reporting flow validation passes for the delivered Sprint 2 environment.
- [X] **AC-US10-16** — Relevant automated/unit/integration reporting checks pass.

## 11. Test references

### Automated / QA

- Jira QA task: `EPMTPETA-12610` — End-to-end report flow test.
- Reports Handler tests.
- Reports Sender tests.
- Booking/feedback event publication tests.
- Infrastructure/deployment validation for SQS, EventBridge and SES.

### Manual

- AWS evidence: queue → Reports Handler → Reports table → EventBridge → Reports Sender → SES.
- CloudWatch/log inspection when required.

## 12. Traceability

- Jira story: `EPMTPETA-9971`
- SQS setup: `EPMTPETA-12597`
- Reports Handler: `EPMTPETA-12598`
- Reports table: `EPMTPETA-12599`
- EventBridge: `EPMTPETA-12603`
- Reports Sender + SES: `EPMTPETA-12605`, `EPMTPETA-12607`
- Sprint 2 demo evidence: API/AWS queue → DB → SES reporting path.
