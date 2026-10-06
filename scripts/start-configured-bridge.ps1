$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$locatorPath = Join-Path $projectRoot '.local-data/bridge-location.json'
if (-not (Test-Path -LiteralPath $locatorPath)) { throw 'Bridge has not been configured. See README.md.' }
$locator = Get-Content -LiteralPath $locatorPath -Raw | ConvertFrom-Json
$bridgeRoot = Split-Path -Parent $locator.runtime
& (Join-Path $PSScriptRoot 'start-bridge.ps1') -BridgeRoot $bridgeRoot -QQPath $locator.qqPath
