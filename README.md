## What is Boltt?

Boltt is a desktop HTTP client that does exactly what you need and nothing else. No cloud sync, no AI suggestions, no team workspaces, no billing screens — just a clean interface to build requests, inspect responses, and get on with your work.

It is built with Rust and Tauri, shipping as a native binary under 10 MB on every major platform. Cold start under 200ms. Idle RAM around 30–50 MB. It opens, you work, you close it.

---

## Who is it for?

Boltt is built for the developer who:

- Opens an HTTP client, sends a request, and closes it — no onboarding needed
- Works solo or in a small team with no need for workspace management
- Finds Postman exhausting to navigate but needs something better than typing curl in a terminal
- Cares that the app opens in under a second and never slows them down
- Wants their saved requests to be plain files they can put in git

If you use five percent of what Postman offers, Boltt is built for that five percent.

---

## Why does this exist?

Postman started as a simple Chrome extension. Today it is a SaaS platform — you navigate a workspace dashboard, dismiss upgrade prompts, wait for Electron to load, and hunt through tabs to find the request builder. The core tool got buried under collaboration features, AI suggestions, mock servers, monitors, and billing flows that most developers never use.

Boltt is the request builder, response viewer, and nothing else — redesigned from scratch and shipped as a fast native app.

**The performance difference is not subtle:**

| | Boltt | Postman |
|---|---|---|
| Cold start | ~200ms | 3–5 seconds |
| Install size | ~8 MB | 300 MB+ |
| Idle RAM | ~30–50 MB | 300–500 MB |

This is not an optimization. It is what you get for free by choosing Rust and Tauri over Electron.

---

## Features

### Request builder
A method dropdown (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) paired with a URL input. The URL understands `{{variable}}` syntax so you never hardcode base URLs. Everything you configure here is exactly what gets sent — no hidden transformations.

### Query params editor
A key-value table that appends to the URL automatically as `?key=value`. Each row has a toggle checkbox so you can disable a param without deleting it. Supports `{{variables}}`.

### Headers editor
Same key-value table for request headers. Common headers like `Content-Type` and `Authorization` are just rows — no auto-injection you did not ask for. Toggle rows on and off freely.

### Body editor
Three modes. **JSON** gives you a CodeMirror editor with syntax highlighting and bracket matching. **Raw** is a plain text area for XML, GraphQL queries, or anything else. **Form-data** is the key-value table for `multipart/form-data`. Boltt sets the correct `Content-Type` header automatically based on which mode is active.

### Auth helpers
A dedicated Auth tab with Bearer token and Basic auth. Both options simply pre-fill the Authorization header — you can always see and override the result in the Headers tab. No black-box auth behavior.

### Response viewer
Status code as a color-coded pill (green 2xx, yellow 3xx, red 4xx/5xx), response time in milliseconds, and response body size. Body is syntax-highlighted for JSON, falling back to raw text for everything else.

### Response headers tab
Every header the server returned, displayed in the same key-value table format. Useful for debugging cache headers, CORS, rate limits, and content negotiation.

### Environments
Named variable sets — `production`, `staging`, `local` — each with their own key-value pairs. Switch the active environment from a dropdown in the sidebar. Every `{{variable}}` in your requests resolves against the active environment at send time. Stored as a single `environments.json` file on disk.

### Variable substitution
Before firing any request, Boltt walks the URL, all header values, and the body looking for `{{name}}` patterns and replaces them with the active environment's values. This happens in Rust before the HTTP call so you always know exactly what went out.

### Projects
A project is a named folder that holds saved requests, organized into subfolders. Think of it like a folder on your desktop — one project per API or codebase you are working with. Clicking a saved request loads it with the full method, URL, headers, params, and body exactly as you left it.

Projects live as individual `.json` files on your disk. They are plain, human-readable, and git-committable. Share a project with a teammate by copying the file.

```
My Backend
├── Auth
│   ├── POST  login
│   ├── POST  refresh token
│   └── DELETE logout
├── Users
│   ├── GET   list users
│   ├── POST  create user
│   └── PUT   update user
└── Orders
    ├── GET   list orders
    └── PATCH update order
```

### Export folder as PDF
Right-click any folder inside a project and export it as a clean, formatted PDF document. The PDF lists every request in that folder with its method, URL, headers, params, and body — formatted for readability, not for machines. Useful for sharing API surface in team meetings, attaching to documentation, or sending to a frontend team without requiring them to have Boltt installed.

Variables stay as `{{variable}}` in the PDF — they are not resolved — so the reader understands what is environment-dependent. A variable legend is included at the top of the document.

### Tabs
Every request you open lives in a tab. Tabs are independent — switching does not lose the response you were looking at. Closing a tab with unsaved changes prompts you first.

