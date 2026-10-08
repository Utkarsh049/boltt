# Boltt — Desktop HTTP Client

Boltt is a local-first, native desktop HTTP client designed for speed, simplicity, and privacy. No cloud synchronization, no AI popups, no mandatory accounts — just a streamlined workspace to construct requests, manage environments, analyze responses, and export API collections offline.

Built with **Rust, Tauri v2, and React + TypeScript**, Boltt compiles to a self-contained, native platform binary under 10 MB with a sub-200ms cold start and an idle RAM footprint of ~30–50 MB.

---

## Installation

You can install Boltt using the **quick one-line terminal installer** (recommended) or by **downloading pre-built packages** from the [Latest Release](https://github.com/Utkarsh049/boltt/releases/latest).

### Option 1: Quick One-Line Install (Recommended)

#### macOS & Linux
```bash
curl -fsSL https://raw.githubusercontent.com/Utkarsh049/boltt/v1.1.1/scripts/install.sh | bash
```
* **macOS**: Downloads the Apple Silicon application bundle into `/Applications/Boltt.app` and automatically clears Gatekeeper quarantine flags.
* **Linux**: Installs the `.deb` package on Debian/Ubuntu, or deploys the standalone `.AppImage` to `~/.local/bin/boltt` with an application drawer shortcut.

#### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/Utkarsh049/boltt/v1.1.1/scripts/install.ps1 | iex
```
* Automatically downloads the latest 64-bit installer and runs the setup wizard.

---

### Option 2: Manual Package Download

Download the installer for your platform directly from [GitHub Releases](https://github.com/Utkarsh049/boltt/releases/latest):

| Operating System | Architecture | Recommended Installer | Alternative Package |
| :--- | :--- | :--- | :--- |
| **Windows** | x64 | [Setup Installer (.exe)](https://github.com/Utkarsh049/boltt/releases/latest) | [MSI Package (.msi)](https://github.com/Utkarsh049/boltt/releases/latest) |
| **macOS** | Apple Silicon (M-series) | [Disk Image (.dmg)](https://github.com/Utkarsh049/boltt/releases/latest) | [Application Archive (.tar.gz)](https://github.com/Utkarsh049/boltt/releases/latest) |
| **Linux** | x64 | [Debian Package (.deb)](https://github.com/Utkarsh049/boltt/releases/latest) | [AppImage](https://github.com/Utkarsh049/boltt/releases/latest), [RPM Package (.rpm)](https://github.com/Utkarsh049/boltt/releases/latest) |

#### Platform Guides for Manual Install:

* **macOS**:
  1. Open the downloaded `.dmg` and drag **Boltt** into `/Applications`.
  2. If macOS displays *"damaged and can't be opened"* or blocks unverified applications, run this command once in Terminal:
     ```bash
     xattr -cr /Applications/Boltt.app
     ```
     Alternatively, right-click `Boltt.app` in Finder, select **Open**, and confirm **Open**.

* **Linux**:
  * **Debian / Ubuntu**:
    ```bash
    sudo dpkg -i boltt_*_amd64.deb
    ```
  * **Standalone AppImage**:
    ```bash
    chmod +x boltt_*_amd64.AppImage
    ./boltt_*_amd64.AppImage
    ```

* **Windows**:
  1. Double-click the downloaded `boltt_*_x64-setup.exe` to run the installer.
  2. If Windows SmartScreen appears (*"Windows protected your PC"*), click **More info** and then **Run anyway**.

---

## Key Features

* **Local-First JSON Storage**: All projects, requests, environments, and history are stored locally as plain, human-readable JSON files. You can version-control, grep, and share files via Git.
* **Environments & Substitution**: Define variable sets (e.g., `local`, `staging`, `production`). Variables are substituted in URLs, parameters, headers, and request bodies using `{{variable}}` syntax in Rust before firing requests.
* **Folder-Level PDF Exports**: Right-click folders inside projects to generate clean, highly readable PDF documentations offline, complete with request details and environment variable legends.
* **Multi-Window State Sync**: Theme modifications, environment updates, and project adjustments synchronize instantly across main window layouts and secondary modals (like the Environment Manager).
* **Keyboard-First Flow**: Fully navigable via customizable shortcut keys (`Ctrl+Enter` to send, `Ctrl+S` to save, `Ctrl+T` for new tabs, etc.).
* **SSL Verification Toggle**: Explicit per-request SSL toggling for self-signed certificates or test endpoints.
* **Copy as cURL**: Generate and copy standard curl equivalents of completed requests to share with teammates.

---

## Technology Stack

| Layer | Technology | Reason / Benefit |
|---|---|---|
| **App Shell** | Tauri v2 (Rust) | Native OS webview wrapper, ultra-lightweight binaries, no Electron overhead |
| **HTTP Engine** | Reqwest (Rust) | Async HTTP/1.1 and HTTP/2 execution, correct redirect and header handling |
| **Async Runtime** | Tokio (Rust) | Multi-threaded async scheduler for background network tasks |
| **PDF Renderer** | Printpdf (Rust) | Fully offline, zero-network dependency PDF builder |
| **UI Framework** | React + Vite + TypeScript | Hot module replacement, type safety, modular workspace panes |
| **State Manager** | Zustand | Zero-boilerplate global reactive state and store management |
| **Code Editor** | CodeMirror 6 | Robust syntax highlighting, search/replace, and auto-bracket matching |

---

## Directory Structure

```
boltt/
├── scripts/
│   ├── install.sh           # One-line installer for macOS & Linux
│   ├── install.ps1          # One-line installer for Windows PowerShell
│   ├── setup.js             # Cross-platform runner & environment doctor
│   ├── setup-linux.sh       # Linux (Ubuntu/Debian, Fedora, Arch) setup script
│   ├── setup-macos.sh       # macOS (Xcode, Homebrew, Rust) setup script
│   └── setup-windows.ps1    # Windows (winget, Visual Studio C++) setup script
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Tauri bootstrap & window events
│   │   ├── lib.rs           # Linux launcher setup & setup hooks
│   │   ├── commands.rs      # IPC bridge definitions
│   │   ├── http_client.rs   # Reqwest request handler & variable substitutes
│   │   ├── projects.rs      # Project file filesystem commands
│   │   ├── environments.rs  # Environment variables I/O
│   │   ├── history.rs       # Request logs manager
│   │   └── pdf_export.rs    # Printpdf generator layout engine
│   └── Cargo.toml
├── src/
│   ├── components/
│   │   ├── Sidebar/         # Workspace tree, environments, and history
│   │   ├── TabBar/          # Active request tab manager
│   │   ├── UrlBar/          # URL inputs & request method configurations
│   │   ├── RequestPane/     # Query params, headers, body, and auth editors
│   │   ├── ResponsePane/    # JSON/text response viewer & headers
│   │   ├── Toast/           # Toast notification system
│   │   └── EnvironmentModal/# Window-drag compliant settings modal
│   ├── store/               # Zustand stores (request, environment, history, projects)
│   ├── App.tsx              # Main layout and resizable panels
│   └── App.css              # Custom theme variables and fonts
└── README.md
```

---

## Data & Settings Location

Boltt saves settings and project directories locally inside standard OS configuration paths:

* **Linux**: `~/.config/boltt/`
* **macOS**: `~/Library/Application Support/boltt/`
* **Windows**: `%APPDATA%\boltt\`

### Configuration Files
* `projects/` — Folders containing individual `{id}.json` project workspaces.
* `environments.json` — Key-value dictionary containing active environment variables.
* `history.json` — A ring-buffer persisting the last 100 HTTP requests.

---

## Getting Started & Development Setup

Boltt includes automated setup scripts that inspect your operating system, install missing system C-libraries, configure the Rust toolchain, and set up project dependencies automatically.

### Automated Setup (Recommended)

If you already have Node.js and pnpm installed:
```bash
git clone https://github.com/Utkarsh049/boltt.git
cd boltt
pnpm setup:dev
```

### Fresh OS Setup (Zero Prior Dependencies)

If you are setting up a fresh machine and haven't installed Node or Rust yet, run the native setup script for your platform:

#### Linux (Ubuntu / Debian / Fedora / Arch)
```bash
bash scripts/setup-linux.sh
```
*Installs WebKit2GTK 4.1, GTK 3, build tools, Rustup, Node.js, and pnpm.*

#### macOS
```bash
bash scripts/setup-macos.sh
```
*Verifies Xcode Command Line Tools, Rustup, Node.js, and pnpm (installing Rust and pnpm when missing).*

#### Windows (PowerShell)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```
*Uses `winget` to configure Visual Studio C++ Build Tools, Rustup, Node.js, and pnpm.*

---

### Environment Healthcheck

At any time, you can verify your environment's readiness with the built-in diagnostic doctor:
```bash
pnpm check:env
# or
pnpm run doctor
```

---

## Build & Run Commands

### 1. Run development build (with hot reload)
```bash
pnpm tauri dev
```

### 2. Build production platform bundle
```bash
pnpm tauri build
```
Compiled production packages and executables will be generated inside `src-tauri/target/release/bundle/`.

---

## Keyboard Shortcuts

| Action | macOS | Windows / Linux |
|---|---|---|
| **Send Request** | `Cmd + Enter` | `Ctrl + Enter` |
| **Save Request** | `Cmd + S` | `Ctrl + S` |
| **New Request Tab** | `Cmd + T` | `Ctrl + T` |
| **Close Active Tab** | `Cmd + W` | `Ctrl + W` |
| **Focus URL Input** | `Cmd + L` | `Ctrl + L` |
| **Toggle Sidebar** | `Cmd + B` | `Ctrl + B` |
| **Sync Filesystem** | `Cmd + R` | `Ctrl + R` |

---

## Contributing

We welcome contributions from developers across Linux, macOS, and Windows. Please refer to our [Contributing Guide](CONTRIBUTING.md) for detailed onboarding and development instructions.
