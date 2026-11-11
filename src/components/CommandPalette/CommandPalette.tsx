import React, { useState, useEffect, useRef, useMemo } from "react";
import { useProjectsStore, SavedRequest } from "../../store/projectsStore";
import { useEnvStore, openEnvironmentWindow } from "../../store/envStore";
import { useRequestStore, BoltRequest } from "../../store/requestStore";
import { useHistoryStore } from "../../store/historyStore";
import { useToastStore } from "../../store/toastStore";
import { usePaletteStore } from "../../store/paletteStore";
import { buildCurlCommand, isCurlCommand } from "../../utils/curl";
import {
  CommandCategory,
  CommandItem,
  ScoredCommandItem,
  searchCommands,
  highlightMatches,
  extractProjectRequests,
  extractEnvironmentCommands,
  extractThemeCommands,
  extractQuickActionCommands,
  extractNavigationCommands,
  getMethodColor,
} from "../../utils/commandPalette";
import {
  Search,
  Zap,
  Globe,
  Palette,
  Layers,
  CornerDownLeft,
  X,
  Send,
  Plus,
  Save,
  Terminal,
  Copy,
  ShieldCheck,
  ShieldAlert,
  GitCompare,
  Trash2,
  Sliders,
  FolderTree,
  Folder,
  History,
} from "lucide-react";