### Request history
Every request you send is appended to a history log regardless of whether you saved it. The sidebar shows the last 100 entries with method, URL, status code, and timestamp. Click any entry to load it into a new tab. Stored as a ring buffer in `history.json` — oldest entries drop off automatically.

### Copy as curl
A button in the response pane that generates the exact equivalent `curl` command for the request just sent, including all headers, body, and auth. Paste it into a terminal, share it in a Slack message, or drop it into documentation.

### SSL verification toggle
A per-request toggle to skip certificate validation. Off by default. Visible and explicit — Boltt never silently disables SSL.

### Keyboard-first
The app is fully usable without touching the mouse for common flows.

---

## What Boltt will never include

- Cloud sync or team workspaces
- AI-assisted request generation or analysis
- API mocking or contract testing
- Pre/post request scripting
- Built-in API design tooling
- Telemetry or usage tracking
- A subscription model or paid tier

---

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| App shell | Tauri v2 | Native webview, ~8 MB binary, no Electron overhead |
| HTTP engine | Rust + reqwest | Async, correct, handles HTTP/1.1 and HTTP/2 |
| Async runtime | Tokio | Standard async runtime for Rust |
| Serialization | serde + serde_json | Zero-cost JSON for all request and response types |
| PDF generation | printpdf (Rust) | Fully offline, no external service, lightweight |
| Frontend | React + Vite + TypeScript | Fast dev loop, suits the panel layout |
| State management | Zustand | Minimal, no boilerplate |
| Code editor | CodeMirror 6 | Lightweight syntax highlight for body and response viewer |
| Persistence | Plain JSON files on disk | Human-readable, git-friendly, no database |

---

## Project structure

```
boltt/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri app entry point
│   │   ├── commands.rs          # #[tauri::command] bridge to frontend
│   │   ├── http_client.rs       # reqwest-based request engine
│   │   ├── projects.rs          # load / save projects from disk
│   │   ├── environments.rs      # variable sets + {{substitution}} logic
│   │   ├── history.rs           # ring-buffer of recent requests
│   │   └── pdf_export.rs        # folder-level PDF generation
│   └── Cargo.toml
├── src/
│   ├── components/
│   │   ├── Sidebar/             # Projects tree + history panel
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

All data lives on your machine. There is no server, no account, no sync.

```
~/.config/boltt/
├── projects/
│   └── {id}.json       # One file per project — portable, git-versionable
├── environments.json   # All named environments and their variables
└── history.json        # Ring-buffer of the last 100 requests
```

---

## Requirements

### To run

- macOS 11+, Windows 10+, or a modern Linux desktop (GTK 3)
- No runtime or additional dependency required

### To build from source

- [Rust](https://rustup.rs/) stable 1.77+
- [Node.js](https://nodejs.org/) 18+
- [Tauri CLI](https://tauri.app/start/prerequisites/) — `cargo install tauri-cli`
- Platform build tools:
  - **macOS**: `xcode-select --install`
  - **Windows**: Microsoft C++ Build Tools + WebView2
  - **Linux**: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

---

## Getting started

```bash
git clone https://github.com/your-username/boltt
cd boltt
npm install
cargo tauri dev       # development with hot reload
cargo tauri build     # release binary
```

The release binary will be in `src-tauri/target/release/bundle/`.

---

## Keyboard shortcuts

| Action | macOS | Windows / Linux |
|---|---|---|
| Send request | `Cmd+Enter` | `Ctrl+Enter` |
| Save request | `Cmd+S` | `Ctrl+S` |
| New tab | `Cmd+T` | `Ctrl+T` |
| Close tab | `Cmd+W` | `Ctrl+W` |
| Focus URL bar | `Cmd+L` | `Ctrl+L` |
| New project | `Cmd+Shift+N` | `Ctrl+Shift+N` |

---

## Roadmap

**v0.1 — core**
- Request builder — method, URL, headers, params, body, auth
- Response viewer with syntax highlighting
- Projects with folder structure
- Environments and variable substitution
- Request history
- Native binary for macOS, Windows, Linux

**v0.2 — quality of life**
- Export folder as PDF
- Copy as curl
- SSL verification toggle per request
- Import and export project as JSON file
- Multipart file upload body type

**v0.3 — power user**
- Response search and filter
- Cookie jar viewer
- Redirect chain inspector
- Response time history graph per endpoint

---

## Design philosophy

**One job, done well.** Boltt is an HTTP client. It sends requests and shows responses. Every feature decision starts with the question: does this make sending requests and reading responses better? If not, it does not ship.

**Local first.** Your projects, environments, and history live on your filesystem. The app works offline. There is no account, no sync, no vendor lock-in.

**Native performance.** The HTTP engine is Rust. The binary is self-contained. It does not require Node, Python, or a JVM at runtime.

**Readable persistence.** Everything on disk is human-readable JSON. Inspect it, version-control it, grep it, and manipulate it with any tool you already have.
