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
    Write-Host "Usage: .\scripts\setup-windows.ps1 [-CheckOnly] [-DryRun] [-Help]"
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

$failedPrereqs = @()

# Helper to check if a command exists in PATH
function Test-CommandAvailable {
    param([string]$Cmd)
    return [bool](Get-Command $Cmd -ErrorAction SilentlyContinue)
}

# Helper to refresh environment PATH from registry
function Update-EnvironmentPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

# 1. Check Package Manager (winget)
Write-Host "Checking Windows Package Manager (winget)..." -ForegroundColor Yellow
$hasWinget = Test-CommandAvailable "winget"
if ($hasWinget) {
    Write-Host "✔ winget is available." -ForegroundColor Green
} else {
    Write-Host "✖ winget not found. Please install 'App Installer' from Microsoft Store." -ForegroundColor Red
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
            if ($DryRun) {
                Write-Host "[DRY RUN] winget install --id Microsoft.VisualStudio.2022.BuildTools --override `"--passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended`"" -ForegroundColor Yellow
            } else {
                Write-Host "Installing Visual Studio 2022 Build Tools..." -ForegroundColor Cyan
                & winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "✖ winget installation of Build Tools failed or was canceled (Exit code: $LASTEXITCODE)." -ForegroundColor Red
                    $failedPrereqs += "Microsoft C++ Build Tools"
                } else {
                    Write-Host "✔ C++ Build Tools installed." -ForegroundColor Green
                }
            }
        } else {
            $failedPrereqs += "Microsoft C++ Build Tools"
        }
    } else {
        Write-Host "Download manually from: https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor DarkGray
        $failedPrereqs += "Microsoft C++ Build Tools"
    }
}

# 3. Check Microsoft Edge WebView2
Write-Host ""
Write-Host "Checking Microsoft Edge WebView2 Runtime..." -ForegroundColor Yellow
$webview2Key64 = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
$webview2Key32 = "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
$hasWebView2 = (Test-Path $webview2Key64) -or (Test-Path $webview2Key32)

if ($hasWebView2) {
    Write-Host "✔ WebView2 Runtime is installed." -ForegroundColor Green
} else {
    Write-Host "✖ WebView2 Runtime not detected." -ForegroundColor Yellow
    if (-not $CheckOnly -and $hasWinget) {
        $confirm = Read-Host "Install WebView2 Runtime via winget? [Y/n]"
        if ($confirm -eq "" -or $confirm -match "^[Yy]") {
            if ($DryRun) {
                Write-Host "[DRY RUN] winget install Microsoft.EdgeWebView2Runtime" -ForegroundColor Yellow
            } else {
                & winget install Microsoft.EdgeWebView2Runtime
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "✖ winget installation of WebView2 failed (Exit code: $LASTEXITCODE)." -ForegroundColor Red
                    $failedPrereqs += "Microsoft Edge WebView2 Runtime"
                } else {
                    Write-Host "✔ WebView2 Runtime installed." -ForegroundColor Green
                }
            }
        } else {
            $failedPrereqs += "Microsoft Edge WebView2 Runtime"
        }
    } else {
        $failedPrereqs += "Microsoft Edge WebView2 Runtime"
    }
}

# 4. Check Rust Toolchain (rustc AND cargo)
Write-Host ""
Write-Host "Checking Rust Toolchain..." -ForegroundColor Yellow
Update-EnvironmentPath
if ((Test-CommandAvailable "rustc") -and (Test-CommandAvailable "cargo")) {
    $rustVer = (& rustc --version)
    Write-Host "✔ Rust is installed: $rustVer" -ForegroundColor Green
} else {
    Write-Host "✖ Rust toolchain (rustc/cargo) not detected." -ForegroundColor Yellow
    if (-not $CheckOnly -and $hasWinget) {
        $confirm = Read-Host "Install Rustup via winget? [Y/n]"
        if ($confirm -eq "" -or $confirm -match "^[Yy]") {
            if ($DryRun) {
                Write-Host "[DRY RUN] winget install Rustlang.Rustup" -ForegroundColor Yellow
            } else {
                & winget install Rustlang.Rustup
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "✖ winget installation of Rustup failed (Exit code: $LASTEXITCODE)." -ForegroundColor Red
                    $failedPrereqs += "Rust Toolchain (rustc + cargo)"
                } else {
                    Update-EnvironmentPath
                    Write-Host "✔ Rustup installed. Note: You may need to restart PowerShell for PATH changes to take effect." -ForegroundColor Green
                }
            }
        } else {
            $failedPrereqs += "Rust Toolchain (rustc + cargo)"
        }
    } else {
        Write-Host "Download manually from: https://rustup.rs" -ForegroundColor DarkGray
        $failedPrereqs += "Rust Toolchain (rustc + cargo)"
    }
}

# 5. Check Node.js and pnpm
Write-Host ""
Write-Host "Checking Node.js & pnpm..." -ForegroundColor Yellow
Update-EnvironmentPath
$nodeOk = $false
if (Test-CommandAvailable "node") {
    $nodeVer = (& node -v)
    Write-Host "✔ Node.js is installed: $nodeVer" -ForegroundColor Green
    $nodeOk = $true
} else {
    Write-Host "✖ Node.js not detected." -ForegroundColor Red
    if (-not $CheckOnly -and $hasWinget) {
        $confirm = Read-Host "Install Node.js LTS via winget? [Y/n]"
        if ($confirm -eq "" -or $confirm -match "^[Yy]") {
            if ($DryRun) {
                Write-Host "[DRY RUN] winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
            } else {
                & winget install OpenJS.NodeJS.LTS
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "✖ winget installation of Node.js failed (Exit code: $LASTEXITCODE)." -ForegroundColor Red
                    $failedPrereqs += "Node.js (v20.19+ or v22.12+)"
                } else {
                    Update-EnvironmentPath
                    $nodeOk = Test-CommandAvailable "node"
                    Write-Host "✔ Node.js installed." -ForegroundColor Green
                }
            }
        } else {
            $failedPrereqs += "Node.js (v20.19+ or v22.12+)"
        }
    } else {
        $failedPrereqs += "Node.js (v20.19+ or v22.12+)"
    }
}

if (Test-CommandAvailable "pnpm") {
    $pnpmVer = (& pnpm -v)
    Write-Host "✔ pnpm is installed: v$pnpmVer" -ForegroundColor Green
} else {
    Write-Host "✖ pnpm not detected." -ForegroundColor Yellow
    if (-not $CheckOnly) {
        Update-EnvironmentPath
        if (Test-CommandAvailable "npm") {
            $confirm = Read-Host "Install pnpm globally via npm? [Y/n]"
            if ($confirm -eq "" -or $confirm -match "^[Yy]") {
                if ($DryRun) {
                    Write-Host "[DRY RUN] npm install -g pnpm" -ForegroundColor Yellow
                } else {
                    & npm install -g pnpm
                    if ($LASTEXITCODE -ne 0) {
                        Write-Host "✖ npm install -g pnpm failed (Exit code: $LASTEXITCODE)." -ForegroundColor Red
                        $failedPrereqs += "pnpm"
                    } else {
                        Update-EnvironmentPath
                        Write-Host "✔ pnpm installed successfully." -ForegroundColor Green
                    }
                }
            } else {
                $failedPrereqs += "pnpm"
            }
        } else {
            Write-Host "✖ npm is not available in PATH to install pnpm. Please restart PowerShell after installing Node.js." -ForegroundColor Red
            $failedPrereqs += "pnpm"
        }
    } else {
        $failedPrereqs += "pnpm"
    }
}

# 6. Install Project Dependencies
if (-not $CheckOnly -and (Test-CommandAvailable "pnpm") -and ($failedPrereqs.Count -eq 0)) {
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
            if ($LASTEXITCODE -ne 0) {
                Write-Host "✖ pnpm install failed with exit code $LASTEXITCODE." -ForegroundColor Red
                $failedPrereqs += "Project Dependencies (pnpm install)"
            } else {
                Write-Host "✔ Project dependencies installed." -ForegroundColor Green
            }
        }
    } finally {
        Pop-Location
    }
}

# 7. Final Status Evaluation
if ($failedPrereqs.Count -gt 0) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host "             Windows Setup Incomplete                   " -ForegroundColor Red
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host "The following prerequisites were missing or failed installation:" -ForegroundColor Red
    foreach ($item in $failedPrereqs) {
        Write-Host "  ✖ $item" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Please resolve the above issues and re-run: .\scripts\setup-windows.ps1" -ForegroundColor Yellow
    exit 1
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
