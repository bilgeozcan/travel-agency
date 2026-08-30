param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
)

$ErrorActionPreference = "Stop"
$Backend = Join-Path $RepoRoot "backend\travel-agency-backend-app"

if (-not (Test-Path $Backend)) {
    throw "Backend directory not found: $Backend"
}

Push-Location $Backend
try {
    Write-Host "Validating OpenAPI JSON..."
    python -m json.tool ".\openapi_travel_agency_sprint1_v1_oas_v3.json" > $null

    Write-Host "Running API handler tests..."
    python -m pytest ".\pyapp\tests\test_api_handler" -q
    if ($LASTEXITCODE -ne 0) { throw "API handler tests failed." }

    $UpdaterTests = ".\pyapp\tests\test_booking_status_updater"
    if (Test-Path $UpdaterTests) {
        Write-Host "Running booking status updater tests..."
        python -m pytest $UpdaterTests -q
        if ($LASTEXITCODE -ne 0) { throw "Booking status updater tests failed." }
    }

    Write-Host "Checking whitespace..."
    Push-Location $RepoRoot
    try {
        git diff --check
        if ($LASTEXITCODE -ne 0) { throw "Whitespace validation failed." }
    }
    finally {
        Pop-Location
    }

    Write-Host "Backend automated validation passed."
}
finally {
    Pop-Location
}
