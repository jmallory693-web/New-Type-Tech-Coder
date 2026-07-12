# Stage 14 helper: create Desktop shortcut to packaged New Type Tech Coder.
# No admin required. Does not rebuild, install, or start Vite.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $repoRoot "release\win-unpacked\New Type Tech Coder.exe"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcut = Join-Path $desktop "New Type Tech Coder.lnk"

if (-not (Test-Path -LiteralPath $exe)) {
  Write-Host ""
  Write-Host "Cannot create shortcut - packaged app was not found."
  Write-Host ""
  Write-Host "Expected file:"
  Write-Host "  $exe"
  Write-Host ""
  Write-Host "Package first with: npm run pack"
  Write-Host "Or install using: release\New Type Tech Coder-0.1.0-Setup.exe"
  Write-Host ""
  exit 1
}

if (-not (Test-Path -LiteralPath $desktop)) {
  Write-Host ""
  Write-Host "Cannot create shortcut - Desktop folder was not found."
  Write-Host "  $desktop"
  Write-Host ""
  Write-Host "You can still double-click: Open New Type Tech Coder.bat"
  Write-Host ""
  exit 1
}

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($shortcut)
$s.TargetPath = $exe
$s.WorkingDirectory = Split-Path -Parent $exe
$s.Description = "New Type Tech Coder (packaged)"
$s.Save()

Write-Host ""
Write-Host "Desktop shortcut created:"
Write-Host "  $shortcut"
Write-Host ""
Write-Host "Target:"
Write-Host "  $exe"
Write-Host ""