import React, { useState, useEffect, useRef, useMemo } from "react";
import { useProjectsStore, SavedRequest } from "../../store/projectsStore";
import { useEnvStore, getGroupFromId, openEnvironmentWindow } from "../../store/envStore";
import { useRequestStore, BoltRequest } from "../../store/requestStore";
import { useHistoryStore } from "../../store/historyStore";
import { useToastStore } from "../../store/toastStore";
import { buildCurlCommand, isCurlCommand } from "../../utils/curl";
import {
  CommandCategory,
  CommandItem,
  ScoredCommandItem,
  searchCommands,
  highlightMatches,
  parsePaletteQuery,
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
  FileCode,
} from "lucide-react";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateSidebar?: (tab: "workspace" | "environments" | "history") => void;
  onOpenDiff?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateSidebar,
  onOpenDiff,
}) => {
  const { projects, setSaveModalOpen } = useProjectsStore();
  const { environments, activeId, setActiveId, getFlatActiveVariables } = useEnvStore();
  const {
    theme,
    setTheme,
    sendRequest,
    openTab,
    closeTab,
    activeTabId,
    activeRequest,
    response,
    setSslVerify,
    importCurl,
  } = useRequestStore();
  const { clearHistory } = useHistoryStore();
  const { showToast } = useToastStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Focus input and reset query whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Aggregate all command items
  const allCommands: CommandItem[] = useMemo(() => {
    const actionItems = extractQuickActionCommands({
      hasActiveRequest: !!activeRequest.url,
      hasResponse: !!response,
      sslVerify: activeRequest.ssl_verify ?? true,
    });
    const reqItems = extractProjectRequests(projects);
    const envItems = extractEnvironmentCommands(environments, activeId);
    const themeItems = extractThemeCommands(theme);
    const navItems = extractNavigationCommands();

    return [...actionItems, ...reqItems, ...envItems, ...themeItems, ...navItems];
  }, [projects, environments, activeId, theme, activeRequest, response]);

  // Run fuzzy search and category parsing
  const searchResults: ScoredCommandItem[] = useMemo(() => {
    return searchCommands(allCommands, query, 80);
  }, [allCommands, query]);

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

      case "theme": {
        const themeId: string = item.data.themeId;
        setTheme(themeId);
        showToast(`Theme switched to ${item.title}`, "info");
        break;
      }

      case "navigation": {
        if (onNavigateSidebar) {
          if (item.actionId === "nav_workspace") onNavigateSidebar("workspace");
          else if (item.actionId === "nav_environments") onNavigateSidebar("environments");
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
            if (activeRequest && activeRequest.url) {
              const cmd = buildCurlCommand(activeRequest);
              await navigator.clipboard.writeText(cmd);
              showToast("cURL command copied to clipboard", "success");
            } else {
              showToast("No active request to export", "error");
            }
            break;
          }

          case "toggle_ssl": {
            const current = activeRequest.ssl_verify ?? true;
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
            const activeGroup = activeId ? getGroupFromId(activeId) : "production";
            openEnvironmentWindow(activeGroup);
            break;
          }
        }
        break;
      }
    }
  };

  // Keyboard navigation handler inside the palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      onClose();
    }
  };

  if (!isOpen) return null;

  const { filterCategory } = parsePaletteQuery(query);

  const getCategoryIcon = (category: CommandCategory, badge?: string) => {
    switch (category) {
      case "request":
        return badge ? (
          <span className={`text-[10px] font-black w-8 text-left ${getMethodColor(badge)}`}>
            {badge}
          </span>
        ) : (
          <FileCode size={14} className="text-text-accent flex-shrink-0" />
        );
      case "action":
        return <Zap size={14} className="text-amber-400 flex-shrink-0" />;
      case "environment":
        return <Globe size={14} className="text-blue-400 flex-shrink-0" />;
      case "theme":
        return <Palette size={14} className="text-purple-400 flex-shrink-0" />;
      case "navigation":
        return <Layers size={14} className="text-emerald-400 flex-shrink-0" />;
    }
  };

  const handleSetPrefix = (prefix: string) => {
    setQuery(prefix);
    inputRef.current?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-start justify-center pt-[10vh] p-4 select-none font-sans"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl bg-bg-secondary border border-border-primary rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-slide-up"
      >
        {/* Search Input Bar */}
        <div className="h-14 border-b border-border-primary bg-bg-secondary px-4 flex items-center space-x-3 flex-shrink-0">
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

        {/* Category Quick Filter Pills */}
        <div className="border-b border-border-primary bg-bg-tertiary/60 px-4 py-1.5 flex items-center space-x-1.5 overflow-x-auto text-[11px] flex-shrink-0">
          <button
            type="button"
            onClick={() => handleSetPrefix("")}
            className={`px-2 py-0.5 rounded border transition ${
              !filterCategory
                ? "bg-bg-secondary border-text-accent text-text-accent font-medium"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => handleSetPrefix("> ")}
            className={`px-2 py-0.5 rounded border transition flex items-center space-x-1 ${
              filterCategory === "action"
                ? "bg-bg-secondary border-text-accent text-text-accent font-medium"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Zap size={11} className="text-amber-400" />
            <span>Actions ({">"})</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetPrefix("req: ")}
            className={`px-2 py-0.5 rounded border transition flex items-center space-x-1 ${
              filterCategory === "request"
                ? "bg-bg-secondary border-text-accent text-text-accent font-medium"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            <FileCode size={11} className="text-blue-400" />
            <span>Requests (req:)</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetPrefix("env: ")}
            className={`px-2 py-0.5 rounded border transition flex items-center space-x-1 ${
              filterCategory === "environment"
                ? "bg-bg-secondary border-text-accent text-text-accent font-medium"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Globe size={11} className="text-emerald-400" />
            <span>Environments (env:)</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetPrefix("theme: ")}
            className={`px-2 py-0.5 rounded border transition flex items-center space-x-1 ${
              filterCategory === "theme"
                ? "bg-bg-secondary border-text-accent text-text-accent font-medium"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Palette size={11} className="text-purple-400" />
            <span>Themes (theme:)</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetPrefix("nav: ")}
            className={`px-2 py-0.5 rounded border transition flex items-center space-x-1 ${
              filterCategory === "navigation"
                ? "bg-bg-secondary border-text-accent text-text-accent font-medium"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Layers size={11} className="text-cyan-400" />
            <span>Navigation (nav:)</span>
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto py-1">
          {searchResults.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Search size={24} className="text-text-tertiary/40 mx-auto mb-2" />
              <p className="text-xs text-text-secondary font-medium">
                No matching commands or requests found
              </p>
              <p className="text-[11px] text-text-tertiary mt-1">
                Try searching with &gt; for actions, req: for requests, or env: for environments.
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

              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onClick={() => executeCommand(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-4 py-2 flex items-center justify-between cursor-pointer transition border-l-2 ${
                    isSelected
                      ? "bg-bg-tertiary border-text-accent"
                      : "border-transparent hover:bg-bg-tertiary/40"
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    {/* Category Icon or Method Badge */}
                    <div className="w-8 flex items-center justify-center flex-shrink-0">
                      {getCategoryIcon(item.category, item.badge)}
                    </div>

                    {/* Title & Subtitle */}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-text-primary truncate">
                        {titleSegments.map((seg, i) =>
                          seg.isMatch ? (
                            <span
                              key={i}
                              className="text-text-accent font-bold underline decoration-text-accent/40"
                            >
                              {seg.text}
                            </span>
                          ) : (
                            <span key={i}>{seg.text}</span>
                          )
                        )}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-text-tertiary truncate">
                          {subtitleSegments.map((seg, i) =>
                            seg.isMatch ? (
                              <span key={i} className="text-text-accent font-semibold">
                                {seg.text}
                              </span>
                            ) : (
                              <span key={i}>{seg.text}</span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Metadata / Shortcut / Status */}
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-bg-secondary border border-border-primary text-text-tertiary">
                        {item.shortcut}
                      </kbd>
                    )}

                    {item.badge && item.category !== "request" && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-secondary border border-border-primary ${
                          item.badgeColor || "text-text-secondary"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {isSelected && (
                      <div className="text-text-accent p-0.5 rounded">
                        <CornerDownLeft size={13} />
                      </div>
                    )}
                  </div>
                </div>
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
