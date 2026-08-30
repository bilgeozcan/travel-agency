#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${1:-$(cd "$SCRIPT_DIR/../../../.." && pwd)}"
BACKEND="$REPO_ROOT/backend/travel-agency-backend-app"

if [[ ! -d "$BACKEND" ]]; then
  echo "Backend directory not found: $BACKEND" >&2
  exit 1
fi

cd "$BACKEND"

echo "Validating OpenAPI JSON..."
python -m json.tool openapi_travel_agency_sprint1_v1_oas_v3.json >/dev/null

echo "Running API handler tests..."
python -m pytest pyapp/tests/test_api_handler -q

if [[ -d pyapp/tests/test_booking_status_updater ]]; then
  echo "Running booking status updater tests..."
  python -m pytest pyapp/tests/test_booking_status_updater -q
fi

echo "Checking whitespace..."
cd "$REPO_ROOT"
git diff --check

echo "Backend automated validation passed."
