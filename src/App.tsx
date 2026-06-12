import { useState } from "react";
import { useRequestStore } from "./store/requestStore";
import { UrlBar } from "./components/UrlBar/UrlBar";
import { RequestPane } from "./components/RequestPane/RequestPane";
import "./App.css";

type SidebarTab = "collections" | "environments" | "history";

function App() {
  const { response, isLoading } = useRequestStore();
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("collections");

  const renderResponseBody = (body: string) => {
    if (!body) return "(Empty response)";
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body; // Fallback to raw text if not valid JSON
    }
  };

  return (
    <div className="min-h-screen bg-[#101419] text-[#e0e2ea] flex flex-col font-sans select-none">
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
            v0.1 — Request Builder UI
          </span>
        </div>
        <div className="flex items-center space-x-3 text-xs text-[#c0c7d3]">
          <span>Status: <strong className="text-[#a1c9ff]">Stage Active</strong></span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-[#30363D] bg-[#161B22] flex flex-col justify-between">
          <div className="flex flex-col h-full">
            {/* Sidebar Horizontal Option Tabs */}
            <div className="flex border-b border-[#30363D] bg-[#1c2025] h-9">
              <button
                onClick={() => setSidebarTab("collections")}
                className={`flex-1 flex items-center justify-center text-[11px] font-semibold transition ${
                  sidebarTab === "collections"
                    ? "bg-[#161B22] text-[#a1c9ff] border-t-2 border-t-[#a1c9ff]"
                    : "text-[#8b919d] hover:text-[#e0e2ea]"
                }`}
              >
                📁 Collections
              </button>
              <button
                onClick={() => setSidebarTab("environments")}
                className={`flex-1 flex items-center justify-center text-[11px] font-semibold transition ${
                  sidebarTab === "environments"
                    ? "bg-[#161B22] text-[#a1c9ff] border-t-2 border-t-[#a1c9ff]"
                    : "text-[#8b919d] hover:text-[#e0e2ea]"
                }`}
              >
                ⇆ Environments
              </button>
              <button
                onClick={() => setSidebarTab("history")}
                className={`flex-1 flex items-center justify-center text-[11px] font-semibold transition ${
                  sidebarTab === "history"
                    ? "bg-[#161B22] text-[#a1c9ff] border-t-2 border-t-[#a1c9ff]"
                    : "text-[#8b919d] hover:text-[#e0e2ea]"
                }`}
              >
                🕒 History
              </button>
            </div>

            {/* Sidebar Content Area */}
            <div className="flex-1 p-3 overflow-y-auto">
              {sidebarTab === "collections" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#8b919d] uppercase tracking-wider">
                      Projects
                    </span>
                    <button className="text-[10px] bg-[#272a30] text-[#a1c9ff] border border-[#30363D] px-1.5 py-0.5 rounded hover:bg-[#32353b]">
                      + New
                    </button>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="px-2 py-1 bg-[#1c2025] border border-[#30363D] text-[#e0e2ea] rounded-sm cursor-pointer hover:border-[#a1c9ff]/50">
                      📁 Main Workspace
                    </div>
                    <div className="pl-4 py-1 text-[#8b919d] cursor-pointer hover:text-[#e0e2ea] flex items-center space-x-1.5">
                      <span className="text-[9px] font-bold text-green-400">GET</span>
                      <span>list users</span>
                    </div>
                    <div className="pl-4 py-1 text-[#8b919d] cursor-pointer hover:text-[#e0e2ea] flex items-center space-x-1.5">
                      <span className="text-[9px] font-bold text-[#f1c04c]">POST</span>
                      <span>create user</span>
                    </div>
                  </div>
                </div>
              )}

              {sidebarTab === "environments" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#8b919d] uppercase tracking-wider">
                      Environments
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between px-2 py-1 text-[#8b919d] hover:text-[#e0e2ea] bg-[#1c2025]/50 border border-[#30363D] rounded-sm cursor-pointer">
                      <span>Production</span>
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    </div>
                    <div className="px-2 py-1 text-[#8b919d] hover:text-[#e0e2ea] cursor-pointer">
                      Staging
                    </div>
                    <div className="px-2 py-1 text-[#8b919d] hover:text-[#e0e2ea] cursor-pointer">
                      Local
                    </div>
                  </div>
                </div>
              )}

              {sidebarTab === "history" && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-[#8b919d] uppercase tracking-wider mb-2">
                    Recent Requests
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-[#8b919d]">
                    <div className="p-1.5 border border-[#30363D] bg-[#1c2025]/20 rounded-sm hover:border-[#a1c9ff]/40 cursor-pointer flex justify-between items-center">
                      <span className="text-green-400 font-bold">GET</span>
                      <span className="truncate flex-1 pl-2 text-left">/get</span>
                      <span className="text-[10px] text-[#8b919d]">200 OK</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 border-t border-[#30363D] text-[11px] text-[#8b919d] bg-[#1c2025]/20">
            Press <kbd className="bg-[#272a30] px-1 rounded text-[#e0e2ea]">Ctrl+Enter</kbd> to Send
          </div>
        </aside>

        {/* Editor Area */}
        <main className="flex-1 p-5 flex flex-col md:flex-row overflow-hidden space-y-4 md:space-y-0 md:space-x-4 bg-[#101419]">
          {/* Left panel: Request Builder */}
          <section className="flex-1 flex flex-col space-y-4 h-full overflow-hidden">
            <UrlBar />
            <RequestPane />
          </section>

          {/* Right panel: Response Viewer */}
          <section className="w-full md:w-[45%] flex flex-col border border-[#30363D] bg-[#161B22] rounded-sm p-4 h-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#30363D] pb-2 mb-3">
              <h3 className="text-xs font-semibold text-[#8b919d] uppercase tracking-wider">
                Response Pane
              </h3>
              {response && (
                <div className="flex items-center space-x-3 text-xs">
                  <span className={`px-2 py-0.5 rounded font-mono border ${
                    response.status >= 200 && response.status < 300
                      ? "bg-green-950/40 text-green-400 border-green-800/40"
                      : response.status === 0
                      ? "bg-red-950/40 text-red-400 border-red-800/40"
                      : "bg-yellow-950/40 text-yellow-400 border-yellow-800/40"
                  }`}>
                    {response.status === 0 ? "0 Network Error" : `${response.status} ${response.status_text}`}
                  </span>
                  {response.status !== 0 && (
                    <>
                      <span className="text-[#8b919d] font-mono">
                        Time: <strong className="text-[#e0e2ea]">{response.time_ms} ms</strong>
                      </span>
                      <span className="text-[#8b919d] font-mono">
                        Size: <strong className="text-[#e0e2ea]">{response.size_bytes} B</strong>
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                <div className="w-6 h-6 border-2 border-[#a1c9ff] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-[#8b919d]">Dispatching HTTP request...</span>
              </div>
            )}

            {!isLoading && !response && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#30363D] rounded-sm bg-[#101419]/50">
                <span className="text-[#8b919d] text-xs max-w-xs">
                  Hit Send in the Request Builder to dispatch the request and inspect the response.
                </span>
              </div>
            )}

            {response && (
              <div className="flex-1 flex flex-col space-y-4 overflow-y-auto">
                {response.headers.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-semibold text-[#8b919d] uppercase mb-1">Response Headers</h4>
                    <div className="grid grid-cols-2 gap-1 bg-[#101419] p-2 rounded border border-[#30363D] font-mono text-xs max-h-40 overflow-y-auto">
                      {response.headers.map((h, i) => (
                        <div key={i} className="flex justify-between col-span-2 border-b border-[#1c2025] py-0.5 last:border-0">
                          <span className="text-[#8b919d]">{h.key}:</span>
                          <span className="text-[#e0e2ea] text-right break-all pl-4">{h.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex-1 flex flex-col min-h-0">
                  <h4 className="text-[11px] font-semibold text-[#8b919d] uppercase mb-1">Response Body</h4>
                  <pre className="flex-1 bg-[#101419] text-green-300 p-3 rounded border border-[#30363D] font-mono text-xs overflow-auto whitespace-pre-wrap">
                    {renderResponseBody(response.body)}
                  </pre>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
