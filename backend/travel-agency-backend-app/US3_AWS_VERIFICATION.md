# US-3 AWS Verification

Verification date: 2026-07-28

## Deployment

- Bundle: `travel-agency-backend-app_260728.153259`
- Region: `eu-west-3`
- Status: `succeeded`
- Cognito User Pool: `team3-booking-userpool-enes`
- Travel Agents table: `tm3-TravelAgents-enes`
- Tour Catalog table: `tm3-tour-catalog-enes`

The deployment was restricted to the developer-specific Cognito User
Pool and DynamoDB resources. The shared Lambda, API Gateway, IAM role,
and IAM policy were not included in the deployment command and were not
modified or cleaned.

## Cognito Groups

The personal User Pool contains:

- `ADMIN`
- `CUSTOMER`
- `TRAVEL_AGENT`

## Automatic Role Assignment

### Travel Agent scenario

- Email: `enes.us3.ta.20260728123403@example.com`
- Email exists in the personal Travel Agents table.
- Sign-up status: `201`
- Response: `{"message": "Account created successfully"}`
- Assigned Cognito group: `TRAVEL_AGENT`

### Customer scenario

- Email: `enes.us3.customer.20260728123403@example.com`
- Email does not exist in the personal Travel Agents table.
- Sign-up status: `201`
- Response: `{"message": "Account created successfully"}`
- Assigned Cognito group: `CUSTOMER`

Both users were assigned automatically during sign-up. No manual Cognito
group assignment was performed.

The machine-readable evidence is stored in
`us3_aws_test_results.json`.
