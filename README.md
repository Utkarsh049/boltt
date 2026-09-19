# Boltt — Desktop HTTP Client (v1.0.0)

Boltt is a local-first, native desktop HTTP client designed for speed, simplicity, and privacy. No cloud synchronization, no AI popups, no mandatory accounts — just a streamlined workspace to construct requests, manage environments, analyze responses, and export API collections offline.

Built with **Rust, Tauri v2, and React + TypeScript**, Boltt compiles to a self-contained, native platform binary under 10 MB with a sub-200ms cold start and an idle RAM footprint of ~30–50 MB.

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
*Configures Xcode Command Line Tools, Rustup, Node.js, and pnpm.*

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
