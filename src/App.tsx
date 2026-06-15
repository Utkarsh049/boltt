import { useState, useRef, useEffect } from "react";
import { UrlBar } from "./components/UrlBar/UrlBar";
import { RequestPane } from "./components/RequestPane/RequestPane";
import { Zap, Settings, RefreshCw, Folder as FolderIcon, Globe, Clock, Eye, EyeOff, Plus } from "lucide-react";
import "./App.css";
import { Group, Panel, Separator, type PanelImperativeHandle } from "react-resizable-panels";
import { ResponsePane } from "./components/ResponsePane/ResponsePane";
import { useRequestStore } from "./store/requestStore";
import { useEnvStore } from "./store/envStore";
import { EnvironmentDropdown } from "./components/EnvironmentDropdown/EnvironmentDropdown";
import { EnvironmentModal } from "./components/EnvironmentModal/EnvironmentModal";
import { ProjectsTree } from "./components/ProjectsTree/ProjectsTree";
import { SaveRequestModal } from "./components/SaveRequestModal/SaveRequestModal";
import { TabBar } from "./components/TabBar/TabBar";
import { useProjectsStore, Folder } from "./store/projectsStore";
import { useHistoryStore } from "./store/historyStore";
import { HistoryPanel } from "./components/HistoryPanel/HistoryPanel";
import { invoke } from "@tauri-apps/api/core";
import { ToastList } from "./components/Toast/Toast";
import { useToastStore } from "./store/toastStore";

type SidebarTab = "collections" | "environments" | "history";

