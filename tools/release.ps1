# tools/release.ps1 — one-command release for Nizam
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tools\release.ps1 -Version 1.19.2
#   powershell -ExecutionPolicy Bypass -File tools\release.ps1 -Version 1.19.2 -DryRun
#
# What it does:
#   1. bumps package.json version
#   2. rewrites README download links/badges to the new version
#   3. rebuilds resources/app.asar from out/ + node_modules
#   4. builds a clean stage (no .git, node_modules, backups, .bak)
#   5. creates Nizam-Setup-v<ver>.exe (7-Zip self-extracting installer)
#   6. creates Nizam-v<ver>-win-x64.zip (portable fallback)
#   7. commits + pushes to origin/main
#   8. creates the GitHub release and uploads both assets

param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version,

  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSCommandPath -Parent) -Parent
$temp = Join-Path $env:TEMP 'opencode'
if (-not (Test-Path $temp)) { New-Item -ItemType Directory -Path $temp -Force | Out-Null }

$repo = 'nizam1-11/nizam-clipper'
$setupName = "Nizam-Setup-v$Version.exe"
$zipName = "Nizam-v$Version-win-x64.zip"
$stage = Join-Path $temp "nizam_stage_$Version"
$payload = Join-Path $temp "nizam_payload_$Version.7z"
$config = Join-Path $temp "nizam_sfx_$Version.txt"
$setup = Join-Path $temp $setupName
$zip = Join-Path $temp $zipName
$sevenZip = 'C:\Program Files\7-Zip\7z.exe'
$sfx = 'C:\Program Files\7-Zip\7z.sfx'

Write-Host "=== Nizam release v$Version (repo: $repo) ===" -ForegroundColor Cyan
Write-Host "root   : $root"
Write-Host "setup  : $setupName"
Write-Host "zip    : $zipName"

if ($DryRun) {
  Write-Host "`n[DRY RUN] No files changed, nothing committed or uploaded." -ForegroundColor Yellow
  Write-Host "[DRY RUN] Would bump package.json and README links to v$Version"
  Write-Host "[DRY RUN] Would run: npm run build"
  Write-Host "[DRY RUN] Would stage: $stage"
  Write-Host "[DRY RUN] Would create: $setup / $zip"
  Write-Host "[DRY RUN] Would push main and create GitHub release v$Version"
  exit 0
}

# --- preflight -------------------------------------------------------------
foreach ($p in @($sevenZip, $sfx)) {
  if (-not (Test-Path $p)) { throw "Missing required tool: $p" }
}
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  throw 'node_modules missing — run `npm install` first (needed to rebuild app.asar).'
}
& git -C $root rev-parse --is-inside-work-tree 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Not a git repository.' }

# --- 1. version bump -------------------------------------------------------
$pkgPath = Join-Path $root 'package.json'
$pkg = Get-Content -LiteralPath $pkgPath -Raw
$newPkg = [regex]::Replace($pkg, '("version"\s*:\s*")\d+\.\d+\.\d+(")', "`${1}$Version`$2", 1)
if ($newPkg -eq $pkg) { throw 'Could not bump version in package.json' }
[IO.File]::WriteAllText($pkgPath, $newPkg, (New-Object Text.UTF8Encoding($false)))
Write-Host "[1/8] package.json -> v$Version"

# --- 2. README links -------------------------------------------------------
$readmePath = Join-Path $root 'README.md'
$readme = Get-Content -LiteralPath $readmePath -Raw
$readme = [regex]::Replace($readme, 'Nizam-Setup-v\d+\.\d+\.\d+\.exe', $setupName)
$readme = [regex]::Replace($readme, 'Nizam-v\d+\.\d+\.\d+-win-x64\.zip', $zipName)
$readme = [regex]::Replace($readme, 'Nizam Setup v\d+\.\d+\.\d+', "Nizam Setup v$Version")
$readme = [regex]::Replace($readme, 'Nizam v\d+\.\d+\.\d+', "Nizam v$Version")
[IO.File]::WriteAllText($readmePath, $readme, (New-Object Text.UTF8Encoding($false)))
Write-Host '[2/8] README download links updated'

