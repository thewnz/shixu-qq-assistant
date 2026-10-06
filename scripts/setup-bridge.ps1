param([Parameter(Mandatory=$true)][string]$BridgeRoot)
$ErrorActionPreference = 'Stop'
$bridgePath = [System.IO.Path]::GetFullPath($BridgeRoot)
if ($bridgePath -match '[^\x00-\x7F]' -or $bridgePath.Contains(' ')) { throw 'NapCat bridge directory must use an ASCII path without spaces.' }
New-Item -ItemType Directory -Path $bridgePath -Force | Out-Null
$archivePath = Join-Path $bridgePath 'NapCat.Shell.v4.18.30.zip'
$downloadUrl = 'https://github.com/NapNeko/NapCatQQ/releases/download/v4.18.30/NapCat.Shell.zip'
if (-not (Test-Path -LiteralPath $archivePath)) { Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath }
$expectedHash = '902207c64c249eae98f868e41d5546920d78d7ecb5eae8cabb5b3d6fae556583'
$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) { throw 'Bridge archive hash mismatch. Do not run this archive.' }
$runtimePath = Join-Path $bridgePath 'runtime'
if (-not (Test-Path -LiteralPath $runtimePath)) { Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimePath }
Write-Output "Verified NapCat v4.18.30 extracted to $runtimePath"
