$ErrorActionPreference = 'Stop'
$installer = @(Get-ChildItem "$PSScriptRoot/../release/*.exe")
if ($installer.Count -ne 1) { throw 'Expected exactly one setup executable' }
$testRoot = Join-Path $env:RUNNER_TEMP 'zuzucord-install-test'
$installDir = Join-Path $testRoot 'app'
New-Item -ItemType Directory -Force $testRoot | Out-Null
$appExe = Join-Path $installDir 'ZuzuCord.exe'
$env:ZUZUCORD_SMOKE_REPORT = Join-Path $testRoot 'launch.json'

function Run-Checked($file, $arguments, $seconds = 120) {
  $process = Start-Process -FilePath $file -ArgumentList $arguments -PassThru
  if (-not $process.WaitForExit($seconds * 1000)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Process timed out: $file"
  }
  if ($process.ExitCode -ne 0) {
    if (Test-Path $env:ZUZUCORD_SMOKE_REPORT) {
      Write-Host (Get-Content $env:ZUZUCORD_SMOKE_REPORT -Raw)
    }
    throw "Process failed ($($process.ExitCode)): $file"
  }
}

# /D must be last and unquoted in NSIS's command line.
Run-Checked $installer[0].FullName @('/S', '/currentuser', "/D=$installDir")
if (-not (Test-Path $appExe)) { throw 'Setup did not install ZuzuCord.exe' }
Run-Checked $appExe @('--disable-gpu') 60
$report = Get-Content $env:ZUZUCORD_SMOKE_REPORT -Raw | ConvertFrom-Json
$expected = (Get-Content "$PSScriptRoot/../package.json" -Raw | ConvertFrom-Json).version
if (-not $report.ok -or $report.version -ne $expected) { throw "Launch failed: $($report | ConvertTo-Json -Compress)" }

# Reinstall must preserve the existing local profile and still open.
$marker = Join-Path $testRoot 'smoke-profile/preserve.txt'
Set-Content $marker 'preserve-profile'
Run-Checked $installer[0].FullName @('/S', '/currentuser', "/D=$installDir")
if ((Get-Content $marker -Raw).Trim() -ne 'preserve-profile') { throw 'Repair removed the profile' }
Remove-Item $env:ZUZUCORD_SMOKE_REPORT
Run-Checked $appExe @('--disable-gpu') 60
$report = Get-Content $env:ZUZUCORD_SMOKE_REPORT -Raw | ConvertFrom-Json
if (-not $report.ok -or $report.version -ne $expected -or -not $report.detail.restored) { throw 'Repaired application failed to restore its encrypted test session' }
Write-Host "Installed and reinstalled ZuzuCord $expected; sign-in UI and desktop bridge passed."

# The uninstaller copies itself to a temporary process; wait for actual removal.
Run-Checked (Join-Path $installDir 'Uninstall ZuzuCord.exe') @('/S')
$deadline = (Get-Date).AddSeconds(30)
while ((Test-Path $appExe) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
if (Test-Path $appExe) { throw 'Uninstall did not remove the application' }
if (-not (Test-Path $marker)) { throw 'Uninstall removed the isolated test profile' }
Write-Host 'Uninstall passed.'
