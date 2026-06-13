import { useState, useRef, useEffect } from "react";
import { UrlBar } from "./components/UrlBar/UrlBar";
import { RequestPane } from "./components/RequestPane/RequestPane";
import { Zap, Settings, RefreshCw, Folder, Globe, Clock, Plus, Eye, EyeOff } from "lucide-react";
import "./App.css";
import { Group, Panel, Separator, type PanelImperativeHandle } from "react-resizable-panels";
import { ResponsePane } from "./components/ResponsePane/ResponsePane";
import { useRequestStore } from "./store/requestStore";
import { useEnvStore } from "./store/envStore";
import { EnvironmentDropdown } from "./components/EnvironmentDropdown/EnvironmentDropdown";
import { EnvironmentModal } from "./components/EnvironmentModal/EnvironmentModal";

type SidebarTab = "collections" | "environments" | "history";

function App() {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("collections");
  const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
  const responsePanelRef = useRef<PanelImperativeHandle>(null);

  const response = useRequestStore((state) => state.response);
  const isLoading = useRequestStore((state) => state.isLoading);
  const loadEnvironments = useEnvStore((state) => state.loadEnvironments);

  // Load environments from backend on mount
  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  // Auto-expand response pane when response is loaded
  useEffect(() => {
    if (response && !isLoading) {
      const panel = responsePanelRef.current;
      if (panel && panel.isCollapsed()) {
        panel.expand();
      }
    }
  }, [response, isLoading]);

  const toggleResponsePane = () => {
    const panel = responsePanelRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };


  return (
    <div className="h-screen w-screen bg-[#101419] text-[#e0e2ea] flex flex-col font-sans overflow-hidden select-none">
      {/* Header bar */}
      <header className="h-12 border-b border-[#30363D] flex items-center justify-between px-4 bg-[#1c2025] flex-shrink-0">
        <div className="flex items-center space-x-2">
          <Zap size={16} className="text-[#a1c9ff] fill-[#a1c9ff]" />
          <span className="font-semibold text-sm tracking-wider text-[#a1c9ff]">
            Boltt
          </span>
          <span className="text-xs text-[#c0c7d3] bg-[#272a30] px-2 py-0.5 rounded border border-[#30363D]">
            v0.1 — Developer Client
          </span>
        </div>
        <div className="flex items-center space-x-3 text-xs text-[#c0c7d3]">
          <EnvironmentDropdown />
          <button className="p-1 hover:bg-[#272a30] rounded border border-transparent hover:border-[#30363D] transition">
            <Settings size={14} />
          </button>
          <button className="p-1 hover:bg-[#272a30] rounded border border-transparent hover:border-[#30363D] transition">
            <RefreshCw size={14} />
          </button>
          <span className="text-xs">
            Status: <strong className="text-[#a1c9ff]">Online</strong>
          </span>
        </div>
      </header>

      {/* Main Resizable Split Workspace */}
      <div className="flex-1 overflow-hidden relative">
        <Group id="main-workspace-group-v5" orientation="horizontal">
          
          {/* 1. Sidebar Panel */}
          <Panel
            id="sidebar-panel"
            defaultSize="250px"
            minSize="300px"
            maxSize="400px"
            groupResizeBehavior="preserve-pixel-size"
            collapsible={true}
            className="flex flex-col bg-[#161B22] h-full overflow-hidden"
          >
            {/* Sidebar Horizontal Options Tabs */}
            <div className="flex border-b border-[#30363D] bg-[#1c2025] h-9 flex-shrink-0">
              <button
                onClick={() => setSidebarTab("collections")}
                className={`flex-1 flex items-center justify-center text-[11px] font-semibold transition px-2 min-w-0 ${
                  sidebarTab === "collections"
                    ? "bg-[#161B22] text-[#a1c9ff] border-t-2 border-t-[#a1c9ff]"
                    : "text-[#8b919d] hover:text-[#e0e2ea]"
                }`}
              >
                <Folder size={13} className="flex-shrink-0" />
                {sidebarTab === "collections" && <span className="ml-1.5 truncate whitespace-nowrap">Collections</span>}
              </button>
              
              <button
                onClick={() => setSidebarTab("environments")}
                className={`flex-1 flex items-center justify-center text-[11px] font-semibold transition px-2 min-w-0 ${
                  sidebarTab === "environments"
                    ? "bg-[#161B22] text-[#a1c9ff] border-t-2 border-t-[#a1c9ff]"
                    : "text-[#8b919d] hover:text-[#e0e2ea]"
                }`}
              >
                <Globe size={13} className="flex-shrink-0" />
                {sidebarTab === "environments" && <span className="ml-1.5 truncate whitespace-nowrap">Environments</span>}
              </button>
              
              <button
                onClick={() => setSidebarTab("history")}
                className={`flex-1 flex items-center justify-center text-[11px] font-semibold transition px-2 min-w-0 ${
                  sidebarTab === "history"
                    ? "bg-[#161B22] text-[#a1c9ff] border-t-2 border-t-[#a1c9ff]"
                    : "text-[#8b919d] hover:text-[#e0e2ea]"
                }`}
              >
                <Clock size={13} className="flex-shrink-0" />
                {sidebarTab === "history" && <span className="ml-1.5 truncate whitespace-nowrap">History</span>}
              </button>
            </div>

            {/* Sidebar Scrollable Content */}
            <div className="flex-1 p-3 overflow-y-auto min-h-0">
              {sidebarTab === "collections" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#8b919d] uppercase tracking-wider">
                      Projects
                    </span>
                    <button className="text-[10px] bg-[#272a30] text-[#a1c9ff] border border-[#30363D] px-1.5 py-0.5 rounded hover:bg-[#32353b] flex items-center space-x-1">
                      <Plus size={10} />
                      <span>New</span>
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

            <div className="p-3 border-t border-[#30363D] text-[11px] text-[#8b919d] bg-[#1c2025]/20 flex-shrink-0 flex items-center justify-between">
              <div>
                Press <kbd className="bg-[#272a30] px-1 rounded text-[#e0e2ea] font-mono">Ctrl+Enter</kbd> to Send
              </div>
              <button
                onClick={toggleResponsePane}
                className="flex items-center space-x-1 px-1.5 py-0.5 bg-[#272a30] hover:bg-[#32353b] border border-[#30363D] text-[#e0e2ea] rounded-sm transition cursor-pointer"
                title={isResponseCollapsed ? "Expand Response Pane" : "Collapse Response Pane"}
              >
                {isResponseCollapsed ? (
                  <>
                    <Eye size={11} className="text-[#a1c9ff]" />
                    <span>Show Resp</span>
                  </>
                ) : (
                  <>
                    <EyeOff size={11} className="text-[#8b919d]" />
                    <span>Hide Resp</span>
                  </>
                )}
              </button>
            </div>
          </Panel>

          {/* Resize Handle 1 */}
          <Separator className="w-2 hover:bg-[#a1c9ff]/10 active:bg-[#a1c9ff]/20 transition-all cursor-col-resize self-stretch flex-shrink-0 flex items-center justify-center">
            <div className="w-[1px] h-full bg-[#30363D]" />
          </Separator>

          {/* 2. Main Workstage Panel (Request Stage + Response Stage) */}
          <Panel className="h-full overflow-hidden">
            <Group id="workstage-group-v5" orientation="horizontal">
              
              {/* Left stage: Request Builder Panel */}
              <Panel defaultSize="55%" minSize="500px" className="flex flex-col p-4 bg-[#101419] h-full overflow-hidden space-y-4 min-w-0">
                <UrlBar />
                <RequestPane />
              </Panel>

              {/* Resize Handle 2 */}
              <Separator className="w-2 hover:bg-[#a1c9ff]/10 active:bg-[#a1c9ff]/20 transition-all cursor-col-resize self-stretch flex-shrink-0 flex items-center justify-center">
                <div className="w-[1px] h-full bg-[#30363D]" />
              </Separator>

              {/* Right stage: Response Pane Panel */}
              <Panel
                id="response-panel"
                panelRef={responsePanelRef}
                defaultSize={45}
                minSize="420px"
                collapsible={true}
                onResize={(size) => {
                  setIsResponseCollapsed(size.inPixels === 0);
                }}
                className="flex flex-col p-4 bg-[#161B22] h-full overflow-hidden min-w-0"
              >
                <ResponsePane />
              </Panel>

            </Group>
          </Panel>

        </Group>
      </div>
      <EnvironmentModal />
    </div>
  );
}

export default App;
