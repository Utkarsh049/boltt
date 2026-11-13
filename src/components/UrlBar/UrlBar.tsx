import React, { useState, useRef, useEffect } from "react";
import { useRequestStore, HttpMethod } from "../../store/requestStore";
import { useEnvStore } from "../../store/envStore";
import { useProjectsStore } from "../../store/projectsStore";
import { useToastStore } from "../../store/toastStore";
import { isCurlCommand } from "../../utils/curl";
import { Save, Send, ChevronDown, Check, ShieldAlert, ShieldCheck } from "lucide-react";

interface UrlHistoryItem {
  url: string;
  cursor: number;
}

interface TabUrlHistory {
  past: UrlHistoryItem[];
  future: UrlHistoryItem[];
  lastUrl: string;
  lastChangeTime: number;
}

const getMethodColors = (method: string) => {
  switch (method) {
    case "GET":
      return {
        text: "text-[#4ade80]",
        bg: "bg-[#4ade80]/10",
        border: "border-[#4ade80]/20",
        hoverBg: "hover:bg-[#4ade80]/15",
      };
    case "POST":
      return {
        text: "text-[#fb923c]",
        bg: "bg-[#fb923c]/10",
        border: "border-[#fb923c]/20",
        hoverBg: "hover:bg-[#fb923c]/15",
      };
    case "PUT":
      return {
        text: "text-[#60a5fa]",
        bg: "bg-[#60a5fa]/10",
        border: "border-[#60a5fa]/20",
        hoverBg: "hover:bg-[#60a5fa]/15",
      };
    case "PATCH":
      return {
        text: "text-[#c084fc]",
        bg: "bg-[#c084fc]/10",
        border: "border-[#c084fc]/20",
        hoverBg: "hover:bg-[#c084fc]/15",
      };
    case "DELETE":
      return {
        text: "text-[#f87171]",
        bg: "bg-[#f87171]/10",
        border: "border-[#f87171]/20",
        hoverBg: "hover:bg-[#f87171]/15",
      };
    case "OPTIONS":
      return {
        text: "text-[#a1c9ff]",
        bg: "bg-[#a1c9ff]/10",
        border: "border-[#a1c9ff]/20",
        hoverBg: "hover:bg-[#a1c9ff]/15",
      };
    default: // HEAD or other
      return {
        text: "text-text-primary",
        bg: "bg-bg-tertiary",
        border: "border-border-primary",
        hoverBg: "hover:bg-bg-hover",
      };
  }
};

