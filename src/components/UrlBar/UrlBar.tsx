import React, { useState, useRef, useEffect } from "react";
import { useRequestStore, HttpMethod } from "../../store/requestStore";
import { useEnvStore } from "../../store/envStore";
import { useProjectsStore } from "../../store/projectsStore";
import { useToastStore } from "../../store/toastStore";
import { Save, Send, ChevronDown, Check, ShieldAlert, ShieldCheck } from "lucide-react";

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
        text: "text-[#e0e2ea]",
        bg: "bg-[#1c2025]",
        border: "border-[#30363D]",
        hoverBg: "hover:bg-[#272a30]",
      };
  }
};

export const UrlBar: React.FC = () => {
  const { activeRequest, setMethod, setUrl, sendRequest, isLoading, markTabClean, setSslVerify } = useRequestStore();
  const getFlatActiveVariables = useEnvStore((state) => state.getFlatActiveVariables);
  const { saveRequestDirectly, setSaveModalOpen } = useProjectsStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSslPopoverOpen, setIsSslPopoverOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sslDropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
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
    <div className="flex flex-col space-y-1.5">
      <div className="flex items-center space-x-2">
        {/* Custom Method Dropdown Select */}
        <div className="relative inline-block text-left" ref={dropdownRef}>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center justify-between px-3 h-9 border rounded-sm text-xs font-mono font-bold transition duration-150 cursor-pointer select-none min-w-[105px] ${currentColors.text} ${currentColors.bg} ${currentColors.border} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span>{activeRequest.method}</span>
            <ChevronDown size={14} className="ml-1 opacity-70" />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 mt-1 w-[125px] bg-[#161B22] border border-[#30363D] rounded shadow-2xl z-50 py-1 overflow-hidden">
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
                        ? "bg-[#1c2025]"
                        : "hover:bg-[#1c2025]/60"
                    }`}
                  >
                    <span>{method}</span>
                    {isSelected && <Check size={12} className="text-[#a1c9ff]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* URL Input */}
        <div className="flex-1 relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={activeRequest.url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Enter request URL (e.g. https://httpbin.org/get)"
            className={`w-full bg-[#101419] text-[#e0e2ea] border px-3 pr-24 h-9 rounded-sm text-xs font-mono focus:outline-none focus:border-[#a1c9ff] placeholder-[#8b919d]/60 transition-colors ${
              activeRequest.ssl_verify === false
                ? "border-amber-500/60 focus:border-amber-500"
                : "border-[#30363D]"
            }`}
          />
          
          {/* SSL verification button & indicator */}
          <div className="absolute right-2 flex items-center space-x-1.5" ref={sslDropdownRef}>
            {activeRequest.ssl_verify === false && (
              <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[9px] font-bold text-amber-400 font-mono animate-pulse">
                <ShieldAlert size={10} />
                <span>INSECURE</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsSslPopoverOpen(!isSslPopoverOpen)}
              className={`p-1 hover:bg-[#272a30]/80 rounded transition cursor-pointer ${
                activeRequest.ssl_verify === false ? "text-amber-400" : "text-[#8b919d] hover:text-[#e0e2ea]"
              }`}
              title="SSL Verification Settings"
            >
              {activeRequest.ssl_verify === false ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
            </button>
            
            {isSslPopoverOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#161B22] border border-[#30363D] rounded shadow-2xl p-3 z-50 flex flex-col space-y-2 font-sans select-none">
                <div className="text-[10px] font-bold text-[#8b919d] uppercase tracking-wider">
                  SSL Settings
                </div>
                <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-[#e0e2ea] py-1">
                  <input
                    type="checkbox"
                    checked={activeRequest.ssl_verify !== false}
                    onChange={(e) => {
                      setSslVerify(e.target.checked);
                    }}
                    className="w-3.5 h-3.5 rounded bg-[#101419] border-[#30363D] text-[#a1c9ff] focus:ring-0 cursor-pointer"
                  />
                  <span>Verify SSL certificates</span>
                </label>
                <div className="text-[10px] text-[#8b919d] leading-normal border-t border-[#30363D]/40 pt-1.5">
                  Disabling verification allows self-signed or invalid certificates to be accepted.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="bg-[#272a30] text-[#a1c9ff] border border-[#30363D] px-4 h-9 rounded-sm text-xs font-semibold hover:bg-[#32353b] transition cursor-pointer flex items-center space-x-1.5"
          title="Save request (Ctrl+S / Cmd+S)"
        >
          <Save size={12} />
          <span>Save</span>
        </button>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="bg-[#a1c9ff] text-[#00325a] hover:bg-blue-300 px-5 h-9 rounded-sm text-xs font-bold transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 min-w-[80px]"
        >
          {isLoading ? (
            <span className="w-4 h-4 border-2 border-[#00325a] border-t-transparent rounded-full animate-spin"></span>
          ) : (
            <>
              <Send size={12} />
              <span>Send</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
