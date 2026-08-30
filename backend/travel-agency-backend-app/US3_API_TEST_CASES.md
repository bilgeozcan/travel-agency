# US-3 API Test Cases

## Test Information

- Parent Jira issue: [EPMTPETA-9962](https://jiraeu.epam.com/browse/EPMTPETA-9962)
- User story: Automatic Role Assignment
- Test date: 30 July 2026
- Source commit: `9f350fe`
- AWS region: `eu-west-3`
- API: `OpenAPI Travel Agency (Sprint 1)`
- Stage: `api`
- Cognito user pool: `team3-booking-userpool-enes-us3`
- Travel Agents table: `tm3-TravelAgents-enes-us3`
- Build bundle: `travel-agency-backend-app_260730.161607`
- Final result: **Passed**

No password, AWS credential, access token, ID token, refresh token, or complete JWT value is included in this document.

## Acceptance Criteria Mapping

| US-3 acceptance criterion | Covered by |
| --- | --- |
| Customer, Travel Agent, and Admin roles exist | `US3-TC-01` |
| Travel Agent users can be listed in the database | `US3-TC-02` |
| Registration checks whether the email exists in the Travel Agents table | `US3-TC-02`, `US3-TC-03` |
| A listed email is assigned to Travel Agent automatically | `US3-TC-02` |
| An email not listed is assigned to Customer automatically | `US3-TC-03` |
| The assigned role is available for the profile UI | `US3-TC-04` |
| Role assignment does not require manual admin action | `US3-TC-02`, `US3-TC-03` |
| Protected endpoints reject missing or invalid authentication | `US3-TC-05`, `US3-TC-06` |
| Customer and Travel Agent can access allowed protected endpoints | `US3-TC-07`, `US3-TC-08` |
| A user without an allowed role receives `403 Forbidden` | `US3-TC-09` |
| Request data cannot be used for privilege escalation | `US3-TC-10` |

## Test Cases

### US3-TC-01 — Provision Required Cognito Groups

**Prerequisites**

- The latest development version is built and deployed.
- The personal Cognito user pool exists.

**Steps**

1. Run the Cognito group provisioning command.
2. Open or query the personal user pool.
3. Check the available groups.

**Expected result**

`CUSTOMER`, `TRAVEL_AGENT`, and `ADMIN` groups exist.

**Actual result**

All three groups were created successfully.

**Result:** Passed

**AWS evidence:** Cognito user pool `team3-booking-userpool-enes-us3`.

### US3-TC-02 — Assign Travel Agent Role Automatically

**Prerequisites**

- The Travel Agents table and Cognito groups exist.
- A new test email is stored in the Travel Agents table.

**Steps**

1. Add the test email to `tm3-TravelAgents-enes-us3`.
2. Send `POST /auth/sign-up` with the same email.
3. Check the user groups in Cognito.

**Expected result**

Registration returns `201` and the user is added to `TRAVEL_AGENT` automatically.

**Actual result**

Registration returned `201`. The user had only the `TRAVEL_AGENT` group.

**Result:** Passed

**AWS evidence:** DynamoDB table `tm3-TravelAgents-enes-us3` and the personal Cognito user pool.

### US3-TC-03 — Assign Customer Role Automatically

**Prerequisites**

- The Travel Agents table and Cognito groups exist.
- The new test email is not stored in the Travel Agents table.

**Steps**

1. Send `POST /auth/sign-up` with a new email.
2. Do not manually add a role.
3. Check the user groups in Cognito.

**Expected result**

Registration returns `201` and the user is added to `CUSTOMER` automatically.

**Actual result**

Registration returned `201`. The user had only the `CUSTOMER` group.

**Result:** Passed

**AWS evidence:** Personal Cognito user pool user and group membership.

### US3-TC-04 — Return Assigned Role During Sign-In

**Prerequisites**

- Customer and Travel Agent test users exist.

**Steps**

1. Sign in as the Customer.
2. Check `user.role` in the response.
3. Sign in as the Travel Agent.
4. Check `user.role` in the response.

**Expected result**

The Customer response contains `CUSTOMER`. The Travel Agent response contains `TRAVEL_AGENT`.

**Actual result**

Both sign-in requests returned `200` and returned the correct role.

**Result:** Passed

**Evidence:** Safe response fields `user.role`; token values were excluded.

### US3-TC-05 — Reject Request Without Token

**Prerequisites**

- `GET /bookings` is protected by the Cognito authorizer.

**Steps**

1. Send `GET /bookings` without an `Authorization` header.

**Expected result**

The API returns `401 Unauthorized`.

**Actual result**

The API returned `401 Unauthorized`.

**Result:** Passed

**Evidence:** API Gateway response `{"message": "Unauthorized"}`.

### US3-TC-06 — Reject Invalid Token

**Prerequisites**

- `GET /bookings` is protected by the Cognito authorizer.

**Steps**

1. Send `GET /bookings` with an invalid JWT value.

**Expected result**

The API returns `401 Unauthorized`.

**Actual result**

The API returned `401 Unauthorized`.

**Result:** Passed

**Evidence:** API Gateway response `{"message": "Unauthorized"}`.

### US3-TC-07 — Allow Customer Access

**Prerequisites**

- A Customer user exists.
- A valid Customer ID token is obtained.

**Steps**

1. Send `GET /bookings` with the Customer ID token.

**Expected result**

The protected endpoint accepts the request and returns `200`.

**Actual result**

The API returned `200` with an empty bookings list.

**Result:** Passed

**Evidence:** API response `{"bookings": []}`.

### US3-TC-08 — Allow Travel Agent Access

**Prerequisites**

- A Travel Agent user exists.
- A valid Travel Agent ID token is obtained.

**Steps**

1. Send `GET /bookings` with the Travel Agent ID token.

**Expected result**

The protected endpoint accepts the request and returns `200`.

**Actual result**

The API returned `200` with an empty bookings list.

**Result:** Passed

**Evidence:** API response `{"bookings": []}`.

### US3-TC-09 — Reject User Without Allowed Role

**Prerequisites**

- A real Cognito test user exists without any role group.
- A valid ID token is obtained for this user.

**Steps**

1. Send `GET /bookings` with the unassigned user's ID token.

**Expected result**

The API returns `403 Forbidden`.

**Actual result**

The API returned `403` with code `FORBIDDEN`.

**Result:** Passed

**Evidence:** Response message: `Role 'USER' is not authorized to perform this action.`

### US3-TC-10 — Block Privilege Escalation Through Request Body

**Prerequisites**

- A real Cognito test user exists without any role group.
- A valid ID token is obtained for this user.

**Steps**

1. Send `POST /bookings` with the unassigned user's token.
2. Add fake `role`, `groups`, and `authenticatedUser` Customer fields to the request body.

**Expected result**

The API ignores the fake role fields and returns `403 Forbidden`.

**Actual result**

The API returned `403` with code `FORBIDDEN`. The request body did not change the authenticated role.

**Result:** Passed

**Evidence:** Response message: `Role 'USER' is not authorized to perform this action.`

## Execution Notes

- The first deploy attempt reported missing personal aliases for the new bookings and reviews tables. Personal aliases were added before the successful deploy.
- Existing shared Lambda and API Gateway resources required explicit Syndicate update commands after deploy.
- The first positive booking requests reached Lambda but returned `500` because the updated IAM policy had not propagated yet. The policy was updated, AWS policy simulation returned `allowed`, and the final repeated tests returned `200`.
- These observations were resolved during test setup. No final test case is failed.

## AWS Evidence References

- Cognito user pool: `team3-booking-userpool-enes-us3`
- Travel Agents table: `tm3-TravelAgents-enes-us3`
- Bookings table: `tm3-bookings-enes-us3`
- API Gateway: `OpenAPI Travel Agency (Sprint 1)`, stage `api`
- Lambda: `api_handler`
- CloudWatch log group: `/aws/lambda/api_handler`
- Build bundle: `travel-agency-backend-app_260730.161607`
- Final test execution: `2026-07-30T13:24:59Z`