export interface CommandPaletteProps {
  isOpen?: boolean;
  onClose?: () => void;
  onNavigateSidebar?: (tab: "workspace" | "history") => void;
  onOpenDiff?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onNavigateSidebar,
  onOpenDiff,
}) => {
  const storeIsOpen = usePaletteStore((state) => state.isOpen);
  const storeClose = usePaletteStore((state) => state.close);
  const isOpen = propIsOpen !== undefined ? propIsOpen : storeIsOpen;
  const onClose = propOnClose || storeClose;

  const { projects, setSaveModalOpen } = useProjectsStore();
  const environments = useEnvStore((state) => state.environments);
  const activeId = useEnvStore((state) => state.activeId);
  const setActiveId = useEnvStore((state) => state.setActiveId);
  const getFlatActiveVariables = useEnvStore((state) => state.getFlatActiveVariables);

  const setTheme = useRequestStore((state) => state.setTheme);
  const sendRequest = useRequestStore((state) => state.sendRequest);
  const openTab = useRequestStore((state) => state.openTab);
  const closeTab = useRequestStore((state) => state.closeTab);
  const activeTabId = useRequestStore((state) => state.activeTabId);
  const hasActiveUrl = useRequestStore((state) => !!state.activeRequest.url);
  const hasResponse = useRequestStore((state) => !!state.response);
  const sslVerify = useRequestStore((state) => state.activeRequest.ssl_verify ?? true);
  const setSslVerify = useRequestStore((state) => state.setSslVerify);
  const importCurl = useRequestStore((state) => state.importCurl);

  const { clearHistory } = useHistoryStore();
  const { showToast } = useToastStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const initialThemeRef = useRef<string>(useRequestStore.getState().theme);
  const isThemeCommittedRef = useRef<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Focus input and reset query whenever modal opens; capture initial theme
  useEffect(() => {
    if (isOpen) {
      initialThemeRef.current = useRequestStore.getState().theme;
      isThemeCommittedRef.current = false;
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      if (!isThemeCommittedRef.current && initialThemeRef.current) {
        if (useRequestStore.getState().theme !== initialThemeRef.current) {
          setTheme(initialThemeRef.current, { persist: false });
        }
      }
    }
  }, [isOpen, setTheme]);

  // Clean up on unmount: restore initial theme if not committed
  useEffect(() => {
    return () => {
      if (!isThemeCommittedRef.current && initialThemeRef.current) {
        if (useRequestStore.getState().theme !== initialThemeRef.current) {
          setTheme(initialThemeRef.current, { persist: false });
        }
      }
    };
  }, [setTheme]);

  // Aggregate all command items (only when modal is open to avoid background work)
  const allCommands: CommandItem[] = useMemo(() => {
    if (!isOpen) return [];
    const actionItems = extractQuickActionCommands({
      hasActiveRequest: hasActiveUrl,
      hasResponse: hasResponse,
      sslVerify: sslVerify,
    });
    const reqItems = extractProjectRequests(projects);
    const envItems = extractEnvironmentCommands(environments, activeId);
    const themeItems = extractThemeCommands(initialThemeRef.current || useRequestStore.getState().theme);
    const navItems = extractNavigationCommands();

    return [...actionItems, ...reqItems, ...envItems, ...themeItems, ...navItems];
  }, [isOpen, projects, environments, activeId, hasActiveUrl, hasResponse, sslVerify]);

  // Run fuzzy search and category parsing
  const searchResults: ScoredCommandItem[] = useMemo(() => {
    if (!isOpen || allCommands.length === 0) return [];
    return searchCommands(allCommands, query, 80);
  }, [isOpen, allCommands, query]);

  // Live theme preview as user moves up/down or hovers over theme options
  useEffect(() => {
    if (!isOpen) return;
    const current = searchResults[selectedIndex];
    if (current && current.item.category === "theme" && current.item.data?.themeId) {
      const targetTheme = current.item.data.themeId;
      if (useRequestStore.getState().theme !== targetTheme) {
        setTheme(targetTheme, { persist: false });
      }
    } else {
      if (useRequestStore.getState().theme !== initialThemeRef.current) {
        setTheme(initialThemeRef.current, { persist: false });
      }
    }
  }, [selectedIndex, searchResults, isOpen, setTheme]);

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= searchResults.length) {
      setSelectedIndex(Math.max(0, searchResults.length - 1));
    }
  }, [searchResults.length, selectedIndex]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const targetEl = itemRefs.current[selectedIndex];
    if (targetEl) {
      targetEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Handle command execution
  const executeCommand = async (item: CommandItem) => {
    if (item.category === "theme") {
      isThemeCommittedRef.current = true;
      const themeId: string = item.data.themeId;
      setTheme(themeId, { persist: true });
      showToast(`Theme switched to ${item.title}`, "info");
      onClose();
      return;
    }

    // Revert uncommitted preview if any other command executed
    if (!isThemeCommittedRef.current && initialThemeRef.current) {
      if (useRequestStore.getState().theme !== initialThemeRef.current) {
        setTheme(initialThemeRef.current, { persist: false });
      }
    }

    onClose();

    switch (item.category) {
      case "request": {
        const req: SavedRequest = item.data.request;
        const boltReq: BoltRequest = {
          id: req.id,
          name: req.name,
          method: req.method,
          url: req.url,
          headers: req.headers || [],
          params: req.params || [],
          body: req.body || { type: "None" },
          auth: req.auth || { type: "None" },
          ssl_verify: true,
        };
        openTab(boltReq);
        showToast(`Opened "${req.name || req.url}"`, "info");
        break;
      }

      case "environment": {
        const envId: string | null = item.data.environmentId;
        await setActiveId(envId);
        showToast(
          envId ? `Switched environment to ${item.title}` : "Cleared active environment",
          "success"
        );
        break;
      }

      case "navigation": {
        if (item.actionId === "nav_environments") {
          openEnvironmentWindow(useEnvStore.getState().activeGroup);
        } else if (onNavigateSidebar) {
          if (item.actionId === "nav_workspace") onNavigateSidebar("workspace");
          else if (item.actionId === "nav_history") onNavigateSidebar("history");
        }
        break;
      }

      case "action": {
        switch (item.actionId) {
          case "send_request":
            await sendRequest(getFlatActiveVariables());
            break;

          case "new_tab":
            openTab();
            showToast("Opened new request tab", "info");
            break;

          case "close_tab":
            if (activeTabId) {
              closeTab(activeTabId);
            }
            break;

          case "save_request":
            setSaveModalOpen(true);
            break;

          case "import_curl": {
            try {
              const text = await navigator.clipboard.readText();
              if (text && isCurlCommand(text)) {
                const ok = importCurl(text);
                if (ok) {
                  showToast("Imported request from cURL clipboard", "success");
                } else {
                  showToast("Failed to parse cURL command", "error");
                }
              } else {
                showToast("Clipboard does not contain a valid cURL command", "error");
              }
            } catch {
              showToast("Unable to read clipboard", "error");
            }
            break;
          }

          case "copy_curl": {
            const currentReq = useRequestStore.getState().activeRequest;
            if (currentReq && currentReq.url) {
              const cmd = buildCurlCommand(currentReq);
              await navigator.clipboard.writeText(cmd);
              showToast("cURL command copied to clipboard", "success");
            } else {
              showToast("No active request to export", "error");
            }
            break;
          }

          case "toggle_ssl": {
            const currentReq = useRequestStore.getState().activeRequest;
            const current = currentReq?.ssl_verify ?? true;
            setSslVerify(!current);
            showToast(`SSL verification ${!current ? "enabled" : "disabled"}`, "info");
            break;
          }

          case "open_diff": {
            if (onOpenDiff) {
              onOpenDiff();
            } else {
              showToast("Open Response view and click Diff", "info");
            }
            break;
          }

          case "clear_history":
            await clearHistory();
            showToast("Request history erased", "info");
            break;

          case "manage_environments": {
            const currentGroup = useEnvStore.getState().activeGroup;
            openEnvironmentWindow(currentGroup);
            break;
          }
        }
        break;
      }
    }
  };

  const handleDismiss = () => {
    if (!isThemeCommittedRef.current && initialThemeRef.current) {
      if (useRequestStore.getState().theme !== initialThemeRef.current) {
        setTheme(initialThemeRef.current, { persist: false });
      }
    }
    onClose();
  };

  // Keyboard navigation handler inside the palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isKeyK =
      e.code === "KeyK" ||
      e.keyCode === 75 ||
      e.which === 75 ||
      (typeof e.key === "string" && e.key.toLowerCase() === "k");
    if (isCtrlOrMeta && isKeyK && !e.altKey) {
      e.preventDefault();
      handleDismiss();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % searchResults.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = searchResults[selectedIndex];
      if (current) {
        executeCommand(current.item);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleDismiss();
    }
  };

  if (!isOpen) return null;

  const getItemVisual = (item: CommandItem, isSelected: boolean) => {
    if (item.category === "request" && item.badge) {
      const method = item.badge.toUpperCase();
      const colorClass = getMethodColor(method);

      return (
        <span
          className={`w-9 text-left font-mono text-[11px] font-extrabold tracking-wide flex-shrink-0 ${colorClass}`}
        >
          {method}
        </span>
      );
    }

    let iconColor = isSelected ? "text-text-primary" : "text-text-secondary";

    // Green whenever needed
    if (item.actionId === "send_request") {
      iconColor = "text-emerald-400";
    }
    // Red for remove or delete
    else if (item.actionId === "close_tab" || item.actionId === "clear_history") {
      iconColor = "text-red-400";
    }

    let iconNode = <Zap size={15} className={iconColor} />;

    if (item.category === "action") {
      switch (item.actionId) {
        case "send_request":
          iconNode = <Send size={15} className={iconColor} />;
          break;
        case "new_tab":
          iconNode = <Plus size={15} className={iconColor} />;
          break;
        case "close_tab":
          iconNode = <X size={15} className={iconColor} />;
          break;
        case "save_request":
          iconNode = <Save size={15} className={iconColor} />;
          break;
        case "import_curl":
          iconNode = <Terminal size={15} className={iconColor} />;
          break;
        case "copy_curl":
          iconNode = <Copy size={15} className={iconColor} />;
          break;
        case "toggle_ssl":
          iconNode = item.badge?.includes("Strict") ? (
            <ShieldCheck size={15} className="text-emerald-400" />
          ) : (
            <ShieldAlert size={15} className={iconColor} />
          );
          break;
        case "open_diff":
          iconNode = <GitCompare size={15} className={iconColor} />;
          break;
        case "clear_history":
          iconNode = <Trash2 size={15} className={iconColor} />;
          break;
        case "manage_environments":
          iconNode = <Sliders size={15} className={iconColor} />;
          break;
        default:
          iconNode = <Zap size={15} className={iconColor} />;
      }
    } else if (item.category === "environment") {
      iconNode = <Globe size={15} className={iconColor} />;
    } else if (item.category === "theme") {
      iconNode = <Palette size={15} className={iconColor} />;
    } else if (item.category === "navigation") {
      if (item.actionId === "nav_workspace") {
        iconNode = <FolderTree size={15} className={iconColor} />;
      } else if (item.actionId === "nav_history") {
        iconNode = <History size={15} className={iconColor} />;
      } else {
        iconNode = <Layers size={15} className={iconColor} />;
      }
    }

    return (
      <div className="w-5 flex items-center justify-center flex-shrink-0">
        {iconNode}
      </div>
    );
  };

  const renderShortcutKeycaps = (shortcut: string) => {
    const parts = shortcut.split("+");
    return (
      <div className="flex items-center space-x-1">
        {parts.map((p, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="text-[10px] text-text-tertiary/60 font-mono">+</span>}
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-bg-primary/90 border border-border-primary text-text-secondary shadow-2xs">
              {p}
            </kbd>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const categoryLabels: Record<CommandCategory, string> = {
    action: "Actions",
    request: "Saved Requests",
    environment: "Environments",
    theme: "Themes",
    navigation: "Navigation",
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[10vh] p-4 select-none font-sans"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          handleDismiss();
        }
      }}
    >
      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl bg-bg-secondary border border-border-primary rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-slide-up"
      >
        {/* Search Input Bar */}
        <div className="h-14 border-b border-border-primary bg-bg-secondary px-4 flex items-center space-x-3 flex-shrink-0 rounded-t-xl">
          <Search size={18} className="text-text-accent flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, request, or environment (use > for actions)..."
            className="flex-1 bg-transparent border-none text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 text-text-tertiary hover:text-text-primary rounded transition"
              title="Clear input"
            >
              <X size={15} />
            </button>
          ) : (
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-bg-tertiary border border-border-primary text-text-tertiary">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
          {searchResults.length === 0 ? (
            <div className="py-14 px-4 text-center select-none">
              <div className="w-12 h-12 rounded-full bg-bg-tertiary/60 border border-border-primary/60 flex items-center justify-center mx-auto mb-3 text-text-tertiary">
                <Search size={20} />
              </div>
              <p className="text-xs text-text-primary font-medium">
                No matching commands or requests found
              </p>
              <p className="text-[11px] text-text-tertiary mt-1 max-w-xs mx-auto leading-relaxed">
                Try searching with <code className="text-text-accent font-mono">&gt;</code> for actions, <code className="text-text-accent font-mono">req:</code> for requests, or <code className="text-text-accent font-mono">env:</code> for environments.
              </p>
            </div>
          ) : (
            searchResults.map((res, index) => {
              const isSelected = index === selectedIndex;
              const { item, titleMatches, subtitleMatches } = res;
              const titleSegments = highlightMatches(item.title, titleMatches);
              const subtitleSegments = item.subtitle
                ? highlightMatches(item.subtitle, subtitleMatches || [])
                : [];
              const prevCategory = index > 0 ? searchResults[index - 1].item.category : null;
              const showCategoryHeader = item.category !== prevCategory;

              return (
                <React.Fragment key={item.id}>
                  {showCategoryHeader && (
                    <div
                      className={`px-3 flex items-center space-x-3 select-none ${
                        index === 0 ? "pt-2 pb-1.5" : "pt-4 pb-1.5"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-text-accent">
                        {categoryLabels[item.category] || item.category}
                      </span>
                      <div className="flex-1 h-px bg-border-primary/60" />
                    </div>
                  )}

                  <div
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    onClick={() => executeCommand(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`group my-0.5 px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors duration-75 select-none ${
                      isSelected
                        ? "bg-bg-tertiary/90 border border-border-primary/80 shadow-xs"
                        : "border border-transparent hover:bg-bg-tertiary/40"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      {/* Bare Icon or Method Name */}
                      {getItemVisual(item, isSelected)}

                      {/* Title & Subtitle */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-xs truncate ${
                              isSelected
                                ? "text-text-primary font-semibold"
                                : "text-text-primary/90 font-medium"
                            }`}
                          >
                            {titleSegments.map((seg, i) =>
                              seg.isMatch ? (
                                <span
                                  key={i}
                                  className="text-text-accent font-bold underline decoration-text-accent/50 underline-offset-2"
                                >
                                  {seg.text}
                                </span>
                              ) : (
                                <span key={i}>{seg.text}</span>
                              )
                            )}
                          </span>
                        </div>

                        {item.subtitle && (
                          <div className="flex items-center space-x-1 text-[11px] text-text-tertiary truncate mt-0.5">
                            {item.category === "request" && (
                              <Folder size={11} className="text-text-tertiary/60 flex-shrink-0" />
                            )}
                            <span className="truncate">
                              {subtitleSegments.map((seg, i) =>
                                seg.isMatch ? (
                                  <span key={i} className="text-text-accent font-semibold">
                                    {seg.text}
                                  </span>
                                ) : (
                                  <span key={i}>{seg.text}</span>
                                )
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Metadata / Shortcut / Status / Enter */}
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
                      {item.shortcut && renderShortcutKeycaps(item.shortcut)}

                      {item.badge && item.category !== "request" && (
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center space-x-1.5 ${
                            item.badge === "Active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                              : item.badgeColor
                              ? `${item.badgeColor} bg-bg-primary/80 border-border-primary/80`
                              : "text-text-secondary bg-bg-primary/80 border-border-primary/80"
                          }`}
                        >
                          {item.badge === "Active" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          <span>{item.badge}</span>
                        </span>
                      )}

                      {isSelected && (
                        <kbd
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-text-accent/15 border border-text-accent/30 text-text-accent flex items-center justify-center shadow-2xs font-bold"
                          title="Press Enter to execute"
                        >
                          <CornerDownLeft size={11} />
                        </kbd>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="h-9 border-t border-border-primary bg-bg-tertiary px-4 flex items-center justify-between text-[11px] text-text-tertiary flex-shrink-0">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="font-mono bg-bg-secondary px-1 py-0.2 rounded border border-border-primary">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="font-mono bg-bg-secondary px-1 py-0.2 rounded border border-border-primary">
                ↵
              </kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="font-mono bg-bg-secondary px-1 py-0.2 rounded border border-border-primary">
                Esc
              </kbd>
              <span>Close</span>
            </span>
          </div>

          <div>
            <span>
              {searchResults.length} {searchResults.length === 1 ? "command" : "commands"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
