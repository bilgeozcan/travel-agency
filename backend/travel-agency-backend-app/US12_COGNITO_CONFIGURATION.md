# US12 Cognito profile-update configuration

The deployed user pool must keep the current verified email active until the new email is verified.
The repository metadata configures the app-client read/write attributes and Lambda permissions. The current
AWS Syndicate metadata does not expose Cognito UserAttributeUpdateSettings, so apply that setting after
Syndicate deploy/update with the safe helper below.

```powershell
.\.venv\Scripts\python.exe backend\travel-agency-backend-app\deployment\configure_us12_cognito.py --user-pool-id <POOL_ID>
```

Dry run:

```powershell
.\.venv\Scripts\python.exe backend\travel-agency-backend-app\deployment\configure_us12_cognito.py --user-pool-id <POOL_ID> --dry-run
```

The helper reads the current pool with DescribeUserPool, filters the response against the UpdateUserPool
input model, and changes only UserAttributeUpdateSettings.AttributesRequireVerificationBeforeUpdate to
include email. This preserves unrelated Cognito settings.