export const UrlBar: React.FC = () => {
  const {
    activeRequest,
    activeTabId,
    setMethod,
    setUrl,
    sendRequest,
    isLoading,
    markTabClean,
    setSslVerify,
    importCurl,
  } = useRequestStore();
  const getFlatActiveVariables = useEnvStore((state) => state.getFlatActiveVariables);
  const { saveRequestDirectly, setSaveModalOpen } = useProjectsStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSslPopoverOpen, setIsSslPopoverOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sslDropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Undo / Redo history tracking per tab
  const historyMapRef = useRef<Map<string, TabUrlHistory>>(new Map());
  const isUndoingRedoingRef = useRef(false);

  const getHistory = (key: string): TabUrlHistory => {
    let hist = historyMapRef.current.get(key);
    if (!hist) {
      hist = {
        past: [],
        future: [],
        lastUrl: activeRequest.url,
        lastChangeTime: 0,
      };
      historyMapRef.current.set(key, hist);
    }
    return hist;
  };

  // Sync current URL into history on tab switch or external change
  useEffect(() => {
    if (isUndoingRedoingRef.current) return;
    const tabKey = activeRequest.id || activeTabId || "default";
    const hist = getHistory(tabKey);
    hist.lastUrl = activeRequest.url;
  }, [activeRequest.url, activeRequest.id, activeTabId]);

  // Responsive container observer: switch to compact icon-only buttons when width < 580px
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < 580);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (sslDropdownRef.current && !sslDropdownRef.current.contains(event.target as Node)) {
        setIsSslPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Listen to custom focus event (Cmd+L)
  useEffect(() => {
    const handleFocus = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("focus-url-bar", handleFocus);
    return () => {
      window.removeEventListener("focus-url-bar", handleFocus);
    };
  }, []);

  const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

  const handleSend = () => {
    sendRequest(getFlatActiveVariables());
  };

  // Undo URL action
  const handleUndo = () => {
    const tabKey = activeRequest.id || activeTabId || "default";
    const hist = getHistory(tabKey);
    if (hist.past.length === 0) return;

    const currentCursor = inputRef.current?.selectionStart ?? activeRequest.url.length;
    hist.future.push({
      url: activeRequest.url,
      cursor: currentCursor,
    });

    const previous = hist.past.pop()!;
    hist.lastUrl = previous.url;
    hist.lastChangeTime = 0;

    isUndoingRedoingRef.current = true;
    setUrl(previous.url);

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(previous.cursor, previous.cursor);
      }
      isUndoingRedoingRef.current = false;
    });
  };

  // Redo URL action
  const handleRedo = () => {
    const tabKey = activeRequest.id || activeTabId || "default";
    const hist = getHistory(tabKey);
    if (hist.future.length === 0) return;

    const currentCursor = inputRef.current?.selectionStart ?? activeRequest.url.length;
    hist.past.push({
      url: activeRequest.url,
      cursor: currentCursor,
    });

    const next = hist.future.pop()!;
    hist.lastUrl = next.url;
    hist.lastChangeTime = 0;

    isUndoingRedoingRef.current = true;
    setUrl(next.url);

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(next.cursor, next.cursor);
      }
      isUndoingRedoingRef.current = false;
    });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    const cursor = e.target.selectionStart ?? newUrl.length;
    const tabKey = activeRequest.id || activeTabId || "default";
    const hist = getHistory(tabKey);

    const now = Date.now();
    const prevUrl = hist.lastUrl;

    const isDelimiter =
      newUrl.length > prevUrl.length &&
      ["/", ".", "?", "&", "=", ":", "@", "#"].includes(newUrl[cursor - 1]);
    const isBigChange = Math.abs(newUrl.length - prevUrl.length) > 1;
    const isPause = now - hist.lastChangeTime > 500;

    if (isPause || isBigChange || isDelimiter) {
      if (prevUrl !== newUrl) {
        hist.past.push({
          url: prevUrl,
          cursor: Math.max(0, cursor - (newUrl.length - prevUrl.length)),
        });
        if (hist.past.length > 100) hist.past.shift();
        hist.future = [];
      }
    }

    hist.lastUrl = newUrl;
    hist.lastChangeTime = now;
    setUrl(newUrl);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    if (isCtrlOrMeta && !e.altKey) {
      const key = e.key.toLowerCase();
      // Undo: Ctrl+Z / Cmd+Z (without Shift)
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleUndo();
        return;
      }
      // Redo: Ctrl+Y, Ctrl+Shift+Z, Cmd+Shift+Z
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
        return;
      }
    }

    if (e.key === "Enter") {
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    const tabKey = activeRequest.id || activeTabId || "default";
    const hist = getHistory(tabKey);
    const cursor = inputRef.current?.selectionStart ?? activeRequest.url.length;

    // Record snapshot so undo restores state before paste
    hist.past.push({
      url: activeRequest.url,
      cursor,
    });
    hist.future = [];

    if (isCurlCommand(text)) {
      e.preventDefault();
      const success = importCurl(text, { inPlace: true });
      if (success) {
        useToastStore.getState().showToast("Imported request from cURL", "success");
      }
    }
  };

  const handleSave = async () => {
    if (!activeRequest.id) {
      setSaveModalOpen(true);
      return;
    }
    const saved = await saveRequestDirectly(activeRequest);
    if (saved) {
      markTabClean(activeRequest.id);
      useToastStore.getState().showToast("Request saved", "success");
      console.log("Saved request directly!");
    } else {
      setSaveModalOpen(true);
    }
  };

  const currentColors = getMethodColors(activeRequest.method);

  return (
    <div className="flex flex-col space-y-1.5" ref={containerRef}>
      <div className="flex items-center space-x-2">
        {/* Custom Method Dropdown Select */}
        <div className="relative inline-block text-left" ref={dropdownRef}>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center justify-between px-3 h-9 border rounded-md text-xs font-mono font-bold transition duration-150 cursor-pointer select-none min-w-[105px] flex-shrink-0 ${currentColors.text} ${currentColors.bg} ${currentColors.border} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span>{activeRequest.method}</span>
            <ChevronDown size={14} className="ml-1 opacity-70" />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 mt-1 w-[125px] bg-bg-secondary border border-border-primary rounded-md shadow-2xl z-50 py-1 overflow-hidden">
              {methods.map((method) => {
                const methodColors = getMethodColors(method);
                const isSelected = activeRequest.method === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setMethod(method);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono font-bold flex items-center justify-between transition cursor-pointer ${
                      methodColors.text
                    } ${
                      isSelected
                        ? "bg-bg-tertiary"
                        : "hover:bg-bg-tertiary/60"
                    }`}
                  >
                    <span>{method}</span>
                    {isSelected && <Check size={12} className="text-text-accent" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* URL Input */}
        <div className="flex-1 relative flex items-center min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={activeRequest.url}
            onChange={handleUrlChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={isLoading}
            placeholder="Enter request URL (e.g. https://httpbin.org/get) or paste cURL"
            className={`w-full bg-bg-primary text-text-primary border px-3 ${
              activeRequest.ssl_verify === false ? "pr-28" : "pr-9"
            } h-9 rounded-md text-xs font-mono focus:outline-none focus:border-text-accent placeholder-text-secondary/60 transition-colors ${
              activeRequest.ssl_verify === false
                ? "border-amber-500/60 focus:border-amber-500"
                : "border-border-primary"
            }`}
          />
          
          {/* SSL verification button & indicator */}
          <div className="absolute inset-y-0 right-2 flex items-center space-x-1.5">
            {activeRequest.ssl_verify === false && (
              <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[9px] font-bold text-amber-400 font-mono">
                <ShieldAlert size={10} />
                <span>INSECURE</span>
              </span>
            )}
            <div className="relative flex items-center" ref={sslDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSslPopoverOpen(!isSslPopoverOpen)}
                aria-label="SSL Verification Settings"
                aria-expanded={isSslPopoverOpen}
                className={`p-1 hover:bg-bg-hover/80 rounded-md transition cursor-pointer ${
                  activeRequest.ssl_verify === false ? "text-amber-400" : "text-text-secondary hover:text-text-primary"
                }`}
                title="SSL Verification Settings"
              >
                {activeRequest.ssl_verify === false ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
              </button>
              
              {isSslPopoverOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-bg-secondary border border-border-primary rounded-md shadow-2xl p-3 z-50 flex flex-col space-y-2 font-sans select-none">
                  <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    SSL Settings
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-text-primary py-1">
                    <input
                      type="checkbox"
                      checked={activeRequest.ssl_verify !== false}
                      aria-label="Verify SSL certificates"
                      onChange={(e) => {
                        setSslVerify(e.target.checked);
                      }}
                    />
                    <span>Verify SSL certificates</span>
                  </label>
                  <div className="text-[10px] text-text-secondary leading-normal border-t border-border-primary/40 pt-1.5">
                    Disabling verification allows self-signed or invalid certificates to be accepted.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isLoading}
          className={`bg-bg-hover text-text-accent border border-border-primary h-9 rounded-md text-xs font-semibold hover:bg-bg-hover-light transition cursor-pointer flex items-center justify-center flex-shrink-0 ${
            isCompact ? "w-9 px-0" : "px-4 space-x-1.5"
          }`}
          title="Save request (Ctrl+S / Cmd+S)"
          aria-label="Save request"
        >
          <Save size={13} />
          {!isCompact && <span>Save</span>}
        </button>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isLoading}
          className={`bg-text-accent text-bg-primary hover:opacity-90 h-9 rounded-md text-xs font-semibold transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm cursor-pointer flex-shrink-0 ${
            isCompact ? "w-9 px-0" : "px-5 space-x-1.5 min-w-[80px]"
          }`}
          title="Send request (Ctrl+Enter / Enter)"
          aria-label="Send request"
        >
          {isLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-bg-primary border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <>
              <Send size={13} />
              {!isCompact && <span>Send</span>}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
