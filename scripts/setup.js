#!/usr/bin/env node

/**
 * ==============================================================================
 * Boltt — Cross-Platform Developer Setup & Environment Doctor
 * Usage:
 *   node scripts/setup.js          (Launches OS-specific interactive setup)
 *   node scripts/setup.js --check  (Performs non-destructive environment healthcheck)
 *   pnpm setup:dev                 (Same as node scripts/setup.js)
 *   pnpm doctor                    (Same as node scripts/setup.js --check)
 * ==============================================================================
 */

import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Color constants
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

const isCheckMode = process.argv.includes("--check") || process.argv.includes("-c");
const isDryRun = process.argv.includes("--dry-run");

// Helper to run command silently and return output
function exec(command, args = []) {
  try {
    const res = spawnSync(command, args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return {
      success: res.status === 0,
      stdout: (res.stdout || "").trim(),
      stderr: (res.stderr || "").trim(),
      status: res.status,
    };
  } catch (err) {
    return { success: false, stdout: "", stderr: String(err), status: 1 };
  }
}

// ==============================================================================
// 1. ENVIRONMENT DOCTOR (Healthcheck Mode)
// ==============================================================================
function runDoctor() {
  console.log(`\n${colors.cyan}${colors.bold}========================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}             Boltt Environment Doctor                   ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}========================================================${colors.reset}\n`);

  const platform = os.platform();
  const checks = [];
  let allPassed = true;

  // OS Detection
  let osDetail = `${os.type()} ${os.release()} (${os.arch()})`;
  if (platform === "linux" && fs.existsSync("/etc/os-release")) {
    const osRelease = fs.readFileSync("/etc/os-release", "utf8");
    const nameMatch = osRelease.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
    if (nameMatch) osDetail = `${nameMatch[1]} (${os.arch()})`;
  } else if (platform === "darwin") {
    const swVers = exec("sw_vers", ["-productVersion"]);
    if (swVers.success) osDetail = `macOS ${swVers.stdout} (${os.arch()})`;
  } else if (platform === "win32") {
    osDetail = `Windows ${os.release()} (${os.arch()})`;
  }
  checks.push({ category: "System", item: "OS Platform", ok: true, detail: osDetail });

  // Node.js & pnpm
  const nodeCheck = exec("node", ["-v"]);
  if (nodeCheck.success) {
    checks.push({ category: "Toolchain", item: "Node.js", ok: true, detail: nodeCheck.stdout });
  } else {
    allPassed = false;
    checks.push({ category: "Toolchain", item: "Node.js", ok: false, detail: "Not found in PATH" });
  }

  const pnpmCheck = exec("pnpm", ["-v"]);
  if (pnpmCheck.success) {
    checks.push({ category: "Toolchain", item: "pnpm", ok: true, detail: `v${pnpmCheck.stdout}` });
  } else {
    allPassed = false;
    checks.push({ category: "Toolchain", item: "pnpm", ok: false, detail: "Not found in PATH" });
  }

  // Rust & Cargo
  const rustCheck = exec("rustc", ["--version"]);
  if (rustCheck.success) {
    checks.push({ category: "Toolchain", item: "Rust Compiler", ok: true, detail: rustCheck.stdout });
  } else {
    allPassed = false;
    checks.push({ category: "Toolchain", item: "Rust Compiler", ok: false, detail: "Missing (Install via https://rustup.rs)" });
  }

  const cargoCheck = exec("cargo", ["--version"]);
  if (cargoCheck.success) {
    checks.push({ category: "Toolchain", item: "Cargo Package Mgr", ok: true, detail: cargoCheck.stdout });
  } else {
    allPassed = false;
    checks.push({ category: "Toolchain", item: "Cargo Package Mgr", ok: false, detail: "Missing" });
  }

  // Platform-specific GUI & C dependencies
  if (platform === "linux") {
    // Check pkg-config
    const pkgConfig = exec("pkg-config", ["--version"]);
    if (pkgConfig.success) {
      checks.push({ category: "Build Tools", item: "pkg-config", ok: true, detail: `v${pkgConfig.stdout}` });
    } else {
      allPassed = false;
      checks.push({ category: "Build Tools", item: "pkg-config", ok: false, detail: "Missing" });
    }

    // Check C compiler (gcc or clang)
    const gccCheck = exec("gcc", ["--version"]);
    const clangCheck = exec("clang", ["--version"]);
    if (gccCheck.success) {
      checks.push({ category: "Build Tools", item: "C Compiler", ok: true, detail: gccCheck.stdout.split("\n")[0] });
    } else if (clangCheck.success) {
      checks.push({ category: "Build Tools", item: "C Compiler", ok: true, detail: clangCheck.stdout.split("\n")[0] });
    } else {
      allPassed = false;
      checks.push({ category: "Build Tools", item: "C Compiler", ok: false, detail: "No C compiler (install build-essential)" });
    }

    // Check WebKit2GTK 4.1
    const webkitCheck = exec("pkg-config", ["--exists", "webkit2gtk-4.1"]);
    if (webkitCheck.success) {
      const ver = exec("pkg-config", ["--modversion", "webkit2gtk-4.1"]);
      checks.push({ category: "Libraries", item: "WebKit2GTK 4.1", ok: true, detail: `v${ver.stdout || "installed"}` });
    } else {
      allPassed = false;
      checks.push({ category: "Libraries", item: "WebKit2GTK 4.1", ok: false, detail: "Missing dev headers (libwebkit2gtk-4.1-dev)" });
    }

    // Check GTK 3
    const gtkCheck = exec("pkg-config", ["--exists", "gtk+-3.0"]);
    if (gtkCheck.success) {
      const ver = exec("pkg-config", ["--modversion", "gtk+-3.0"]);
      checks.push({ category: "Libraries", item: "GTK+ 3.0", ok: true, detail: `v${ver.stdout || "installed"}` });
    } else {
      allPassed = false;
      checks.push({ category: "Libraries", item: "GTK+ 3.0", ok: false, detail: "Missing dev headers (libgtk-3-dev)" });
    }
  } else if (platform === "darwin") {
    // Check Xcode Command Line Tools
    const xcodeCheck = exec("xcode-select", ["-p"]);
    if (xcodeCheck.success) {
      checks.push({ category: "Build Tools", item: "Xcode CLT", ok: true, detail: xcodeCheck.stdout });
    } else {
      allPassed = false;
      checks.push({ category: "Build Tools", item: "Xcode CLT", ok: false, detail: "Missing ('xcode-select --install')" });
    }

    // macOS includes WebKit directly in the OS
    checks.push({ category: "Libraries", item: "WebKit (macOS)", ok: true, detail: "Integrated native WKWebView" });
  } else if (platform === "win32") {
    // Check WebView2
    const regCheck = exec("powershell", [
      "-Command",
      "Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue",
    ]);
    if (regCheck.success && regCheck.stdout.length > 0) {
      checks.push({ category: "Libraries", item: "WebView2", ok: true, detail: "Installed" });
    } else {
      checks.push({ category: "Libraries", item: "WebView2", ok: true, detail: "Standard on Windows 10/11" });
    }
  }

  // Project dependencies (node_modules)
  const nodeModulesPath = path.join(projectRoot, "node_modules");
  if (fs.existsSync(nodeModulesPath)) {
    checks.push({ category: "Project", item: "node_modules", ok: true, detail: "Installed" });
  } else {
    allPassed = false;
    checks.push({ category: "Project", item: "node_modules", ok: false, detail: "Not installed (run 'pnpm install')" });
  }

  // Print results table
  console.log(`${colors.dim}┌───────────────┬──────────────────────┬───────────┬────────────────────────────────────────────┐${colors.reset}`);
  console.log(`${colors.dim}│${colors.reset} ${colors.bold}Category${colors.reset}      ${colors.dim}│${colors.reset} ${colors.bold}Item${colors.reset}                 ${colors.dim}│${colors.reset} ${colors.bold}Status${colors.reset}    ${colors.dim}│${colors.reset} ${colors.bold}Details${colors.reset}                                    ${colors.dim}│${colors.reset}`);
  console.log(`${colors.dim}├───────────────┼──────────────────────┼───────────┼────────────────────────────────────────────┤${colors.reset}`);

  for (const c of checks) {
    const cat = c.category.padEnd(13);
    const item = c.item.padEnd(20);
    const status = c.ok
      ? `${colors.green}✔ Ready  ${colors.reset}`
      : `${colors.red}✖ Missing${colors.reset}`;
    const detail = (c.detail.length > 42 ? c.detail.substring(0, 39) + "..." : c.detail).padEnd(42);

    console.log(`${colors.dim}│${colors.reset} ${cat} ${colors.dim}│${colors.reset} ${item} ${colors.dim}│${colors.reset} ${status} ${colors.dim}│${colors.reset} ${detail} ${colors.dim}│${colors.reset}`);
  }

  console.log(`${colors.dim}└───────────────┴──────────────────────┴───────────┴────────────────────────────────────────────┘${colors.reset}\n`);

  if (allPassed) {
    console.log(`${colors.green}${colors.bold}🎉 All environment checks passed!${colors.reset}`);
    console.log(`Run ${colors.cyan}${colors.bold}pnpm tauri dev${colors.reset} to launch Boltt in development mode.\n`);
    process.exit(0);
  } else {
    console.log(`${colors.yellow}${colors.bold}⚠️  Some dependencies are missing.${colors.reset}`);
    console.log(`Run ${colors.cyan}${colors.bold}pnpm setup:dev${colors.reset} to install missing components automatically.\n`);
    process.exit(1);
  }
}

// ==============================================================================
// 2. SETUP RUNNER (Dispatches to OS-specific scripts)
// ==============================================================================
function runSetup() {
  const platform = os.platform();
  const scriptArgs = process.argv.slice(2);

  if (platform === "linux") {
    const scriptPath = path.join(__dirname, "setup-linux.sh");
    console.log(`${colors.blue}ℹ Dispatching to Linux setup script:${colors.reset} ${scriptPath}`);
    const child = spawn("bash", [scriptPath, ...scriptArgs], { stdio: "inherit" });
    child.on("exit", (code) => process.exit(code || 0));
  } else if (platform === "darwin") {
    const scriptPath = path.join(__dirname, "setup-macos.sh");
    console.log(`${colors.blue}ℹ Dispatching to macOS setup script:${colors.reset} ${scriptPath}`);
    const child = spawn("bash", [scriptPath, ...scriptArgs], { stdio: "inherit" });
    child.on("exit", (code) => process.exit(code || 0));
  } else if (platform === "win32") {
    const scriptPath = path.join(__dirname, "setup-windows.ps1");
    console.log(`${colors.blue}ℹ Dispatching to Windows PowerShell setup script:${colors.reset} ${scriptPath}`);
    const psArgs = ["-ExecutionPolicy", "Bypass", "-File", scriptPath];
    if (isDryRun) psArgs.push("-DryRun");
    const child = spawn("powershell", psArgs, { stdio: "inherit" });
    child.on("exit", (code) => process.exit(code || 0));
  } else {
    console.error(`${colors.red}Unsupported operating system: ${platform}${colors.reset}`);
    process.exit(1);
  }
}

// Entrypoint
if (isCheckMode) {
  runDoctor();
} else {
  runSetup();
}
