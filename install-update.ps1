# Chrome Extension Updater - Tetris Numbers

$ZipUrl = "https://github.com/tetrasaim/tetris-numbers_chrome-extension/archive/refs/heads/main.zip"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Chrome Extension Updater - Tetris Numbers" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Paste the path to your extension folder and press Enter:" -ForegroundColor Yellow
$ExtFolder = (Read-Host "Path").Trim().Trim('"')

if (-not (Test-Path $ExtFolder)) {
    Write-Host "[Error] Folder not found: $ExtFolder" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

$TmpDir = Join-Path $env:TEMP ("ext_update_" + [System.IO.Path]::GetRandomFileName())
$ZipFile = Join-Path $TmpDir "extension.zip"
$ExtractDir = Join-Path $TmpDir "extracted"
New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null

try {
    Write-Host "[1/4] Downloading ZIP from GitHub..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipFile -UseBasicParsing

    Write-Host "[2/4] Extracting ZIP..." -ForegroundColor Yellow
    Expand-Archive -Path $ZipFile -DestinationPath $ExtractDir -Force

    $InnerDir = Get-ChildItem -Path $ExtractDir -Directory | Select-Object -First 1 -ExpandProperty FullName

    # Check if tetrasaim.otf exists (indicates existing install)
    $KeyFile = Get-ChildItem -Path $ExtFolder -Filter "tetrasaim.otf" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($null -eq $KeyFile) {
        # First install: create subfolder inside selected path
        $NewFolderName = Split-Path $InnerDir -Leaf
        $Destination = Join-Path $ExtFolder $NewFolderName
        Write-Host "[3/4] First install - creating: $Destination" -ForegroundColor Yellow
        Copy-Item -Path $InnerDir -Destination $Destination -Recurse
    } else {
        # Update: replace folder that contains tetrasaim.otf
        $Destination = Split-Path $KeyFile.FullName -Parent
        Write-Host "[3/4] Update - replacing: $Destination" -ForegroundColor Yellow
        Remove-Item -Path "$Destination\*" -Recurse -Force
        Copy-Item -Path "$InnerDir\*" -Destination $Destination -Recurse -Force
    }

    Write-Host "[4/4] Cleaning up..." -ForegroundColor Yellow
    Remove-Item -Path $TmpDir -Recurse -Force

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "  Extension updated successfully!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps in Chrome:" -ForegroundColor Cyan
    Write-Host "  1. Open chrome://extensions"
    Write-Host "  2. Enable Developer Mode"
    Write-Host "  3. Click 'Load unpacked'"
    Write-Host "  4. Select: $Destination"
    Write-Host ""

} catch {
    Write-Host "[Error] $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path $TmpDir) { Remove-Item -Path $TmpDir -Recurse -Force }
}

Read-Host "Press Enter to exit"