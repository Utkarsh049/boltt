import React, { useState, useEffect } from "react";
import { useHistoryStore, HistoryEntry } from "../../store/historyStore";
import { useRequestStore, KeyValue } from "../../store/requestStore";
import { useToastStore } from "../../store/toastStore";
import { ChevronDown, ChevronRight, Clock, Trash2, ArrowUpRight } from "lucide-react";

interface HistoryPanelProps {
  alwaysExpanded?: boolean;
  limit?: number;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  alwaysExpanded = false,
  limit = 8,
}) => {
  const { entries, clearHistory } = useHistoryStore();
  const showToast = useToastStore((state) => state.showToast);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Periodically refresh relative timestamps
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

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

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) {
      return "text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/20";
    }
    if (status >= 300 && status < 400) {
      return "text-[#60a5fa] bg-[#60a5fa]/10 border-[#60a5fa]/20";
    }
    if (status === 0) {
      return "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20";
    }
    return "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20";
  };

  const formatRelativeTime = (epochMs: number) => {
    const diff = now - epochMs;
    if (diff < 2000) return "just now";
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const truncateUrl = (url: string, maxLen = 24) => {
    // Strip protocol to save space
    const clean = url.replace(/^https?:\/\//, "");
    if (clean.length <= maxLen) return clean;
    return clean.substring(0, maxLen) + "…";
  };

  const handleClearHistory = () => {
    clearHistory();
    showToast("History cleared", "info");
  };

  const handleLoadEntry = (entry: HistoryEntry) => {
    const openTab = useRequestStore.getState().openTab;

    // Parse query parameters
    let parsedParams: KeyValue[] = [];
    let baseUrl = entry.url;
    
    const qIdx = entry.url.indexOf("?");
    if (qIdx !== -1) {
      baseUrl = entry.url.substring(0, qIdx);
      const search = entry.url.substring(qIdx + 1);
      search.split("&").forEach((pair) => {
        if (!pair) return;
        const eqIdx = pair.indexOf("=");
        if (eqIdx !== -1) {
          const key = decodeURIComponent(pair.substring(0, eqIdx));
          const value = decodeURIComponent(pair.substring(eqIdx + 1));
          parsedParams.push({ key, value, enabled: true });
        } else {
          parsedParams.push({ key: decodeURIComponent(pair), value: "", enabled: true });
        }
      });
    }

    openTab({
      name: truncateUrl(entry.url, 18),
      method: entry.method as any,
      url: baseUrl,
      headers: [],
      params: parsedParams,
      body: { type: "None" },
      auth: { type: "None" },
    });
  };

  const visibleEntries = entries.slice(0, limit);

  return (
    <div className="flex flex-col select-none font-sans min-h-0">
      {/* Header */}
      {!alwaysExpanded && (
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center justify-between py-1.5 px-1 hover:text-text-primary text-text-secondary cursor-pointer transition select-none flex-shrink-0"
        >
          <div className="flex items-center space-x-1.5">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Recent History
            </span>
            {entries.length > 0 && (
              <span className="text-[10px] bg-bg-hover text-text-accent px-1.5 py-0.5 rounded-full border border-border-primary">
                {entries.length}
              </span>
            )}
          </div>

          {!isCollapsed && entries.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearHistory();
              }}
              className="flex items-center space-x-1 px-1.5 py-0.5 text-[9px] font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition cursor-pointer"
              title="Clear all recent request logs"
            >
              <Trash2 size={10} />
              <span>Clear</span>
            </button>
          )}
        </div>
      )}

      {/* History List Container */}
      {(!isCollapsed || alwaysExpanded) && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="text-[11px] text-text-secondary/60 italic p-3 text-center flex items-center justify-center space-x-1">
              <Clock size={11} />
              <span>No recent requests.</span>
            </div>
          ) : (
            <div className="space-y-1 py-1 pr-1 pl-0.5 flex-1 min-h-0 overflow-y-auto">
              {visibleEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => handleLoadEntry(entry)}
                  title={entry.url}
                  className="group flex items-center justify-between p-1.5 rounded border border-border-primary/40 bg-bg-secondary/30 hover:bg-bg-tertiary/80 hover:border-text-accent/30 transition cursor-pointer font-mono text-[11px]"
                >
                  <div className="flex items-center space-x-2 truncate flex-1 pr-2">
                    {/* Method label */}
                    <span className={`text-[9px] font-black w-[35px] text-left flex-shrink-0 ${getMethodColor(entry.method)}`}>
                      {entry.method}
                    </span>
                    
                    {/* Truncated URL */}
                    <span className="text-text-primary/90 truncate select-none">
                      {truncateUrl(entry.url)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    {/* Status code */}
                    <span className={`px-1.5 py-0.2 text-[9px] rounded-sm ${getStatusColor(entry.status)}`}>
                      {entry.status === 0 ? "ERR" : entry.status}
                    </span>

                    {/* Relative timestamp */}
                    <span className="text-[9px] text-text-secondary w-[45px] text-right">
                      {formatRelativeTime(entry.sentAt)}
                    </span>
                    
                    {/* Load arrow helper on hover */}
                    <ArrowUpRight size={10} className="text-text-accent opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                  </div>
                </div>
              ))}

              {/* Pinned history list */}
              {alwaysExpanded && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center space-x-1 px-2 py-1 text-[10px] text-red-400 hover:text-red-300 font-medium hover:underline transition cursor-pointer"
                  >
                    <Trash2 size={11} />
                    <span>Clear History</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
