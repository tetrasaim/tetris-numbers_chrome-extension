# Chrome Extension Updater - Tetris Numbers
$ZipUrl = "https://github.com/tetrasaim/tetris-numbers_chrome-extension/archive/refs/heads/main.zip"

function Write-Banner($msg, $color) { Write-Host "`n==========================================`n  $msg`n==========================================" -ForegroundColor $color }

Write-Banner "Chrome Extension Updater - Tetris Numbers" Cyan

$ExtFolder = (Read-Host "`nPaste the path to your extension folder and press Enter`nPath").Trim().Trim('"')
if (-not (Test-Path $ExtFolder)) { Write-Host "[Error] Folder not found: $ExtFolder" -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }

$TmpDir     = Join-Path $env:TEMP ("ext_update_" + [System.IO.Path]::GetRandomFileName())
$ZipFile    = Join-Path $TmpDir "extension.zip"
$ExtractDir = Join-Path $TmpDir "extracted"
New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null

try {
    Write-Host "[1/4] Downloading ZIP from GitHub..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipFile -UseBasicParsing

    Write-Host "[2/4] Extracting ZIP..." -ForegroundColor Yellow
    Expand-Archive -Path $ZipFile -DestinationPath $ExtractDir -Force

    $InnerDir = Get-ChildItem $ExtractDir -Directory | Select-Object -First 1 -ExpandProperty FullName
    $KeyFile  = Get-ChildItem $ExtFolder -Filter "tetrasaim.otf" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($null -eq $KeyFile) {
        $Destination = Join-Path $ExtFolder (Split-Path $InnerDir -Leaf)
        Write-Host "[3/4] First install - creating: $Destination" -ForegroundColor Yellow
        Copy-Item $InnerDir -Destination $Destination -Recurse
    } else {
        $Destination = Split-Path $KeyFile.FullName -Parent
        Write-Host "[3/4] Update - replacing: $Destination" -ForegroundColor Yellow
        Remove-Item "$Destination\*" -Recurse -Force
        Copy-Item "$InnerDir\*" -Destination $Destination -Recurse -Force
    }

    Write-Host "[4/4] Cleaning up..." -ForegroundColor Yellow
    Remove-Item $TmpDir -Recurse -Force

    Write-Banner "Extension updated successfully!" Green
    Write-Host "Next steps in Chrome:" -ForegroundColor Cyan
    @("Open chrome://extensions", "Enable Developer Mode", "Click 'Load unpacked'", "Select: $Destination") |
        ForEach-Object { Write-Host "  - $_" }

} catch {
    Write-Host "[Error] $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path $TmpDir) { Remove-Item $TmpDir -Recurse -Force }
}

Read-Host "`nPress Enter to exit"