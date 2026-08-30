# Automated Testing

## Scope

This directory documents the existing automated suite and provides commands to run it. The authoritative tests remain in the backend/frontend source trees.

## Backend location

`backend/travel-agency-backend-app/pyapp/tests`

## Execution expectations

- Run commands from `backend/travel-agency-backend-app`, not from the nested `pyapp` directory, unless the project test configuration explicitly supports it.
- Use the project virtual environment.
- Validate OpenAPI JSON before deployment.
- Run targeted tests first, then the complete regression suite.
- Record branch, commit, Python/Node versions and complete result.

## Suggested merge-request sequence

1. Python syntax/compile validation for changed modules.
2. `python -m json.tool openapi_travel_agency_sprint1_v1_oas_v3.json`
3. Targeted pytest files.
4. Full API-handler pytest suite.
5. Scheduled-lambda tests when changed.
6. Frontend authentication/feature tests.
7. Frontend production build.
8. `git diff --check`.

## Coverage policy

A test file listed in the inventory means that evidence of that suite has been observed in project work. The current `develop` branch must still be checked before claiming release coverage.
