# Boltt

> A lightweight, no-bloat HTTP client built for developers who just want to send requests.

---

## What is Boltt?

Boltt is a desktop HTTP client that does exactly what you need and nothing else. No cloud sync, no AI suggestions, no team workspaces, no billing screens — just a clean interface to build requests, inspect responses, and get on with your work.

It is built with Rust and Tauri, so it ships as a native binary under 10 MB on every major platform.

---

## Why does this exist?

Postman started as a simple Chrome extension and grew into a full SaaS platform. Today opening it means navigating a workspace dashboard, dismissing upgrade prompts, waiting for Electron to load, and hunting through tabs to find the actual request builder.

Most developers use roughly five percent of what Postman offers. Boltt is the other ninety-five percent — stripped out, redesigned, and shipped as a fast native app.

---

## Core features

- **Request builder** — method selector, URL bar with `{{variable}}` support, query params, headers, and body (JSON, raw, form-data)
- **Response viewer** — syntax-highlighted JSON, status code with color coding, response time, size, and response headers
- **Collections** — save requests into named folders, stored as plain JSON files on your disk
- **Environments** — define variable sets (production, staging, local) and switch between them instantly
- **Auth helpers** — Bearer token and Basic auth that pre-fill the Authorization header, no magic
- **Request history** — the last 100 requests are always accessible from the sidebar
- **Tabs** — open and switch between multiple requests without losing state
- **Keyboard-first** — `Cmd+Enter` to send, `Cmd+S` to save, `Cmd+T` for a new tab, `Cmd+W` to close

---

## What it does not do

This is intentional. Boltt will never include:

- Cloud sync or team sharing
- AI-assisted request generation or response analysis
- API mocking or contract testing
- Pre/post request scripting
- A built-in API design editor
- Any telemetry or usage tracking
- A subscription model

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| App shell | Tauri v2 | Native webview, ~8 MB binary, no Electron overhead |
| Backend / HTTP engine | Rust + reqwest | Async, correct, fast. Handles HTTP/1.1 and HTTP/2 |
| Async runtime | Tokio | Standard async runtime for Rust |
| Serialization | serde + serde_json | Zero-cost JSON serialization for request/response types |
| Frontend | React + Vite + TypeScript | Fast dev loop, component model suits the panel layout |
| State management | Zustand | Minimal, no boilerplate, easy for tab and request state |
| Code editor | CodeMirror 6 | Lightweight syntax highlighting for JSON body and response viewer |
| Persistence | Plain JSON files on disk | Human-readable, git-friendly, no database dependency |

---

## Project structure

```
boltt/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri app entry point
│   │   ├── commands.rs          # #[tauri::command] bridge to frontend
│   │   ├── http_client.rs       # reqwest-based request engine
│   │   ├── collections.rs       # load / save collections from disk
│   │   ├── environments.rs      # variable sets + {{substitution}} logic
│   │   └── history.rs           # ring-buffer of recent requests
│   └── Cargo.toml
├── src/
│   ├── components/
│   │   ├── Sidebar/             # Collections tree + history panel
│   │   ├── TabBar/              # Open request tabs
│   │   ├── UrlBar/              # Method select + URL input + Send button
│   │   ├── RequestPane/         # Params / Headers / Body / Auth tabs
│   │   └── ResponsePane/        # Response body + headers viewer
│   ├── store/                   # Zustand — tabs, active request, active environment
│   └── lib/
│       └── tauri.ts             # Typed wrappers around invoke()
└── README.md
```

---

## Data storage

All data lives on your machine. There is no server.

```
~/.config/boltt/
├── collections/
│   └── {id}.json       # One file per collection — portable, git-versionable
├── environments.json   # All named environments and their variables
└── history.json        # Ring-buffer of the last 100 requests
```

Collections are plain JSON. You can commit them to a repository, diff them, and share them by copying a file.

---

## Requirements

### To run the app

- macOS 11+, Windows 10+, or a modern Linux desktop (GTK 3)
- No other runtime or dependency needed — it ships as a single binary

### To build from source

- [Rust](https://rustup.rs/) (stable toolchain, 1.77+)
- [Node.js](https://nodejs.org/) 18+
- [Tauri CLI](https://tauri.app/start/prerequisites/) (`cargo install tauri-cli`)
- Platform build tools:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: Microsoft C++ Build Tools + WebView2
  - **Linux**: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

---

## Keyboard shortcuts

| Action | macOS | Windows / Linux |
|---|---|---|
| Send request | `Cmd+Enter` | `Ctrl+Enter` |
| Save request | `Cmd+S` | `Ctrl+S` |
| New tab | `Cmd+T` | `Ctrl+T` |
| Close tab | `Cmd+W` | `Ctrl+W` |
| Focus URL bar | `Cmd+L` | `Ctrl+L` |
| New collection | `Cmd+Shift+N` | `Ctrl+Shift+N` |

---

## Roadmap

**v0.1 — core (current)**
- Request builder with full method/headers/body/auth support
- Response viewer with syntax highlight
- Collections and environments
- Request history
- Native binary for macOS, Windows, Linux

**v0.2 — quality of life**
- Copy response as curl command
- Multipart / file upload body type
- SSL verification toggle per request
- Import and export collections as JSON files

**v0.3 — power user**
- Response search and filter
- Cookie jar viewer
- Response time history graph per endpoint
- Redirect chain inspector

No scripting, no mocking, no AI. Ever.

---

## Design philosophy

**One job, done well.** Boltt is an HTTP client. It sends requests and shows you responses. Every feature decision starts with the question: does this make sending requests and reading responses better? If not, it does not ship.

**Local first.** Your collections, environments, and history live on your filesystem. The app works offline. There is no account, no sync, no vendor lock-in.

**Native performance.** The HTTP engine is Rust. Cold start is under 200ms. The binary is self-contained. It does not require Node, Python, or a JVM to be installed.

**Readable persistence.** Everything stored on disk is human-readable JSON. You can inspect it, version-control it, grep it, and manipulate it with any tool you already have.