function App() {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("collections");
  const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
  const responsePanelRef = useRef<PanelImperativeHandle>(null);

  const response = useRequestStore((state) => state.response);
  const isLoading = useRequestStore((state) => state.isLoading);
  const tabs = useRequestStore((state) => state.tabs);
  const activeRequest = useRequestStore((state) => state.activeRequest);
  const openTab = useRequestStore((state) => state.openTab);

  const loadEnvironments = useEnvStore((state) => state.loadEnvironments);

  // Load environments and history from backend on mount
  useEffect(() => {
    loadEnvironments();
    useHistoryStore.getState().loadHistory();
  }, [loadEnvironments]);

  // Dynamic window title updates
  useEffect(() => {
    if (tabs.length > 0 && activeRequest) {
      document.title = `Boltt — ${activeRequest.name || activeRequest.url || "New Request"}`;
    } else {
      document.title = "Boltt";
    }
  }, [tabs.length, activeRequest?.name, activeRequest?.url]);

  // Project importing handler
  const handleImportProject = async () => {
    try {
      const imported = await invoke<any>("import_project");
      if (imported) {
        await useProjectsStore.getState().loadProjects();
        useToastStore.getState().showToast(`Project "${imported.name}" imported successfully`, "success");
      }
    } catch (err) {
      console.error("Import failed:", err);
      useToastStore.getState().showToast(`Failed to import project: ${err}`, "error");
    }
  };

  // Global Keyboard Shortcut: Ctrl+S / Cmd+S to save request, send, focus, tabs management, and escape modals
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Send request (Ctrl/Cmd + Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        const { tabs } = useRequestStore.getState();
        if (tabs.length > 0) {
          useRequestStore.getState().sendRequest(useEnvStore.getState().getFlatActiveVariables());
        }
        return;
      }

      // Focus URL input (Ctrl/Cmd + L)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("focus-url-bar"));
        return;
      }

      // Close open modals (Escape)
      if (e.key === "Escape") {
        useEnvStore.getState().setModalOpen(false);
        useProjectsStore.getState().setSaveModalOpen(false);
        window.dispatchEvent(new CustomEvent("close-all-modals"));
        return;
      }

      // switch tabs by index (Ctrl/Cmd + 1..9)
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const tabIdx = parseInt(e.key) - 1;
        const { tabs, setActiveTab } = useRequestStore.getState();
        if (tabs[tabIdx]) {
          setActiveTab(tabs[tabIdx].id);
        }
        return;
      }

      // open new tab (Ctrl/Cmd + T)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        useRequestStore.getState().openTab();
        return;
      }

      // close active tab (Ctrl/Cmd + W)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        const { activeTabId, closeTab } = useRequestStore.getState();
        if (activeTabId) {
          closeTab(activeTabId);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        
        const { projects, saveRequest, setSaveModalOpen } = useProjectsStore.getState();
        const activeRequest = useRequestStore.getState().activeRequest;
        const { tabs } = useRequestStore.getState();
        if (tabs.length === 0) return; // No active request to save
        
        if (!activeRequest.id) {
          setSaveModalOpen(true);
          return;
        }

        // Try to find request in projects to auto-save, otherwise open modal
        let foundLocation: { projectId: string; folderId: string } | null = null;
        for (const project of projects) {
          const findInFolders = (folders: Folder[]): string | null => {
            for (const folder of folders) {
              if (folder.requests.some((r) => r.id === activeRequest.id)) {
                return folder.id;
              }
              const sub = findInFolders(folder.subfolders);
              if (sub) return sub;
            }
            return null;
          };
          const fid = findInFolders(project.folders);
          if (fid) {
            foundLocation = { projectId: project.id, folderId: fid };
            break;
          }
        }

        if (foundLocation) {
          const savedReq = {
            id: activeRequest.id,
            name: activeRequest.name || "Untitled Request",
            method: activeRequest.method,
            url: activeRequest.url,
            headers: activeRequest.headers,
            params: activeRequest.params,
            body: activeRequest.body,
            auth: activeRequest.auth,
            created_at: Date.now(),
          };
          await saveRequest(foundLocation.projectId, foundLocation.folderId, savedReq);
          useToastStore.getState().showToast("Request saved", "success");
          console.log("Saved request directly via keyboard shortcut!");
        } else {
          setSaveModalOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
                    ? "bg-[#161B22] text-[#a1c9ff]"
                    : "text-[#8b919d] hover:text-[#e0e2ea]"
                }`}
              >
                <FolderIcon size={13} className="flex-shrink-0" />
                {sidebarTab === "collections" && <span className="ml-1.5 truncate whitespace-nowrap">Collections</span>}
              </button>
              
              <button
                onClick={() => setSidebarTab("environments")}
                className={`flex-1 flex items-center justify-center text-[11px] font-semibold transition px-2 min-w-0 ${
                  sidebarTab === "environments"
                    ? "bg-[#161B22] text-[#a1c9ff]"
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
                    ? "bg-[#161B22] text-[#a1c9ff]"
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
                <div className="space-y-4">
                  <ProjectsTree />
                  <div className="border-t border-[#30363D]/40 pt-2">
                    <HistoryPanel limit={8} />
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
                <div className="h-full flex flex-col">
                  <div className="text-[10px] font-bold text-[#8b919d] uppercase tracking-wider mb-2 flex-shrink-0">
                    Recent Requests
                  </div>
                  <div className="flex-1 min-h-0">
                    <HistoryPanel alwaysExpanded={true} limit={100} />
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
            {tabs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#101419] p-8 text-center select-none font-sans h-full relative overflow-hidden">
                {/* Background ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>
                
                <div className="max-w-md w-full space-y-6 z-10">
                  {/* Glowing Lightning Bolt Container */}
                  <div className="relative inline-flex items-center justify-center p-6 bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 rounded-full shadow-[0_0_50px_rgba(59,130,246,0.15)]">
                    <Zap size={48} className="text-[#a1c9ff] fill-[#a1c9ff]/20 filter drop-shadow-[0_0_12px_rgba(161,201,255,0.4)]" />
                  </div>
                  
                  <div className="space-y-2">
                    <h1 className="text-xl font-bold text-[#e0e2ea] tracking-tight">
                      Start your first request
                    </h1>
                    <p className="text-xs text-[#8b919d] leading-relaxed max-w-xs mx-auto">
                      Create a request tab to start testing API endpoints, or open/import a collection project to organize your requests.
                    </p>
                  </div>

                  {/* Quick actions grid */}
                  <div className="grid grid-cols-1 gap-2.5 pt-2 max-w-[280px] mx-auto">
                    <button
                      onClick={() => openTab()}
                      className="flex items-center justify-center space-x-2 w-full py-2 bg-[#a1c9ff] hover:bg-blue-300 text-[#00325a] rounded text-xs font-bold transition duration-150 cursor-pointer shadow-lg shadow-blue-950/20"
                    >
                      <Plus size={14} />
                      <span>Create a Request</span>
                    </button>
                    
                    <div className="flex items-center space-x-2 text-xs text-[#8b919d] py-1 select-none">
                      <div className="flex-1 h-[1px] bg-[#30363D]/60"></div>
                      <span>OR</span>
                      <div className="flex-1 h-[1px] bg-[#30363D]/60"></div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent("create-project-dialog"))}
                        className="flex-1 py-2 bg-[#1c2025] hover:bg-[#272a30] border border-[#30363D] text-[#e0e2ea] hover:text-[#a1c9ff] rounded text-xs font-semibold transition cursor-pointer"
                      >
                        New Project
                      </button>
                      <button
                        onClick={handleImportProject}
                        className="flex-1 py-2 bg-[#1c2025] hover:bg-[#272a30] border border-[#30363D] text-[#e0e2ea] hover:text-[#a1c9ff] rounded text-xs font-semibold transition cursor-pointer"
                      >
                        Import Project
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Group id="workstage-group-v5" orientation="horizontal">
                
                {/* Left stage: Request Builder Panel */}
                <Panel defaultSize="55%" minSize="500px" className="flex flex-col bg-[#101419] h-full overflow-hidden min-w-0">
                  <TabBar />
                  <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden min-h-0">
                    <UrlBar />
                    <RequestPane />
                  </div>
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
            )}
          </Panel>

        </Group>
      </div>
      <EnvironmentModal />
      <SaveRequestModal />
      <ToastList />
    </div>
  );
}

export default App;
