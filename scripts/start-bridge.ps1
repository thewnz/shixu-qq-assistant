param([Parameter(Mandatory=$true)][string]$BridgeRoot,[Parameter(Mandatory=$true)][string]$QQPath)
$ErrorActionPreference = 'Stop'
$runtimePath = Join-Path ([System.IO.Path]::GetFullPath($BridgeRoot)) 'runtime'
$launcherPath = Join-Path $runtimePath 'NapCatWinBootMain.exe'
$hookPath = Join-Path $runtimePath 'NapCatWinBootHook.dll'
$qqExecutable = [System.IO.Path]::GetFullPath($QQPath)
if (-not (Test-Path -LiteralPath $qqExecutable) -or -not (Test-Path -LiteralPath $launcherPath)) { throw 'QQ or bridge executable not found.' }
$env:NAPCAT_PATCH_PACKAGE = Join-Path $runtimePath 'qqnt.json'
$env:NAPCAT_LOAD_PATH = Join-Path $runtimePath 'loadNapCat.js'
$env:NAPCAT_INJECT_PATH = $hookPath
$env:NAPCAT_LAUNCHER_PATH = $launcherPath
$env:NAPCAT_MAIN_PATH = Join-Path $runtimePath 'napcat.mjs'
$mainUri = ([System.Uri]::new($env:NAPCAT_MAIN_PATH)).AbsoluteUri
[System.IO.File]::WriteAllText($env:NAPCAT_LOAD_PATH, '(async () => {await import("'+$mainUri+'")})()', [System.Text.UTF8Encoding]::new($false))
$stdoutPath = Join-Path $runtimePath 'boot.stdout.log'
$stderrPath = Join-Path $runtimePath 'boot.stderr.log'
$bridgeProcess = Start-Process -FilePath $launcherPath -ArgumentList ('"'+$qqExecutable+'" "'+$hookPath+'"') -WorkingDirectory $runtimePath -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
Write-Output "Bridge launcher started. PID: $($bridgeProcess.Id). Local login UI: http://127.0.0.1:6099/webui/"
