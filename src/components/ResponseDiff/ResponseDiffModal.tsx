import React, { useState, useMemo, useEffect, useRef } from "react";
import { BoltResponse, useRequestStore } from "../../store/requestStore";
import { useToastStore } from "../../store/toastStore";
import {
  diffResponses,
  ResponseDiffResult,
  HeaderDiff,
  SplitDiffRow,
  DiffLine,
} from "../../utils/diff";
import {
  GitCompare,
  X,
  Columns,
  AlignJustify,
  Clock,
  Layers,
  Edit3,
  ChevronDown,
  Check,
  Copy,
  ArrowRight,
  Filter,
  Sliders,
  AlertTriangle,
  Code2,
} from "lucide-react";

export interface ResponseDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentResponse: BoltResponse;
  currentRequestName?: string;
}

type BaselineSource = "previous" | "tab" | "custom";
type ViewMode = "split" | "unified";
type FilterMode = "all" | "changesOnly";

export const ResponseDiffModal: React.FC<ResponseDiffModalProps> = ({
  isOpen,
  onClose,
  currentResponse,
  currentRequestName = "Current Request",
}) => {
  const { tabs, activeTabId } = useRequestStore();
  const { showToast } = useToastStore();

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId]
  );

  // Eligible tabs with responses other than current
  const otherTabsWithResponses = useMemo(
    () => tabs.filter((t) => t.id !== activeTabId && t.response !== null),
    [tabs, activeTabId]
  );

  // Determine initial baseline source
  const [sourceType, setSourceType] = useState<BaselineSource>(() => {
    if (activeTab?.previousResponse) return "previous";
    if (otherTabsWithResponses.length > 0) return "tab";
    return "custom";
  });

  const [selectedTabId, setSelectedTabId] = useState<string>(() => {
    return otherTabsWithResponses[0]?.id || "";
  });

  const [customBody, setCustomBody] = useState<string>("{\n  \n}");
  const [customStatus, setCustomStatus] = useState<number>(200);
  const [customStatusText, setCustomStatusText] = useState<string>("OK");

  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [isHeaderDrawerOpen, setIsHeaderDrawerOpen] = useState(false);
  const [headerFilterOnlyChanges, setHeaderFilterOnlyChanges] = useState(false);
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const tabDropdownRef = useRef<HTMLDivElement>(null);

  // Reset or adjust initial source when modal opens
  useEffect(() => {
    if (isOpen) {
      if (activeTab?.previousResponse) {
        setSourceType("previous");
      } else if (otherTabsWithResponses.length > 0) {
        setSourceType("tab");
        setSelectedTabId(otherTabsWithResponses[0].id);
      } else {
        setSourceType("custom");
      }
      setIsTabDropdownOpen(false);
    }
  }, [isOpen, activeTab?.previousResponse, otherTabsWithResponses]);

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isTabDropdownOpen) {
          setIsTabDropdownOpen(false);
        } else {
          onClose();
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        tabDropdownRef.current &&
        !tabDropdownRef.current.contains(e.target as Node)
      ) {
        setIsTabDropdownOpen(false);
      }
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, isTabDropdownOpen]);

  // Resolve baseline response object
  const baselineResponse: BoltResponse | null = useMemo(() => {
    if (sourceType === "previous") {
      return activeTab?.previousResponse ?? null;
    }
    if (sourceType === "tab") {
      const found = tabs.find((t) => t.id === selectedTabId);
      return found?.response ?? null;
    }
    if (sourceType === "custom") {
      const bytes = new TextEncoder().encode(customBody).length;
      return {
        status: customStatus || 200,
        status_text: customStatusText || "OK",
        headers: [],
        body: customBody,
        time_ms: 0,
        size_bytes: bytes,
      };
    }
    return null;
  }, [
    sourceType,
    activeTab?.previousResponse,
    tabs,
    selectedTabId,
    customBody,
    customStatus,
    customStatusText,
  ]);

  // Compute diff result
  const diffResult: ResponseDiffResult | null = useMemo(() => {
    if (!baselineResponse) return null;
    return diffResponses(baselineResponse, currentResponse);
  }, [baselineResponse, currentResponse]);

  // Baseline title
  const baselineLabel = useMemo(() => {
    if (sourceType === "previous") return "Previous Run (in current tab)";
    if (sourceType === "tab") {
      const t = tabs.find((tab) => tab.id === selectedTabId);
      return t ? `${t.request.method} ${t.request.name || t.request.url}` : "Selected Tab";
    }
    return "Custom Baseline";
  }, [sourceType, selectedTabId, tabs]);

  // Filtered diffs according to filterMode
  const filteredSplitDiff: SplitDiffRow[] = useMemo(() => {
    if (!diffResult) return [];
    if (filterMode === "all") return diffResult.splitDiff;

    return diffResult.splitDiff.filter((row) => {
      const leftChanged = row.left && row.left.type !== "unchanged";
      const rightChanged = row.right && row.right.type !== "unchanged";
      const hasAddedOrRemoved = (!row.left && row.right) || (row.left && !row.right);
      return leftChanged || rightChanged || hasAddedOrRemoved;
    });
  }, [diffResult, filterMode]);

  const filteredUnifiedDiff: DiffLine[] = useMemo(() => {
    if (!diffResult) return [];
    if (filterMode === "all") return diffResult.unifiedDiff;
    return diffResult.unifiedDiff.filter((line) => line.type !== "unchanged");
  }, [diffResult, filterMode]);

  const filteredHeaders: HeaderDiff[] = useMemo(() => {
    if (!diffResult) return [];
    if (!headerFilterOnlyChanges) return diffResult.summary.headerDiffs;
    return diffResult.summary.headerDiffs.filter((h) => h.type !== "unchanged");
  }, [diffResult, headerFilterOnlyChanges]);

  // Status color helper
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-emerald-400 bg-emerald-500/10 border-emerald-800/40";
    if (status >= 300 && status < 400) return "text-blue-400 bg-blue-500/10 border-blue-800/40";
    if (status >= 400 && status < 500) return "text-amber-400 bg-amber-500/10 border-amber-800/40";
    if (status >= 500) return "text-red-400 bg-red-500/10 border-red-800/40";
    return "text-red-400 bg-red-500/10 border-red-500/30";
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "text-[#4ade80]";
      case "POST":
        return "text-[#fb923c]";
      case "PUT":
        return "text-[#60a5fa]";
      case "PATCH":
        return "text-[#c084fc]";
      case "DELETE":
        return "text-[#f87171]";
      default:
        return "text-[#8b919d]";
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    const safeIdx = Math.min(i, sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, safeIdx)).toFixed(1))} ${sizes[safeIdx]}`;
  };

  const formatDeltaBytes = (delta: number): string => {
    if (delta > 0) return `+${formatBytes(delta)}`;
    if (delta < 0) return `-${formatBytes(Math.abs(delta))}`;
    return "0 B";
  };

  const formatDeltaMs = (delta: number): string => {
    if (delta > 0) return `+${delta} ms`;
    if (delta < 0) return `${delta} ms`;
    return "0 ms";
  };

  // Copy summary to clipboard
  const handleCopySummary = () => {
    if (!diffResult || !baselineResponse) return;
    const { summary } = diffResult;
    const lines = [
      `Response Diff Summary:`,
      `Baseline: ${baselineLabel} (${baselineResponse.status} ${baselineResponse.status_text})`,
      `Current: ${currentRequestName} (${currentResponse.status} ${currentResponse.status_text})`,
      `Size Delta: ${formatDeltaBytes(summary.sizeDiff.deltaBytes)}`,
      `Latency Delta: ${formatDeltaMs(summary.timeDiff?.deltaMs || 0)}`,
      `Lines: +${summary.additions} / -${summary.deletions} (${summary.unchanged} unchanged)`,
      `Headers: ${summary.headerDiffs.filter((h) => h.type !== "unchanged").length} modified / ${summary.headerDiffs.length} total`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    showToast("Diff summary copied to clipboard", "success");
  };

  const handlePrettifyCustom = () => {
    try {
      const parsed = JSON.parse(customBody);
      setCustomBody(JSON.stringify(parsed, null, 2));
      showToast("Prettified custom JSON", "success");
    } catch {
      showToast("Invalid JSON in custom baseline", "error");
    }
  };

  const handleCopyCurrentToCustom = () => {
    setCustomBody(currentResponse.body);
    setCustomStatus(currentResponse.status);
    setCustomStatusText(currentResponse.status_text);
    showToast("Copied current response as custom baseline", "success");
  };

  if (!isOpen) return null;

  const headerDiffCount = diffResult
    ? diffResult.summary.headerDiffs.filter((h) => h.type !== "unchanged").length
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div
        ref={modalRef}
        className="w-[96vw] max-w-6xl h-[88vh] bg-bg-secondary border border-border-primary rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
      >
        {/* Header */}
        <div className="h-13 border-b border-border-primary bg-bg-tertiary flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 rounded-md bg-text-accent/10 border border-text-accent/20">
              <GitCompare size={16} className="text-text-accent flex-shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-xs uppercase tracking-wider text-text-primary">
                  Response Diff
                </span>
                {diffResult?.isIdentical && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Identical
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-tertiary truncate">
                Comparing current response with baseline
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {diffResult && (
              <button
                type="button"
                onClick={handleCopySummary}
                className="px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-secondary rounded border border-border-primary transition flex items-center space-x-1.5"
                title="Copy diff summary to clipboard"
              >
                <Copy size={13} />
                <span>Copy Summary</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded transition"
              title="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Toolbar: Source Selection & View Controls */}
        <div className="border-b border-border-primary bg-bg-secondary px-4 py-2 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          {/* Baseline Source Selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mr-1">
              Baseline:
            </span>

            <div className="inline-flex rounded-md border border-border-primary bg-bg-tertiary p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSourceType("previous")}
                className={`px-2.5 py-1 rounded transition flex items-center space-x-1.5 ${
                  sourceType === "previous"
                    ? "bg-bg-secondary text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Clock size={12} />
                <span>Previous Run</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceType("tab");
                  if (!selectedTabId && otherTabsWithResponses.length > 0) {
                    setSelectedTabId(otherTabsWithResponses[0].id);
                  }
                }}
                className={`px-2.5 py-1 rounded transition flex items-center space-x-1.5 ${
                  sourceType === "tab"
                    ? "bg-bg-secondary text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Layers size={12} />
                <span>Other Tab</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType("custom")}
                className={`px-2.5 py-1 rounded transition flex items-center space-x-1.5 ${
                  sourceType === "custom"
                    ? "bg-bg-secondary text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Edit3 size={12} />
                <span>Custom</span>
              </button>
            </div>

            {/* Other Tab Dropdown */}
            {sourceType === "tab" && (
              <div className="relative inline-block ml-2" ref={tabDropdownRef}>
                {otherTabsWithResponses.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
                      className="px-2.5 py-1 bg-bg-tertiary hover:bg-bg-hover text-text-primary border border-border-primary rounded text-xs flex items-center space-x-2 transition"
                    >
                      {(() => {
                        const curTab = tabs.find((t) => t.id === selectedTabId);
                        if (!curTab) return <span>Select a tab...</span>;
                        return (
                          <>
                            <span
                              className={`text-[10px] font-bold ${getMethodColor(
                                curTab.request.method
                              )}`}
                            >
                              {curTab.request.method}
                            </span>
                            <span className="truncate max-w-[140px] text-text-primary">
                              {curTab.request.name || curTab.request.url}
                            </span>
                            {curTab.response && (
                              <span
                                className={`text-[10px] px-1 py-0.2 rounded border ${getStatusColor(
                                  curTab.response.status
                                )}`}
                              >
                                {curTab.response.status}
                              </span>
                            )}
                          </>
                        );
                      })()}
                      <ChevronDown size={13} className="text-text-tertiary ml-1" />
                    </button>

                    {isTabDropdownOpen && (
                      <div className="absolute left-0 mt-1 w-64 bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                        {otherTabsWithResponses.map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setSelectedTabId(tab.id);
                              setIsTabDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-bg-tertiary transition ${
                              tab.id === selectedTabId ? "bg-bg-tertiary font-medium" : ""
                            }`}
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              <span
                                className={`text-[10px] font-bold ${getMethodColor(
                                  tab.request.method
                                )}`}
                              >
                                {tab.request.method}
                              </span>
                              <span className="truncate text-text-primary">
                                {tab.request.name || tab.request.url}
                              </span>
                            </div>
                            {tab.response && (
                              <span
                                className={`text-[10px] px-1 py-0.2 rounded border ml-2 flex-shrink-0 ${getStatusColor(
                                  tab.response.status
                                )}`}
                              >
                                {tab.response.status}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-text-tertiary italic">
                    (No other tabs with responses)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* View Mode & Filter Toggles */}
          <div className="flex items-center space-x-2">
            {/* View Mode: Split vs Unified */}
            <div className="inline-flex rounded-md border border-border-primary bg-bg-tertiary p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`px-2.5 py-1 rounded transition flex items-center space-x-1.5 ${
                  viewMode === "split"
                    ? "bg-bg-secondary text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                title="Side-by-side split view"
              >
                <Columns size={12} />
                <span>Split</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("unified")}
                className={`px-2.5 py-1 rounded transition flex items-center space-x-1.5 ${
                  viewMode === "unified"
                    ? "bg-bg-secondary text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                title="Unified line diff view"
              >
                <AlignJustify size={12} />
                <span>Unified</span>
              </button>
            </div>

            {/* Filter: All Lines vs Changes Only */}
            <div className="inline-flex rounded-md border border-border-primary bg-bg-tertiary p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`px-2 py-1 rounded transition ${
                  filterMode === "all"
                    ? "bg-bg-secondary text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                All Lines
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("changesOnly")}
                className={`px-2 py-1 rounded transition flex items-center space-x-1 ${
                  filterMode === "changesOnly"
                    ? "bg-bg-secondary text-text-primary font-medium shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                title="Hide unchanged lines"
              >
                <Filter size={11} />
                <span>Changes Only</span>
              </button>
            </div>
          </div>
        </div>

        {/* Custom Baseline Collapsible Editor Panel */}
        {sourceType === "custom" && (
          <div className="border-b border-border-primary bg-bg-primary/40 px-4 py-2.5 flex flex-col space-y-2 flex-shrink-0 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="font-semibold text-text-secondary">Custom Baseline Payload:</span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-text-tertiary">Status:</span>
                  <input
                    type="number"
                    value={customStatus}
                    onChange={(e) => setCustomStatus(Number(e.target.value) || 200)}
                    className="w-16 px-1.5 py-0.5 bg-bg-secondary border border-border-primary rounded text-text-primary font-mono text-xs focus:outline-none focus:border-text-accent"
                  />
                  <input
                    type="text"
                    value={customStatusText}
                    onChange={(e) => setCustomStatusText(e.target.value)}
                    placeholder="Status text"
                    className="w-24 px-1.5 py-0.5 bg-bg-secondary border border-border-primary rounded text-text-primary text-xs focus:outline-none focus:border-text-accent"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrettifyCustom}
                  className="px-2 py-0.5 rounded border border-border-primary bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition flex items-center space-x-1"
                >
                  <Code2 size={12} />
                  <span>Format JSON</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyCurrentToCustom}
                  className="px-2 py-0.5 rounded border border-border-primary bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition"
                >
                  Copy Current Body
                </button>
              </div>
            </div>

            <textarea
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              placeholder="Paste or type baseline JSON or text to compare against..."
              rows={3}
              className="w-full px-2.5 py-1.5 bg-bg-secondary border border-border-primary rounded text-text-primary font-mono text-xs resize-y focus:outline-none focus:border-text-accent"
            />
          </div>
        )}

        {/* Delta Summary Bar */}
        {diffResult && baselineResponse && (
          <div className="border-b border-border-primary bg-bg-tertiary/70 px-4 py-2 flex items-center justify-between text-xs flex-wrap gap-2 flex-shrink-0">
            <div className="flex items-center space-x-3 flex-wrap gap-y-1">
              {/* Status Delta */}
              <div className="flex items-center space-x-1.5 font-mono">
                <span className="text-text-tertiary">Status:</span>
                <span
                  className={`px-1.5 py-0.5 rounded border text-[11px] font-semibold ${getStatusColor(
                    baselineResponse.status
                  )}`}
                >
                  {baselineResponse.status} {baselineResponse.status_text}
                </span>
                <ArrowRight size={12} className="text-text-tertiary" />
                <span
                  className={`px-1.5 py-0.5 rounded border text-[11px] font-semibold ${getStatusColor(
                    currentResponse.status
                  )}`}
                >
                  {currentResponse.status} {currentResponse.status_text}
                </span>
              </div>

              <span className="text-border-primary">|</span>

              {/* Size Delta */}
              <div className="flex items-center space-x-1.5">
                <span className="text-text-tertiary">Size:</span>
                <span className="font-mono text-text-secondary">
                  {formatBytes(baselineResponse.size_bytes)}
                </span>
                <ArrowRight size={11} className="text-text-tertiary" />
                <span className="font-mono text-text-primary">
                  {formatBytes(currentResponse.size_bytes)}
                </span>
                <span
                  className={`font-mono text-[11px] font-medium px-1.5 py-0.2 rounded ${
                    diffResult.summary.sizeDiff.deltaBytes === 0
                      ? "text-text-tertiary bg-bg-secondary"
                      : diffResult.summary.sizeDiff.deltaBytes > 0
                      ? "text-amber-400 bg-amber-500/10"
                      : "text-emerald-400 bg-emerald-500/10"
                  }`}
                >
                  {formatDeltaBytes(diffResult.summary.sizeDiff.deltaBytes)}
                </span>
              </div>

              <span className="text-border-primary">|</span>

              {/* Latency Delta */}
              <div className="flex items-center space-x-1.5">
                <span className="text-text-tertiary">Latency:</span>
                <span className="font-mono text-text-secondary">{baselineResponse.time_ms} ms</span>
                <ArrowRight size={11} className="text-text-tertiary" />
                <span className="font-mono text-text-primary">{currentResponse.time_ms} ms</span>
                <span
                  className={`font-mono text-[11px] font-medium px-1.5 py-0.2 rounded ${
                    (diffResult.summary.timeDiff?.deltaMs || 0) === 0
                      ? "text-text-tertiary bg-bg-secondary"
                      : (diffResult.summary.timeDiff?.deltaMs || 0) > 0
                      ? "text-amber-400 bg-amber-500/10"
                      : "text-emerald-400 bg-emerald-500/10"
                  }`}
                >
                  {formatDeltaMs(diffResult.summary.timeDiff?.deltaMs || 0)}
                </span>
              </div>

              <span className="text-border-primary">|</span>

              {/* Line Additions / Deletions */}
              <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-semibold">
                  +{diffResult.summary.additions}
                </span>
                <span className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 font-semibold">
                  -{diffResult.summary.deletions}
                </span>
                <span className="text-text-tertiary">
                  ({diffResult.summary.unchanged} unchanged)
                </span>
              </div>
            </div>

            {/* Header Diff Expander Toggle */}
            <button
              type="button"
              onClick={() => setIsHeaderDrawerOpen(!isHeaderDrawerOpen)}
              className={`px-2.5 py-1 rounded border text-xs flex items-center space-x-1.5 transition ${
                isHeaderDrawerOpen
                  ? "bg-bg-secondary border-text-accent text-text-accent"
                  : "bg-bg-secondary border-border-primary text-text-secondary hover:text-text-primary"
              }`}
            >
              <Sliders size={12} />
              <span>
                Headers ({headerDiffCount} {headerDiffCount === 1 ? "diff" : "diffs"})
              </span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${
                  isHeaderDrawerOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        )}

        {/* Header Diff Collapsible Drawer */}
        {isHeaderDrawerOpen && diffResult && (
          <div className="border-b border-border-primary bg-bg-secondary/95 px-4 py-2.5 flex flex-col space-y-2 flex-shrink-0 animate-fade-in max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-text-primary">
                Header Comparison ({diffResult.summary.headerDiffs.length} headers total)
              </span>
              <label className="flex items-center space-x-1.5 cursor-pointer text-text-secondary hover:text-text-primary">
                <input
                  type="checkbox"
                  checked={headerFilterOnlyChanges}
                  onChange={(e) => setHeaderFilterOnlyChanges(e.target.checked)}
                  className="rounded border-border-primary bg-bg-tertiary"
                />
                <span>Only Changed Headers</span>
              </label>
            </div>

            {filteredHeaders.length === 0 ? (
              <p className="text-xs text-text-tertiary italic py-1">
                No header differences found.
              </p>
            ) : (
              <div className="border border-border-primary rounded overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-bg-tertiary text-text-tertiary border-b border-border-primary text-[11px]">
                    <tr>
                      <th className="px-2.5 py-1 font-medium w-1/4">Header</th>
                      <th className="px-2.5 py-1 font-medium w-1/3">Baseline</th>
                      <th className="px-2.5 py-1 font-medium w-1/3">Current</th>
                      <th className="px-2.5 py-1 font-medium text-right">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-primary/40 bg-bg-primary/20">
                    {filteredHeaders.map((h, i) => {
                      const isAdded = h.type === "added";
                      const isRemoved = h.type === "removed";
                      const isModified = h.type === "modified";

                      const rowBg = isAdded
                        ? "bg-emerald-500/10 text-emerald-300"
                        : isRemoved
                        ? "bg-red-500/10 text-red-300"
                        : isModified
                        ? "bg-amber-500/10 text-amber-300"
                        : "text-text-secondary";

                      const badge = isAdded
                        ? "text-emerald-400 bg-emerald-500/20"
                        : isRemoved
                        ? "text-red-400 bg-red-500/20"
                        : isModified
                        ? "text-amber-400 bg-amber-500/20"
                        : "text-text-tertiary bg-bg-tertiary";

                      return (
                        <tr key={i} className={`hover:bg-bg-tertiary/40 transition ${rowBg}`}>
                          <td className="px-2.5 py-1 font-semibold truncate max-w-[150px]">{h.key}</td>
                          <td className="px-2.5 py-1 truncate max-w-[200px]">
                            {h.oldValue !== undefined ? h.oldValue : <span className="opacity-40">-</span>}
                          </td>
                          <td className="px-2.5 py-1 truncate max-w-[200px]">
                            {h.newValue !== undefined ? h.newValue : <span className="opacity-40">-</span>}
                          </td>
                          <td className="px-2.5 py-1 text-right">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${badge}`}>
                              {h.type}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Diff Content Body */}
        <div className="flex-1 min-h-0 bg-bg-primary/60 overflow-auto font-mono text-xs select-text">
          {/* Missing Baseline Notice */}
          {!baselineResponse ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="p-3 rounded-full bg-bg-tertiary border border-border-primary mb-3">
                <AlertTriangle size={24} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">
                No Baseline Available for Comparison
              </h3>
              <p className="text-xs text-text-tertiary max-w-md mb-4">
                {sourceType === "previous"
                  ? "No previous response was recorded for this tab yet. Dispatch the request once more to record history, or switch to Custom or Other Tab baseline."
                  : "Please select an available tab or provide custom JSON text to compare against."}
              </p>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSourceType("custom")}
                  className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-tertiary border border-border-primary rounded text-xs text-text-primary transition"
                >
                  Use Custom Baseline
                </button>
                {otherTabsWithResponses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSourceType("tab");
                      setSelectedTabId(otherTabsWithResponses[0].id);
                    }}
                    className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-tertiary border border-border-primary rounded text-xs text-text-primary transition"
                  >
                    Select Other Tab
                  </button>
                )}
              </div>
            </div>
          ) : diffResult?.isIdentical ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-3">
                <Check size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">
                Responses Are Completely Identical
              </h3>
              <p className="text-xs text-text-tertiary max-w-md">
                No differences found between the baseline and current response. Status code, headers,
                and body content match exactly.
              </p>
            </div>
          ) : viewMode === "split" ? (
            /* Split View (Side-by-side) */
            <div className="min-w-full inline-block">
              {/* Column Header Titles */}
              <div className="sticky top-0 z-10 flex border-b border-border-primary bg-bg-secondary text-[11px] font-sans font-semibold text-text-tertiary uppercase tracking-wider">
                <div className="w-1/2 flex items-center justify-between px-3 py-1.5 border-r border-border-primary">
                  <span className="truncate">Baseline: {baselineLabel}</span>
                  <span
                    className={`font-mono text-[10px] px-1 py-0.2 rounded border ${getStatusColor(
                      baselineResponse.status
                    )}`}
                  >
                    {baselineResponse.status}
                  </span>
                </div>
                <div className="w-1/2 flex items-center justify-between px-3 py-1.5">
                  <span className="truncate">Current: {currentRequestName}</span>
                  <span
                    className={`font-mono text-[10px] px-1 py-0.2 rounded border ${getStatusColor(
                      currentResponse.status
                    )}`}
                  >
                    {currentResponse.status}
                  </span>
                </div>
              </div>

              {/* Rows */}
              {filteredSplitDiff.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-tertiary italic">
                  No line changes match the current filter.
                </div>
              ) : (
                filteredSplitDiff.map((row, idx) => {
                  const leftType = row.left?.type;
                  const rightType = row.right?.type;

                  const leftBg =
                    leftType === "removed"
                      ? "bg-red-500/15 text-red-200"
                      : "text-text-secondary";

                  const rightBg =
                    rightType === "added"
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "text-text-secondary";

                  return (
                    <div
                      key={idx}
                      className="flex border-b border-border-primary/20 hover:bg-bg-tertiary/20"
                    >
                      {/* Left Column (Baseline) */}
                      <div
                        className={`w-1/2 flex min-w-0 border-r border-border-primary/40 ${
                          !row.left ? "bg-bg-tertiary/10" : leftBg
                        }`}
                      >
                        <div
                          className={`w-11 flex-shrink-0 text-right pr-2 py-0.5 select-none font-mono text-[11px] border-r border-border-primary/20 ${
                            leftType === "removed"
                              ? "bg-red-500/20 text-red-400 font-bold"
                              : "bg-bg-tertiary/25 text-text-tertiary/60"
                          }`}
                        >
                          {row.left?.lineNumber ?? ""}
                        </div>
                        <div className="flex-1 px-2.5 py-0.5 whitespace-pre min-w-0 overflow-x-auto">
                          {row.left ? row.left.text : ""}
                        </div>
                      </div>

                      {/* Right Column (Current) */}
                      <div
                        className={`w-1/2 flex min-w-0 ${
                          !row.right ? "bg-bg-tertiary/10" : rightBg
                        }`}
                      >
                        <div
                          className={`w-11 flex-shrink-0 text-right pr-2 py-0.5 select-none font-mono text-[11px] border-r border-border-primary/20 ${
                            rightType === "added"
                              ? "bg-emerald-500/20 text-emerald-400 font-bold"
                              : "bg-bg-tertiary/25 text-text-tertiary/60"
                          }`}
                        >
                          {row.right?.lineNumber ?? ""}
                        </div>
                        <div className="flex-1 px-2.5 py-0.5 whitespace-pre min-w-0 overflow-x-auto">
                          {row.right ? row.right.text : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Unified View */
            <div className="min-w-full inline-block">
              {filteredUnifiedDiff.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-tertiary italic">
                  No line changes match the current filter.
                </div>
              ) : (
                filteredUnifiedDiff.map((line, idx) => {
                  const isAdded = line.type === "added";
                  const isRemoved = line.type === "removed";

                  const rowBg = isAdded
                    ? "bg-emerald-500/15 text-emerald-200"
                    : isRemoved
                    ? "bg-red-500/15 text-red-200"
                    : "text-text-secondary hover:bg-bg-tertiary/20";

                  const marker = isAdded ? "+" : isRemoved ? "-" : " ";
                  const markerColor = isAdded
                    ? "text-emerald-400 font-bold"
                    : isRemoved
                    ? "text-red-400 font-bold"
                    : "text-text-tertiary";

                  return (
                    <div
                      key={idx}
                      className={`flex border-b border-border-primary/20 ${rowBg}`}
                    >
                      <div
                        className={`w-11 flex-shrink-0 text-right pr-2 py-0.5 select-none font-mono text-[11px] border-r border-border-primary/20 ${
                          isRemoved
                            ? "bg-red-500/20 text-red-400 font-bold"
                            : "bg-bg-tertiary/25 text-text-tertiary/60"
                        }`}
                      >
                        {line.oldLineNumber ?? ""}
                      </div>
                      <div
                        className={`w-11 flex-shrink-0 text-right pr-2 py-0.5 select-none font-mono text-[11px] border-r border-border-primary/20 ${
                          isAdded
                            ? "bg-emerald-500/20 text-emerald-400 font-bold"
                            : "bg-bg-tertiary/25 text-text-tertiary/60"
                        }`}
                      >
                        {line.newLineNumber ?? ""}
                      </div>
                      <div
                        className={`w-6 flex-shrink-0 text-center py-0.5 select-none ${markerColor}`}
                      >
                        {marker}
                      </div>
                      <div className="flex-1 px-2 py-0.5 whitespace-pre min-w-0 overflow-x-auto">
                        {line.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-11 border-t border-border-primary bg-bg-tertiary flex items-center justify-between px-4 flex-shrink-0 text-xs">
          <div className="flex items-center space-x-2 text-text-tertiary truncate">
            <span>Baseline:</span>
            <span className="text-text-primary font-medium truncate max-w-xs">
              {baselineLabel}
            </span>
            <span>vs</span>
            <span className="text-text-primary font-medium truncate max-w-xs">
              {currentRequestName}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border-primary rounded text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

