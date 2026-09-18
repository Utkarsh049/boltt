# Contributing to Boltt

Thank you for your interest in contributing to **Boltt**! We welcome bug reports, feature proposals, and pull requests from developers across Linux, macOS, and Windows.

---

## 1. Setting Up Your Development Environment

Boltt is built with **Tauri v2, Rust, and React 19 + TypeScript**.

### Automated One-Command Setup (Recommended)

If you already have Node.js (v18+) and pnpm installed:

```bash
git clone https://github.com/your-username/boltt.git
cd boltt
pnpm setup:dev
```

This will automatically inspect your operating system and install any missing platform C-libraries (WebKit2GTK/GTK on Linux), verify the Rust toolchain, and install project dependencies.

---

### Fresh Machine Setup (Zero Prior Tools)

If you haven't installed Rust or Node.js yet, run the setup script for your platform:

#### Linux (Ubuntu / Debian / Fedora / Arch)
```bash
bash scripts/setup-linux.sh
```
*Installs WebKit2GTK 4.1, GTK 3, build tools, Rustup, Node.js, and pnpm.*

#### macOS
```bash
bash scripts/setup-macos.sh
```
*Verifies Xcode Command Line Tools, Rustup, Node.js, and pnpm (WebKit is built natively into macOS).*

#### Windows (PowerShell)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```
*Uses `winget` to configure Visual Studio C++ Build Tools, WebView2, Rustup, Node.js, and pnpm.*

---

## 2. Environment Healthcheck

Before launching the app, verify that all toolchains and libraries are recognized:

```bash
pnpm check:env
# or
pnpm run doctor
```

You should see all checks marked with `✔ Ready`.

---

## 3. Local Development Workflow

### Start Development Mode
To start the Vite frontend with Hot Module Replacement (HMR) and compile the Rust desktop backend:

```bash
pnpm tauri dev
```

Any changes you make to files in `src/` will hot-reload instantly. Changes made to `src-tauri/` will trigger an incremental Rust recompilation.

### Verify Code Correctness

Before committing changes:

1. **Frontend TypeScript & Build Verification:**
   ```bash
   pnpm build
   ```

2. **Backend Rust Verification:**
   ```bash
   cargo check --manifest-path src-tauri/Cargo.toml
   ```

3. **Format Rust Code:**
   ```bash
   cargo fmt --manifest-path src-tauri/Cargo.toml
   ```

---

## 4. Architecture Overview

- **Frontend (`src/`)**:
  - `src/components/`: Modular UI panes (UrlBar, TabBar, RequestPane, ResponsePane, Sidebar).
  - `src/store/`: Zustand global stores (`requestStore.ts`, `projectsStore.ts`, `envStore.ts`, `historyStore.ts`, `toastStore.ts`).
  - `src/App.tsx`: Custom frameless window shell, global keyboard shortcuts, and panel layouts (`react-resizable-panels`).
  - `src/App.css`: Theming system and typography.

- **Backend (`src-tauri/src/`)**:
  - `main.rs` & `lib.rs`: Tauri initialization and native desktop entry handling.
  - `commands.rs`: Tauri IPC commands accessible from the React frontend via `invoke()`.
  - `http_client.rs`: Asynchronous HTTP executor using `reqwest` and `tokio`.
  - `projects.rs`: Local JSON collection storage and recursive folder manager.
  - `environments.rs`: Multi-environment key-value variable interpolation engine (`{{variable}}`).
  - `history.rs`: 100-request ring buffer persisted to `history.json`.
  - `pdf_export.rs`: Offline PDF documentation generator powered by `printpdf`.

- **Developer Tooling (`scripts/`)**:
  - `setup.js`: Universal cross-platform dispatcher and `pnpm check:env` health diagnostic doctor.
  - `setup-linux.sh`, `setup-macos.sh`, `setup-windows.ps1`: Platform setup scripts.

---

## 5. Submitting a Pull Request

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "feat: add support for OAuth2 authentication"
   ```
3. Push your branch to your fork and open a Pull Request against `main`.
4. Include a clear explanation of what changed and any verification steps.
