[CmdletBinding()]
param(
  [string]$RepoRoot = "",
  [string]$ServiceAccountPath = "",
  [switch]$SkipInstall,
  [switch]$SkipLogin,
  [switch]$SkipCheck
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
  $RepoRoot = (Resolve-Path $RepoRoot).Path
}

Set-Location $RepoRoot

Write-Step "Working from $RepoRoot"

if (-not $SkipInstall) {
  Write-Step "Preparing pnpm and installing dependencies"
  corepack enable
  corepack prepare pnpm@10.33.0 --activate
  pnpm install --frozen-lockfile
} else {
  Write-Step "Skipping dependency install"
}

if ($ServiceAccountPath) {
  $resolvedServiceAccountPath = (Resolve-Path $ServiceAccountPath).Path
  $env:GOOGLE_APPLICATION_CREDENTIALS = $resolvedServiceAccountPath
  Write-Step "Using service account credentials at $resolvedServiceAccountPath"
} else {
  $env:GOOGLE_APPLICATION_CREDENTIALS = ""
  Write-Step "Cleared GOOGLE_APPLICATION_CREDENTIALS so Firebase CLI can use browser login"

  if (-not $SkipLogin) {
    Write-Step "Starting Firebase CLI login"
    node scripts/run-firebase-cli.mjs login
  } else {
    Write-Step "Skipping Firebase CLI login"
  }

  Write-Step "Checking active Firebase CLI accounts"
  node scripts/run-firebase-cli.mjs login:list
}

Write-Step "Listing SQL Connect services"
node scripts/run-firebase-cli.mjs dataconnect:services:list

Write-Step "Deploying SQL Connect schema and connectors"
node scripts/run-firebase-cli.mjs deploy --only dataconnect

Write-Step "Listing SQL Connect services after deploy"
node scripts/run-firebase-cli.mjs dataconnect:services:list

if (-not $SkipCheck) {
  Write-Step "Running web typecheck"
  pnpm --filter @vyb/web check
} else {
  Write-Step "Skipping web typecheck"
}

Write-Step "Done"
Write-Host "Next manual checks:" -ForegroundColor Green
Write-Host "  1. Save any post"
Write-Host "  2. Open Events page"
Write-Host "  3. Create or edit an event"