# --- 3. rebuild app.asar ---------------------------------------------------
Push-Location $root
npm run build 2>&1 | Select-Object -Last 4
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'npm run build failed' }
Pop-Location
Write-Host '[3/8] app.asar rebuilt'

# --- 4. clean stage --------------------------------------------------------
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null
robocopy $root $stage /E /XD (Join-Path $root '.git') (Join-Path $root 'node_modules') '*backup*' /XF '*.bak' '*.orig' /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -gt 7) { throw "robocopy failed with $LASTEXITCODE" }
Get-ChildItem $stage -Recurse -Directory -Force | Where-Object { $_.Name -like '*.bak' } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
if (-not (Test-Path (Join-Path $stage 'Nizam.exe'))) { throw 'Nizam.exe missing from stage' }
Write-Host '[4/8] clean stage ready'

# --- 5. self-extracting setup ---------------------------------------------
foreach ($f in @($payload, $config, $setup)) { if (Test-Path $f) { Remove-Item $f -Force } }
Push-Location $stage
& $sevenZip a -t7z -mx=3 -bso0 -bsp0 $payload '.' 2>&1 | Out-Null
Pop-Location
if ($LASTEXITCODE -ne 0) { throw '7z payload creation failed' }
& $sevenZip t -bso0 $payload 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw '7z payload integrity test failed' }

$cfg = @"
;!@Install@!UTF-8!
Title="Nizam v$Version - Setup"
BeginPrompt="Install Nizam v$Version (offline AI video clipper)?"
Progress="yes"
Directory="Nizam"
RunProgram="Nizam.exe"
;!@InstallEnd@!
"@
[IO.File]::WriteAllText($config, $cfg, (New-Object Text.UTF8Encoding($false)))
cmd /c "copy /b `"$sfx`" + `"$config`" + `"$payload`" `"$setup`" >nul"
if (-not (Test-Path $setup)) { throw 'SFX setup creation failed' }
Write-Host ("[5/8] setup ready: {0} MB" -f [math]::Round((Get-Item $setup).Length / 1MB, 1))

# --- 6. portable ZIP fallback ---------------------------------------------
if (Test-Path $zip) { Remove-Item $zip -Force }
Push-Location $stage
& $sevenZip a -tzip -mx=3 -bso0 -bsp0 $zip '.' 2>&1 | Out-Null
Pop-Location
if ($LASTEXITCODE -ne 0) { throw 'ZIP creation failed' }
Write-Host ("[6/8] zip ready: {0} MB" -f [math]::Round((Get-Item $zip).Length / 1MB, 1))

# --- 7. commit + push ------------------------------------------------------
Push-Location $root
git add -A
git commit -m "release: v$Version" 2>&1 | Select-Object -Last 2
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'git commit failed' }
git push origin main 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'git push failed' }
Pop-Location
Write-Host '[7/8] committed and pushed to origin/main'

# --- 8. GitHub release -----------------------------------------------------
$notes = Join-Path $temp "nizam_notes_$Version.md"
$notesText = @"
## Nizam v$Version — Windows (x64)

Click **Nizam-Setup-v$Version.exe** to download the self-extracting installer.
Run it, confirm the prompt, and it installs into a ``Nizam`` folder and launches the app.

A portable ZIP is also attached as a fallback.

Source: https://github.com/$repo
"@
[IO.File]::WriteAllText($notes, $notesText, (New-Object Text.UTF8Encoding($false)))

gh release create "v$Version" `
  "$setup#Nizam Setup v$Version (click to download)" `
  "$zip#Portable ZIP (fallback)" `
  --title "Nizam v$Version" --notes-file $notes --repo $repo 2>&1 | Select-Object -Last 3
if ($LASTEXITCODE -ne 0) { throw "gh release create failed for v$Version" }

Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "Release : https://github.com/$repo/releases/tag/v$Version"
Write-Host "Setup   : https://github.com/$repo/releases/latest/download/$setupName"
Write-Host "ZIP     : https://github.com/$repo/releases/latest/download/$zipName"

# clean up large temp artifacts
Remove-Item $payload -Force -ErrorAction SilentlyContinue
Remove-Item $config -Force -ErrorAction SilentlyContinue
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
