# ==============================================================================
# Boltt — Windows Development Environment Setup (PowerShell)
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$DryRun,
    [switch]$Help
)

if ($Help) {
    Write-Host "Boltt Windows Setup Script" -ForegroundColor Cyan
    Write-Host "Usage: .\scripts\setup-windows.ps1 [-CheckOnly] [-DryRun]"
    Write-Host ""
    Write-Host "Parameters:"
    Write-Host "  -CheckOnly   Inspect missing prerequisites without installing"
    Write-Host "  -DryRun      Display the commands that would be run"
    Write-Host "  -Help        Display this help message"
    exit 0
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "          Boltt — Windows Development Setup             " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Helper to check if a command exists in PATH
function Test-CommandAvailable {
    param([string]$Cmd)
    return [bool](Get-Command $Cmd -ErrorAction SilentlyContinue)
}

# 1. Check Package Manager (winget)
Write-Host "Checking Windows Package Manager (winget)..." -ForegroundColor Yellow
$hasWinget = Test-CommandAvailable "winget"
if ($hasWinget) {
    Write-Host "✔ winget is available." -ForegroundColor Green
} else {
    Write-Host "✖ winget not found. Please install the 'App Installer' from the Microsoft Store or use Chocolatey." -ForegroundColor Red
}

# 2. Check Microsoft C++ Build Tools
Write-Host ""
Write-Host "Checking Microsoft C++ Build Tools..." -ForegroundColor Yellow
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasVC = $false

if (Test-Path $vswhere) {
    $vcInstallation = & $vswhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vcInstallation) {
        $hasVC = $true
        Write-Host "✔ C++ Build Tools found at: $vcInstallation" -ForegroundColor Green
    }
}

if (-not $hasVC) {
    Write-Host "✖ Microsoft C++ Build Tools not detected." -ForegroundColor Yellow
    if (-not $CheckOnly -and $hasWinget) {
        $confirm = Read-Host "Install Visual Studio 2022 Build Tools (with C++ workload)? [Y/n]"
        if ($confirm -eq "" -or $confirm -match "^[Yy]") {
            $cmd = "winget install --id Microsoft.VisualStudio.2022.BuildTools --override `"--passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended`""
            if ($DryRun) {
                Write-Host "[DRY RUN] $cmd" -ForegroundColor Yellow
            } else {
                Write-Host "Running: $cmd" -ForegroundColor Cyan
                Invoke-Expression $cmd
            }
        }
    } else {
        Write-Host "Download manually from: https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor DarkGray
    }
}

# 3. Check Microsoft Edge WebView2
Write-Host ""
Write-Host "Checking Microsoft Edge WebView2 Runtime..." -ForegroundColor Yellow
$webview2Key64 = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
$webview2Key32 = "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
$hasWebView2 = (Test-Path $webview2Key64) -or (Test-Path $webview2Key32)

if ($hasWebView2) {
    Write-Host "✔ WebView2 Runtime is installed (standard on Windows 10/11)." -ForegroundColor Green
} else {
    Write-Host "✖ WebView2 Runtime not detected." -ForegroundColor Yellow
    if (-not $CheckOnly -and $hasWinget) {
        $confirm = Read-Host "Install WebView2 Runtime via winget? [Y/n]"
        if ($confirm -eq "" -or $confirm -match "^[Yy]") {
            $cmd = "winget install Microsoft.EdgeWebView2Runtime"
            if ($DryRun) {
                Write-Host "[DRY RUN] $cmd" -ForegroundColor Yellow
            } else {
                Invoke-Expression $cmd
            }
        }
    }
}

# 4. Check Rust Toolchain
Write-Host ""
Write-Host "Checking Rust Toolchain..." -ForegroundColor Yellow
if (Test-CommandAvailable "rustc") {
    $rustVer = (& rustc --version)
    Write-Host "✔ Rust is installed: $rustVer" -ForegroundColor Green
} else {
    Write-Host "✖ Rust not detected." -ForegroundColor Yellow
    if (-not $CheckOnly -and $hasWinget) {
        $confirm = Read-Host "Install Rustup via winget? [Y/n]"
        if ($confirm -eq "" -or $confirm -match "^[Yy]") {
            $cmd = "winget install Rustlang.Rustup"
            if ($DryRun) {
                Write-Host "[DRY RUN] $cmd" -ForegroundColor Yellow
            } else {
                Invoke-Expression $cmd
                Write-Host "✔ Rustup installed. You may need to restart PowerShell for PATH changes to take effect." -ForegroundColor Green
            }
        }
    } else {
        Write-Host "Download manually from: https://rustup.rs" -ForegroundColor DarkGray
    }
}

# 5. Check Node.js and pnpm
Write-Host ""
Write-Host "Checking Node.js & pnpm..." -ForegroundColor Yellow
if (Test-CommandAvailable "node") {
    $nodeVer = (& node -v)
    Write-Host "✔ Node.js is installed: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "✖ Node.js not detected." -ForegroundColor Red
    if (-not $CheckOnly -and $hasWinget) {
        $confirm = Read-Host "Install Node.js LTS via winget? [Y/n]"
        if ($confirm -eq "" -or $confirm -match "^[Yy]") {
            $cmd = "winget install OpenJS.NodeJS.LTS"
            if ($DryRun) {
                Write-Host "[DRY RUN] $cmd" -ForegroundColor Yellow
            } else {
                Invoke-Expression $cmd
            }
        }
    }
}

if (Test-CommandAvailable "pnpm") {
    $pnpmVer = (& pnpm -v)
    Write-Host "✔ pnpm is installed: v$pnpmVer" -ForegroundColor Green
} else {
    Write-Host "✖ pnpm not detected." -ForegroundColor Yellow
    if (-not $CheckOnly) {
        $confirm = Read-Host "Install pnpm globally? [Y/n]"
        if ($confirm -eq "" -or $confirm -match "^[Yy]") {
            if ($DryRun) {
                Write-Host "[DRY RUN] npm install -g pnpm" -ForegroundColor Yellow
            } else {
                npm install -g pnpm
            }
        }
    }
}

# 6. Install Project Dependencies
if (-not $CheckOnly -and (Test-CommandAvailable "pnpm")) {
    Write-Host ""
    Write-Host "Installing Project Dependencies..." -ForegroundColor Yellow
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $projectRoot = Split-Path -Parent $scriptDir
    Push-Location $projectRoot
    try {
        if ($DryRun) {
            Write-Host "[DRY RUN] pnpm install" -ForegroundColor Yellow
        } else {
            & pnpm install
            Write-Host "✔ Project dependencies installed." -ForegroundColor Green
        }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "             Windows Setup Complete!                    " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run:"
Write-Host "  pnpm tauri dev   - Start Boltt desktop app in development mode" -ForegroundColor Cyan
Write-Host "  pnpm doctor      - Verify your environment at any time" -ForegroundColor Cyan
Write-Host ""
