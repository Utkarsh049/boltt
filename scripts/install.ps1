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
    try {
        $req = [System.Net.WebRequest]::Create("https://github.com/$repo/releases/latest")
        $req.AllowAutoRedirect = $false
        $resp = $req.GetResponse()
        $location = $resp.GetResponseHeader("Location")
        $resp.Close()
        if ($location -match "/tag/v?([^/]+)$") {
            $tag = $matches[1]
            $downloadUrl = "https://github.com/$repo/releases/download/v$tag/boltt_${tag}_x64-setup.exe"
        }
    } catch {
        # Fallback to scraping releases page for x64 setup executable
        try {
            $html = (Invoke-WebRequest -Uri "https://github.com/$repo/releases/latest" -UseBasicParsing).Content
            if ($html -match 'href="([^"]+boltt_[^"]+_x64-setup\.exe)"') {
                $downloadUrl = "https://github.com" + $matches[1]
            }
        } catch {
            Write-Host "✖ Could not determine latest release download URL." -ForegroundColor Red
            exit 1
        }
    }
}

if (-not $downloadUrl) {
    Write-Host "✖ Could not locate Windows installer for latest release." -ForegroundColor Red
    exit 1
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
$exitCode = 0
try {
    $proc = Start-Process -FilePath $tempInstaller -Wait -PassThru
    $exitCode = $proc.ExitCode
} finally {
    if (Test-Path $tempInstaller) {
        Remove-Item $tempInstaller -Force -ErrorAction SilentlyContinue
    }
}

if ($exitCode -ne 0) {
    Write-Host "✖ Boltt installation did not complete successfully (Exit code: $exitCode)." -ForegroundColor Red
    exit $exitCode
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "             Boltt Installation Complete!               " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "You can launch Boltt from the Start Menu or desktop shortcut."
Write-Host ""
