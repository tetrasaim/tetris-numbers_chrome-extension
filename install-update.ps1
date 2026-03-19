# Chrome Extension Updater - Tetris Numbers
# Downloads the latest version from GitHub and replaces your local extension folder

$ZipUrl = "https://github.com/tetrasaim/tetris-numbers_chrome-extension/archive/refs/heads/main.zip"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Chrome Extension Updater - Tetris Numbers" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Open folder picker dialog
Write-Host "Opening folder picker..." -ForegroundColor Yellow
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select your Chrome extension folder"
$dialog.ShowNewFolderButton = $false

if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    Write-Host "No folder selected. Exiting." -ForegroundColor Red
    exit 1
}

$ExtFolder = $dialog.SelectedPath
Write-Host "Selected: $ExtFolder" -ForegroundColor Green
Write-Host ""

# Temp directory
$TmpDir = Join-Path $env:TEMP ("ext_update_" + [System.IO.Path]::GetRandomFileName())
$ZipFile = Join-Path $TmpDir "extension.zip"
$ExtractDir = Join-Path $TmpDir "extracted"
New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null

try {
    # Download
    Write-Host "[1/4] Downloading ZIP from GitHub..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipFile -UseBasicParsing

    # Extract
    Write-Host "[2/4] Extracting ZIP..." -ForegroundColor Yellow
    Expand-Archive -Path $ZipFile -DestinationPath $ExtractDir -Force

    # GitHub adds a root folder inside the zip - find it
    $InnerDir = Get-ChildItem -Path $ExtractDir -Directory | Select-Object -First 1 -ExpandProperty FullName

    # Replace
    Write-Host "[3/4] Replacing extension folder..." -ForegroundColor Yellow
    Remove-Item -Path $ExtFolder -Recurse -Force
    Copy-Item -Path $InnerDir -Destination $ExtFolder -Recurse

    # Cleanup
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
    Write-Host "  4. Select: $ExtFolder"
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "[Error] $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path $TmpDir) { Remove-Item -Path $TmpDir -Recurse -Force }
    exit 1
}

Read-Host "Press Enter to exit"