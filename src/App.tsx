import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

type RequestBody =
  | { type: "Json"; content: string }
  | { type: "Raw"; content: string }
  | { type: "FormData"; content: KeyValue[] }
  | { type: "None"; content?: never };

type AuthConfig =
  | { type: "None"; config?: never }
  | { type: "Bearer"; config: { token: string } }
  | { type: "Basic"; config: { username: string; password: string } };

interface BoltRequest {
  id?: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: RequestBody;
  auth: AuthConfig;
  ssl_verify?: boolean;
}

interface BoltResponse {
  status: number;
  status_text: string;
  headers: KeyValue[];
  body: string;
  time_ms: number;
  size_bytes: number;
}

function App() {
  const [method, setMethod] = useState<BoltRequest["method"]>("GET");
  const [url, setUrl] = useState("https://api.example.com/v1/resource");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<BoltResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestCall = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    const testRequest: BoltRequest = {
      name: "Phase 1 Test Request",
      method,
      url,
      headers: [
        { key: "Content-Type", value: "application/json", enabled: true },
        { key: "Accept", value: "application/json", enabled: true },
      ],
      params: [
        { key: "limit", value: "20", enabled: true },
      ],
      body: {
        type: "Json",
        content: JSON.stringify({ test: "data" }),
      },
      auth: {
        type: "Bearer",
        config: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
      },
      ssl_verify: true,
    };

    try {
      const res = await invoke<BoltResponse>("send_request", {
        request: testRequest,
      });
      setResponse(res);
    } catch (err) {
      console.error(err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101419] text-[#e0e2ea] flex flex-col font-sans">
      {/* Header bar */}
      <header className="h-12 border-b border-[#30363D] flex items-center justify-between px-4 bg-[#1c2025]">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-[#a1c9ff] flex items-center justify-center text-[#00325a] font-bold text-sm">
            ⚡
          </div>
          <span className="font-semibold text-sm tracking-wider uppercase text-[#a1c9ff]">
            Boltt
          </span>
          <span className="text-xs text-[#c0c7d3] bg-[#272a30] px-2 py-0.5 rounded border border-[#30363D]">
            v0.1 — Phase 1 Scaffold
          </span>
        </div>
        <div className="flex items-center space-x-3 text-xs text-[#c0c7d3]">
          <span>Status: <strong className="text-green-400">Bridge Active</strong></span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Workspace Sidebar Placeholder */}
        <aside className="w-full md:w-64 border-r border-[#30363D] bg-[#161B22] p-4 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-semibold text-[#8b919d] uppercase tracking-wider mb-3">
              Collections
            </h2>
            <div className="space-y-1">
              <div className="px-2 py-1.5 rounded text-xs text-[#c0c7d3] bg-[#1c2025] border border-l-2 border-[#30363D] border-l-[#a1c9ff]">
                📁 Main Workspace
              </div>
              <div className="pl-6 py-1 text-xs text-[#8b919d]">
                📄 Phase 1 Request
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-[#30363D] text-[11px] text-[#8b919d]">
            Press <kbd className="bg-[#272a30] px-1 rounded text-[#e0e2ea]">Send</kbd> to test connection.
          </div>
        </aside>

        {/* Editor Area */}
        <main className="flex-1 p-6 flex flex-col overflow-y-auto space-y-6">
          {/* Method and URL Input bar */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-semibold text-[#8b919d]">Request URL</label>
            <div className="flex space-x-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as BoltRequest["method"])}
                className="bg-[#1c2025] text-[#e0e2ea] border border-[#30363D] px-3 py-2 rounded-sm text-xs font-mono focus:outline-none focus:border-[#a1c9ff]"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-[#1c2025] text-[#e0e2ea] border border-[#30363D] px-3 py-2 rounded-sm text-xs font-mono focus:outline-none focus:border-[#a1c9ff]"
                placeholder="https://api.example.com/v1/..."
              />
              <button
                onClick={handleTestCall}
                disabled={isLoading}
                className="bg-[#a1c9ff] text-[#00325a] hover:bg-blue-300 font-semibold px-5 py-2 rounded-sm text-xs transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>

          {/* Detailed Request Details view */}
          <div className="border border-[#30363D] bg-[#161B22] rounded-sm p-4">
            <h3 className="text-xs font-semibold text-[#8b919d] uppercase tracking-wider mb-2">
              Tauri Command Bridge Payload (Outgoing)
            </h3>
            <pre className="text-xs font-mono text-[#c0c7d3] bg-[#101419] p-3 rounded border border-[#30363D] overflow-x-auto">
{JSON.stringify({
  name: "Phase 1 Test Request",
  method,
  url,
  headers: [
    { key: "Content-Type", value: "application/json", enabled: true },
    { key: "Accept", value: "application/json", enabled: true },
  ],
  params: [
    { key: "limit", value: "20", enabled: true }
  ],
  body: {
    type: "Json",
    content: "{\"test\":\"data\"}"
  },
  auth: {
    type: "Bearer",
    config: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
  },
  ssl_verify: true
}, null, 2)}
            </pre>
          </div>

          {/* Response Viewer */}
          <div className="flex-1 flex flex-col border border-[#30363D] bg-[#161B22] rounded-sm p-4">
            <div className="flex items-center justify-between border-b border-[#30363D] pb-2 mb-3">
              <h3 className="text-xs font-semibold text-[#8b919d] uppercase tracking-wider">
                Response View
              </h3>
              {response && (
                <div className="flex items-center space-x-3 text-xs">
                  <span className="bg-green-950/40 text-green-400 px-2 py-0.5 rounded font-mono border border-green-800/40">
                    {response.status} {response.status_text}
                  </span>
                  <span className="text-[#8b919d] font-mono">
                    Time: <strong className="text-[#e0e2ea]">{response.time_ms} ms</strong>
                  </span>
                  <span className="text-[#8b919d] font-mono">
                    Size: <strong className="text-[#e0e2ea]">{response.size_bytes} B</strong>
                  </span>
                </div>
              )}
            </div>

            {isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-6 h-6 border-2 border-[#a1c9ff] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-[#8b919d]">Invoking send_request on Tauri Backend...</span>
              </div>
            )}

            {!isLoading && !response && !error && (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <span className="text-[#8b919d] text-xs">
                  Ready to fire. Click "Send Request" to test the bridge.
                </span>
              </div>
            )}

            {error && (
              <div className="flex-1 bg-red-950/20 border border-red-900/40 text-red-300 p-3 rounded text-xs font-mono">
                <strong>Bridge Error:</strong> {error}
              </div>
            )}

            {response && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-semibold text-[#8b919d] uppercase mb-1">Response Headers</h4>
                  <div className="grid grid-cols-2 gap-1 bg-[#101419] p-2 rounded border border-[#30363D] font-mono text-xs">
                    {response.headers.map((h, i) => (
                      <div key={i} className="flex justify-between col-span-2 border-b border-[#1c2025] py-0.5">
                        <span className="text-[#8b919d]">{h.key}:</span>
                        <span className="text-[#e0e2ea]">{h.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-semibold text-[#8b919d] uppercase mb-1">Response Body</h4>
                  <pre className="text-xs font-mono text-green-300 bg-[#101419] p-3 rounded border border-[#30363D] overflow-x-auto">
                    {JSON.stringify(JSON.parse(response.body), null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
