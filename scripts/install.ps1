# Boltt Windows Installer
$ErrorActionPreference = "Stop"

$repo = "Utkarsh049/boltt"
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "                 Boltt Windows Installer               " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Fetching latest release information..." -ForegroundColor Yellow
$apiUrl = "https://api.github.com/repos/$repo/releases/latest"
$downloadUrl = $null

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $release = Invoke-RestMethod -Uri $apiUrl -Headers @{ "User-Agent" = "Boltt-Installer" }
    $asset = $release.assets | Where-Object { $_.name -like "*x64-setup.exe" } | Select-Object -First 1
    if ($asset) {
        $downloadUrl = $asset.browser_download_url
        Write-Host "Found release: $($release.tag_name) ($($asset.name))" -ForegroundColor Green
    }
} catch {
    Write-Host "Could not query GitHub API directly (rate limit or network issue). Trying direct release URL..." -ForegroundColor Yellow
}

if (-not $downloadUrl) {
    $downloadUrl = "https://github.com/$repo/releases/latest/download/boltt_1.1.0_x64-setup.exe"
}

$tempInstaller = Join-Path $env:TEMP "boltt-setup.exe"

Write-Host "Downloading Boltt from: $downloadUrl" -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempInstaller -UseBasicParsing
} catch {
    Write-Host "✖ Download failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Launching Boltt setup installer..." -ForegroundColor Green
try {
    Start-Process -FilePath $tempInstaller -Wait
} finally {
    if (Test-Path $tempInstaller) {
        Remove-Item $tempInstaller -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "             Boltt Installation Complete!               " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "You can launch Boltt from the Start Menu or desktop shortcut."
Write-Host ""
