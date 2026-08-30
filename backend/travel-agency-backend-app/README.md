# travel-agency-backend-app

High level project overview - business value it brings, non-detailed technical overview.

### Notice
All the technical details described below are actual for the particular
version, or a range of versions of the software.
### Actual for versions: 1.0.0

## travel-agency-backend-app diagram

![travel-agency-backend-app](pics/travel-agency-backend-app_diagram.png)

## Lambdas descriptions

### Lambda `lambda-name`
Lambda feature overview.

### Required configuration
#### Environment variables
* environment_variable_name: description

#### Trigger event
```buildoutcfg
{
    "key": "value",
    "key1": "value1",
    "key2": "value3"
}
```
* key: [Required] description of key
* key1: description of key1

#### Expected response
```buildoutcfg
{
    "status": 200,
    "message": "Operation succeeded"
}
```
---

## Deployment from scratch
1. Build the Syndicate bundle:
   ```bash
   syndicate build
   ```
2. Deploy the bundle and provision the required Cognito groups:
   ```bash
   python -m deployment.deploy_with_cognito_groups --bundle-name <bundle-name>
   ```

The deployment wrapper creates the `CUSTOMER`, `TRAVEL_AGENT`, and `ADMIN`
groups after Syndicate deploys the configured Cognito User Pool. Group
provisioning is idempotent, so the command is safe to run again when all
required groups already exist.

## Manual post-deploy steps (not covered by Syndicate)

### SES identity verification (reports pipeline, EPMTPETA-12607)

The Reports Sender Lambda (EPMTPETA-12605) sends the weekly report email
through SES. SES identities cannot be provisioned via Syndicate/IaC — they
must be verified manually, once per AWS account/region, via the console or
CLI:

```bash
aws ses verify-email-identity --email-address <sender-address> --region eu-west-3
aws ses verify-email-identity --email-address <recipient-address> --region eu-west-3
```

Each address receives a confirmation email from AWS that must be opened and
clicked before the identity becomes usable. Check status with:

```bash
aws ses get-identity-verification-attributes --identities <address> --region eu-west-3
```

**This account's SES account is in sandbox mode** — both the sender *and*
every recipient address must be individually verified this way, or
`SendEmail` calls fail with `MessageRejected`. Requesting production access
(to send to arbitrary, unverified recipients) is a separate, not-yet-needed
step.

**Sandbox reset risk**: this is a personal/sandbox AWS account
(`364410974634`, `eu-west-3`, resource names use an `-ahmet` suffix). If the
account or region is ever reset/recreated, verified SES identities are lost
and must be re-verified before the reports pipeline can send email again.

