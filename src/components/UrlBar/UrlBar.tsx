import React from "react";
import { useRequestStore, HttpMethod } from "../../store/requestStore";
import { Save, Send } from "lucide-react";

export const UrlBar: React.FC = () => {
  const { activeRequest, setMethod, setUrl, sendRequest, isLoading } = useRequestStore();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendRequest();
    }
  };

  return (
    <div className="flex flex-col space-y-1.5">
      <div className="flex items-center space-x-2">
        {/* Method Select */}
        <select
          value={activeRequest.method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          disabled={isLoading}
          className="bg-[#1c2025] text-[#e0e2ea] border border-[#30363D] px-3 h-9 rounded-sm text-xs font-mono font-bold focus:outline-none focus:border-[#a1c9ff] cursor-pointer"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>

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

        {/* Save Button (Muted/Disabled in Phase 3) */}
        <button
          disabled
          className="bg-[#272a30] text-[#8b919d] border border-[#30363D] px-4 h-9 rounded-sm text-xs font-semibold hover:bg-[#32353b]/50 transition cursor-not-allowed opacity-60 flex items-center space-x-1.5"
          title="Saving requests will be implemented in Phase 6"
        >
          <Save size={12} />
          <span>Save</span>
        </button>

        {/* Send Button */}
        <button
          onClick={() => sendRequest()}
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
