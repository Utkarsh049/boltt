import React, { useState, useRef, useEffect } from "react";
import { useRequestStore, HttpMethod } from "../../store/requestStore";
import { useEnvStore } from "../../store/envStore";
import { useProjectsStore, Folder } from "../../store/projectsStore";
import { Save, Send, ChevronDown, Check } from "lucide-react";

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
  const { activeRequest, setMethod, setUrl, sendRequest, isLoading } = useRequestStore();
  const getFlatActiveVariables = useEnvStore((state) => state.getFlatActiveVariables);
  const { projects, saveRequest, setSaveModalOpen } = useProjectsStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

  const handleSend = () => {
    sendRequest(getFlatActiveVariables());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSave = async () => {
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
                        ? "bg-[#1c2025] border-l-2"
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
        <input
          type="text"
          value={activeRequest.url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Enter request URL (e.g. https://httpbin.org/get)"
          className="flex-1 bg-[#101419] text-[#e0e2ea] border border-[#30363D] px-3 h-9 rounded-sm text-xs font-mono focus:outline-none focus:border-[#a1c9ff] placeholder-[#8b919d]/60"
        />

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
