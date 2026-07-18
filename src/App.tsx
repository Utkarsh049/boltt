import { useState, useRef, useEffect } from "react";
import { UrlBar } from "./components/UrlBar/UrlBar";
import { RequestPane } from "./components/RequestPane/RequestPane";
import { Palette, RefreshCw, Folder as FolderIcon, Globe, Clock, Eye, EyeOff, Plus, Minus, Square, X } from "lucide-react";
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
import { useProjectsStore } from "./store/projectsStore";
import { useHistoryStore } from "./store/historyStore";
import { HistoryPanel } from "./components/HistoryPanel/HistoryPanel";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ToastList } from "./components/Toast/Toast";
import { useToastStore } from "./store/toastStore";

type SidebarTab = "workspace" | "environments" | "history";

function App() {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("workspace");
  const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
  const responsePanelRef = useRef<PanelImperativeHandle>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isAppLoading, setIsAppLoading] = useState(true);

  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const initialThemeRef = useRef<string | null>(null);
  const theme = useRequestStore((state) => state.theme);
  const setTheme = useRequestStore((state) => state.setTheme);

  // Sync theme class list on mount
  useEffect(() => {
    let savedTheme = localStorage.getItem("boltt-theme") || "dark";
    if (savedTheme === "one-dark-glass") {
      savedTheme = "glass";
      localStorage.setItem("boltt-theme", "glass");
    }
    const validThemes = ["dark", "light", "nord", "dracula", "space", "glass"];
    if (!validThemes.includes(savedTheme)) {
      savedTheme = "dark";
      setTheme("dark");
    }
    const root = document.documentElement;
    root.className = "";
    if (savedTheme !== "dark") {
      root.classList.add(`theme-${savedTheme}`);
    }
  }, [setTheme]);

  // Theme dropdown click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        if (isThemeDropdownOpen && initialThemeRef.current) {
          setTheme(initialThemeRef.current);
        }
        setIsThemeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isThemeDropdownOpen, setTheme]);

  // Listen to global theme-changed events (for multi-window synchronization)
  useEffect(() => {
    let active = true;
    let unlistenFn: (() => void) | undefined;

    const setupListener = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const fn = await listen<string>("theme-changed", (event) => {
        const currentTheme = useRequestStore.getState().theme;
        const newTheme = event.payload;
        if (newTheme !== currentTheme) {
          setTheme(newTheme);
        }
      });
      if (!active) {
        fn();
      } else {
        unlistenFn = fn;
      }
    };
    setupListener();

    return () => {
      active = false;
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [setTheme]);

  const response = useRequestStore((state) => state.response);
  const isLoading = useRequestStore((state) => state.isLoading);
  const tabs = useRequestStore((state) => state.tabs);
  const activeRequest = useRequestStore((state) => state.activeRequest);
  const openTab = useRequestStore((state) => state.openTab);

  const loadEnvironments = useEnvStore((state) => state.loadEnvironments);
  const activeGroup = useEnvStore((state) => state.activeGroup);
  const groupActiveIds = useEnvStore((state) => state.groupActiveIds);
  const setActiveGroup = useEnvStore((state) => state.setActiveGroup);
  const environments = useEnvStore((state) => state.environments);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        useProjectsStore.getState().loadProjects(),
        useEnvStore.getState().loadEnvironments(),
        useHistoryStore.getState().loadHistory(),
      ]);
      useToastStore.getState().showToast("Workspace synchronized with filesystem", "success");
    } catch (err) {
      console.error("Failed to refresh workspace:", err);
      useToastStore.getState().showToast("Failed to sync workspace", "error");
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  const getInitialWindowLabel = () => {
    try {
      return getCurrentWindow().label;
    } catch (e) {
      return "main";
    }
  };

  const [windowLabel] = useState<string>(getInitialWindowLabel);

  // Load environments and history from backend on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        await Promise.all([
          loadEnvironments(),
          useProjectsStore.getState().loadProjects(),
          useHistoryStore.getState().loadHistory(),
        ]);
      } catch (err) {
        console.error("Initialization failed:", err);
      } finally {
        setTimeout(() => {
          setIsAppLoading(false);
        }, 550);
      }
    };
    initApp();

    // Listen to environments-updated global event
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("environments-updated", () => {
        useEnvStore.getState().loadEnvironments();
      }).then((fn) => {
        unlisten = fn;
      });
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [loadEnvironments]);

  // Disable user zoom behavior (Ctrl/Cmd + wheel zoom, trackpad pinch, and Ctrl/Cmd + Plus/Minus/0 shortcuts)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "=" || e.key === "-" || e.key === "+" || e.key === "0")
      ) {
        e.preventDefault();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("touchstart", handleTouchStart, { passive: false, capture: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });
    document.addEventListener("gesturestart", handleGesture, { passive: false, capture: true });
    document.addEventListener("gesturechange", handleGesture, { passive: false, capture: true });
    document.addEventListener("gestureend", handleGesture, { passive: false, capture: true });

    return () => {
      document.removeEventListener("wheel", handleWheel, { capture: true });
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("touchstart", handleTouchStart, { capture: true });
      document.removeEventListener("touchmove", handleTouchMove, { capture: true });
      document.removeEventListener("gesturestart", handleGesture, { capture: true });
      document.removeEventListener("gesturechange", handleGesture, { capture: true });
      document.removeEventListener("gestureend", handleGesture, { capture: true });
    };
  }, []);

  // Listen to network status (Online/Offline) changes
  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
    };
    window.addEventListener("online", handleStatusChange);
    window.addEventListener("offline", handleStatusChange);
    return () => {
      window.removeEventListener("online", handleStatusChange);
      window.removeEventListener("offline", handleStatusChange);
    };
  }, []);

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
      await useProjectsStore.getState().importProjects();
    } catch (err) {
      console.error("Import failed:", err);
      useToastStore.getState().showToast(`Failed to import projects: ${err}`, "error");
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

        const activeRequest = useRequestStore.getState().activeRequest;
        const { tabs } = useRequestStore.getState();
        if (tabs.length === 0) return; // No active request to save

        if (!activeRequest.id) {
          useProjectsStore.getState().setSaveModalOpen(true);
          return;
        }

        const saved = await useProjectsStore.getState().saveRequestDirectly(activeRequest);
        if (saved) {
          useRequestStore.getState().markTabClean(activeRequest.id);
          useToastStore.getState().showToast("Request saved", "success");
          console.log("Saved request directly via keyboard shortcut!");
        } else {
          useProjectsStore.getState().setSaveModalOpen(true);
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

  const handleToggleMaximize = async () => {
    try {
      const window = getCurrentWindow();
      if (await window.isMaximized()) {
        await window.unmaximize();
      } else {
        await window.maximize();
      }
    } catch (err) {
      console.error("Failed to toggle maximize:", err);
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("a") ||
        target.closest(".custom-interactive")
      ) {
        return;
      }
      try {
        getCurrentWindow().startDragging();
      } catch (err) {
        console.error("Failed to start window drag:", err);
      }
    }
  };

  const handleHeaderDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("a") ||
      target.closest(".custom-interactive")
    ) {
      return;
    }
    handleToggleMaximize();
  };

  if (isAppLoading) {
    return (
      <div className="h-screen w-screen bg-bg-primary text-text-primary flex flex-col font-sans overflow-hidden select-none animate-pulse">
        {/* Header bar skeleton */}
        <header className="h-12 border-b border-border-primary flex items-center justify-between px-4 bg-bg-tertiary flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-bg-tertiary rounded-full" />
            <div className="w-16 h-3 bg-bg-tertiary rounded" />
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-24 h-6 bg-bg-tertiary rounded-sm" />
            <div className="w-6 h-6 bg-bg-tertiary rounded-sm" />
            <div className="w-6 h-6 bg-bg-tertiary rounded-sm" />
            <div className="w-16 h-4 bg-bg-tertiary rounded" />
          </div>
        </header>

        {/* Workspace body skeleton */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar skeleton */}
          <div className="w-[300px] border-r border-border-primary bg-bg-secondary flex flex-col h-full flex-shrink-0 p-3 space-y-4">
            <div className="h-7 bg-bg-tertiary rounded-sm w-full" />
            <div className="flex items-center justify-between">
              <div className="w-12 h-3 bg-bg-tertiary rounded" />
              <div className="w-10 h-4 bg-bg-tertiary rounded-sm" />
            </div>
            <div className="space-y-2.5">
              <div className="h-5 bg-bg-tertiary/60 rounded-sm w-4/5" />
              <div className="h-5 bg-bg-tertiary/60 rounded-sm w-3/4 pl-4" />
              <div className="h-5 bg-bg-tertiary/60 rounded-sm w-2/3 pl-4" />
              <div className="h-5 bg-bg-tertiary/60 rounded-sm w-5/6" />
            </div>
          </div>

          {/* Main Content Pane skeleton */}
          <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden p-4 space-y-4">
            {/* Tabs bar skeleton */}
            <div className="flex space-x-2 h-7 items-center border-b border-border-primary/40 pb-2">
              <div className="w-20 h-5 bg-bg-tertiary rounded-sm" />
              <div className="w-20 h-5 bg-bg-tertiary/60 rounded-sm" />
              <div className="w-6 h-5 bg-bg-tertiary/40 rounded-sm" />
            </div>

            {/* URL bar skeleton */}
            <div className="flex space-x-2 items-center">
              <div className="w-16 h-9 bg-bg-tertiary rounded-sm" />
              <div className="flex-1 h-9 bg-bg-tertiary rounded-sm" />
              <div className="w-14 h-9 bg-bg-tertiary rounded-sm" />
              <div className="w-16 h-9 bg-bg-tertiary rounded-sm" />
            </div>

            {/* Editor Pane skeleton */}
            <div className="flex-1 border border-border-primary rounded-sm bg-bg-secondary/10 p-3 flex flex-col space-y-3">
              <div className="flex space-x-3 border-b border-border-primary/40 pb-2">
                <div className="w-12 h-4 bg-bg-tertiary rounded-sm" />
                <div className="w-12 h-4 bg-bg-tertiary/60 rounded-sm" />
                <div className="w-12 h-4 bg-bg-tertiary/60 rounded-sm" />
              </div>
              <div className="flex-1 bg-bg-primary/30 rounded-sm border border-border-primary/40 p-4 space-y-2">
                <div className="h-3 bg-bg-tertiary/40 rounded w-2/5" />
                <div className="h-3 bg-bg-tertiary/40 rounded w-3/5" />
                <div className="h-3 bg-bg-tertiary/40 rounded w-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (windowLabel.startsWith("env-")) {
    return <EnvironmentModal />;
  }

  return (
    <div className="h-screen w-screen bg-bg-primary text-text-primary flex flex-col font-sans overflow-hidden select-none">
      {/* Header bar */}
      <header
        onMouseDown={handleHeaderMouseDown}
        onDoubleClick={handleHeaderDoubleClick}
        className="h-12 border-b border-border-primary flex items-center justify-between px-4 bg-bg-tertiary flex-shrink-0 select-none cursor-default"
      >
        <div className="flex items-center space-x-2">
          <img src="/logo.svg" className="w-4 h-4 object-contain select-none" alt="Boltt Logo" />
          <span className="font-semibold text-sm tracking-wider text-text-accent">
            Boltt
          </span>
        </div>
        <div className="flex items-center space-x-3 text-xs text-[#c0c7d3]">
          <EnvironmentDropdown />
          <div className="relative" ref={themeDropdownRef}>
            <button
              onClick={() => {
                if (!isThemeDropdownOpen) {
                  initialThemeRef.current = theme;
                } else if (initialThemeRef.current) {
                  setTheme(initialThemeRef.current);
                }
                setIsThemeDropdownOpen(!isThemeDropdownOpen);
              }}
              className={`p-1 hover:bg-bg-hover rounded border border-transparent hover:border-border-primary transition cursor-pointer flex items-center justify-center ${isThemeDropdownOpen ? "bg-bg-hover border-border-primary" : ""}`}
              title="Select color theme"
            >
              <Palette size={14} className="text-text-secondary hover:text-text-primary" />
            </button>

            {isThemeDropdownOpen && (
              <div
                onMouseLeave={() => {
                  if (initialThemeRef.current) {
                    setTheme(initialThemeRef.current);
                  }
                }}
                className="absolute right-0 mt-1 w-40 bg-bg-secondary border border-border-primary rounded shadow-2xl z-50 py-1 font-sans flex flex-col"
              >
                {([
                  { id: "dark", name: "Dark Theme" },
                  { id: "light", name: "Light Theme" },
                  { id: "nord", name: "Nord Theme" },
                  { id: "dracula", name: "Dracula Theme" },
                  { id: "space", name: "Space Theme" },
                  { id: "glass", name: "Glass Theme" },
                ] as const).map((t) => {
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onMouseEnter={() => {
                        setTheme(t.id);
                      }}
                      onClick={() => {
                        initialThemeRef.current = t.id; // Commit the selection
                        setTheme(t.id);
                        setIsThemeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between transition cursor-pointer hover:bg-bg-tertiary/60 ${isSelected ? "text-text-accent font-semibold bg-bg-tertiary" : "text-text-primary"
                        }`}
                    >
                      <span>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 hover:bg-bg-hover rounded border border-transparent hover:border-border-primary transition cursor-pointer disabled:opacity-60"
            title="Sync workspace with filesystem"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-text-accent" : ""} />
          </button>
          <span className="text-xs select-none flex items-center space-x-1.5" title={isOnline ? "Connected to the internet" : "Disconnected from the internet"}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-[#4ade80]" : "bg-[#f87171]"}`} />
            <span>  :</span>
            <strong className={isOnline ? "text-[#4ade80]" : "text-[#f87171]"}>
              {isOnline ? "Online" : "Offline"}
            </strong>
          </span>
          <div className="flex items-center space-x-1 pl-2 border-l border-border-primary h-6">
            <button
              onClick={() => getCurrentWindow().minimize()}
              className="p-1 hover:bg-bg-hover rounded text-text-secondary hover:text-text-primary transition cursor-pointer flex items-center justify-center"
              title="Minimize"
            >
              <Minus size={16} />
            </button>
            <button
              onClick={handleToggleMaximize}
              className="p-1 hover:bg-bg-hover rounded text-text-secondary hover:text-text-primary transition cursor-pointer flex items-center justify-center"
              title="Maximize / Restore"
            >
              <Square size={13} />
            </button>
            <button
              onClick={() => getCurrentWindow().close()}
              className="p-1 hover:bg-[#ea3e3e]/20 hover:text-[#ff8080] rounded text-text-secondary transition cursor-pointer flex items-center justify-center"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
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
            className="flex flex-col bg-bg-secondary h-full overflow-hidden"
          >
            {/* Sidebar Horizontal Options Tabs */}
            <div className="flex border-b border-border-primary bg-bg-tertiary h-9 flex-shrink-0">
              <button
                onClick={() => setSidebarTab("workspace")}
                className={`flex-1 flex items-center justify-center text-[11px] font-semibold transition px-2 min-w-0 ${sidebarTab === "workspace"
                    ? "bg-bg-secondary text-text-accent"
                    : "text-text-secondary hover:text-text-primary"
                  }`}
               >
                 <FolderIcon size={13} className="flex-shrink-0" />
                 {sidebarTab === "workspace" && <span className="ml-1.5 truncate whitespace-nowrap">Workspace</span>}
               </button>
 
               <button
                 onClick={() => setSidebarTab("environments")}
                 className={`flex-1 flex items-center justify-center text-[11px] font-semibold transition px-2 min-w-0 ${sidebarTab === "environments"
                     ? "bg-bg-secondary text-text-accent"
                     : "text-text-secondary hover:text-text-primary"
                   }`}
               >
                 <Globe size={13} className="flex-shrink-0" />
                 {sidebarTab === "environments" && <span className="ml-1.5 truncate whitespace-nowrap">Environments</span>}
               </button>
 
               <button
                 onClick={() => setSidebarTab("history")}
                 className={`flex-1 flex items-center justify-center text-[11px] font-semibold transition px-2 min-w-0 ${sidebarTab === "history"
                     ? "bg-bg-secondary text-text-accent"
                     : "text-text-secondary hover:text-text-primary"
                   }`}
               >
                 <Clock size={13} className="flex-shrink-0" />
                 {sidebarTab === "history" && <span className="ml-1.5 truncate whitespace-nowrap">History</span>}
               </button>
             </div>
 
             {/* Sidebar Content Area */}
             <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
               {sidebarTab === "workspace" && (
                 <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                   {/* Projects tree area scrollable */}
                   <div className="flex-1 p-3 overflow-y-auto min-h-0">
                     <ProjectsTree />
                   </div>
                   {/* Pinned history panel at bottom */}
                   <div className="border-t border-border-primary p-3 bg-bg-secondary/50 flex-shrink-0">
                     <HistoryPanel limit={8} />
                   </div>
                 </div>
               )}

              {sidebarTab === "environments" && (
                <div className="flex-1 p-3 overflow-y-auto min-h-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-[#8b919d] uppercase tracking-wider">
                      Environments
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-xs">
                    {(["production", "staging", "local"] as const).map((group) => {
                      const isActiveGroup = activeGroup === group;
                      const activeEnvId = groupActiveIds[group];
                      const hasActiveEnv = activeEnvId !== null;
                      const activeEnvName = hasActiveEnv
                        ? environments.find((e) => e.id === activeEnvId)?.name
                        : null;

                      return (
                        <div
                          key={group}
                          onClick={() => setActiveGroup(group)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-sm cursor-pointer transition border ${isActiveGroup
                              ? "bg-bg-tertiary/50 border-border-primary text-text-accent"
                              : "border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/20"
                            }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="capitalize text-xs font-semibold">{group}</span>
                            {activeEnvName && (
                              <span className="text-[10px] text-text-secondary truncate font-mono mt-0.5">
                                {activeEnvName}
                              </span>
                            )}
                          </div>
                          {hasActiveEnv && (
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0 ml-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sidebarTab === "history" && (
                <div className="flex-1 p-3 overflow-y-auto min-h-0 flex flex-col">
                  <div className="text-[12px] font-bold text-text-secondary uppercase tracking-wider mb-2 flex-shrink-0">
                    Recent Requests
                  </div>
                  <div className="flex-1 min-h-0">
                    <HistoryPanel alwaysExpanded={true} limit={100} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-border-primary text-[12px] text-text-secondary bg-bg-tertiary/20 flex-shrink-0 flex items-center justify-between">
              <div>
                Press <kbd className="bg-bg-hover px-1.5 py-1 rounded text-text-primary font-mono">Ctrl+Enter</kbd> to Send
              </div>
              <button
                onClick={toggleResponsePane}
                className="flex items-center space-x-1 px-1.5 py-0.5 bg-bg-hover hover:bg-bg-hover-light border border-border-primary text-text-primary rounded-sm transition cursor-pointer"
                title={isResponseCollapsed ? "Expand Response Pane" : "Collapse Response Pane"}
              >
                {isResponseCollapsed ? (
                  <>
                    <Eye size={11} className="text-text-accent" />
                    <span>Show Resp</span>
                  </>
                ) : (
                  <>
                    <EyeOff size={11} className="text-text-secondary" />
                    <span>Hide Resp</span>
                  </>
                )}
              </button>
            </div>
          </Panel>

          {/* Resize Handle 1 */}
          <Separator className="w-2 hover:bg-text-accent/10 active:bg-text-accent/20 transition-all cursor-col-resize self-stretch flex-shrink-0 flex items-center justify-center">
            <div className="w-[1px] h-full bg-border-primary" />
          </Separator>

          {/* 2. Main Workstage Panel (Request Stage + Response Stage) */}
          <Panel className="h-full overflow-hidden">
            {tabs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary p-8 text-center select-none font-sans h-full relative overflow-hidden">
                {/* Background ambient glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="max-w-md w-full space-y-6 z-10">
                  {/* Glowing Lightning Bolt Container */}
                  <div className="relative inline-flex items-center justify-center p-6 bg-gradient-to-b from-blue-500/10 to-transparent border border-blue-500/20 rounded-full shadow-[0_0_50px_rgba(59,130,246,0.15)]">
                    <img src="/logo.svg" className="w-14 h-14 object-contain select-none" alt="Boltt Logo" />
                  </div>

                  <div className="space-y-2">
                    <h1 className="text-xl font-bold text-text-primary tracking-tight">
                      Start your first request
                    </h1>
                    <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
                      Create a request tab to start testing API endpoints, or open/import a collection project to organize your requests.
                    </p>
                  </div>

                  {/* Quick actions grid */}
                  <div className="grid grid-cols-1 gap-2.5 pt-2 max-w-[280px] mx-auto">
                    <button
                      onClick={() => openTab()}
                      className="flex items-center justify-center space-x-2 w-full py-2 bg-text-accent hover:bg-blue-300 text-[#00325a] rounded text-xs font-bold transition duration-150 cursor-pointer shadow-lg shadow-blue-950/20"
                    >
                      <Plus size={14} />
                      <span>Create a Request</span>
                    </button>

                    <div className="flex items-center space-x-2 text-xs text-text-secondary py-1 select-none">
                      <div className="flex-1 h-[1px] bg-border-primary/60"></div>
                      <span>OR</span>
                      <div className="flex-1 h-[1px] bg-border-primary/60"></div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent("create-project-dialog"))}
                        className="flex-1 py-2 bg-bg-tertiary hover:bg-bg-hover border border-border-primary text-text-primary hover:text-text-accent rounded text-xs font-semibold transition cursor-pointer"
                      >
                        New Project
                      </button>
                      <button
                        onClick={handleImportProject}
                        className="flex-1 py-2 bg-bg-tertiary hover:bg-bg-hover border border-border-primary text-text-primary hover:text-text-accent rounded text-xs font-semibold transition cursor-pointer"
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
                <Panel defaultSize="55%" minSize="300px" className="flex flex-col bg-bg-primary h-full overflow-hidden min-w-0">
                  <TabBar />
                  <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden min-h-0">
                    <UrlBar />
                    <RequestPane />
                  </div>
                </Panel>

                {/* Resize Handle 2 */}
                <Separator className="w-2 hover:bg-text-accent/10 active:bg-text-accent/20 transition-all cursor-col-resize self-stretch flex-shrink-0 flex items-center justify-center">
                  <div className="w-[1px] h-full bg-border-primary" />
                </Separator>

                {/* Right stage: Response Pane Panel */}
                <Panel
                  id="response-panel"
                  panelRef={responsePanelRef}
                  defaultSize={45}
                  minSize="250px"
                  collapsible={true}
                  onResize={(size) => {
                    setIsResponseCollapsed(size.inPixels === 0);
                  }}
                  className="flex flex-col p-4 bg-bg-secondary h-full overflow-hidden min-w-0"
                >
                  <ResponsePane />
                </Panel>

              </Group>
            )}
          </Panel>

        </Group>
      </div>
      <SaveRequestModal />
      <ToastList />
    </div>
  );
}

export default App;
