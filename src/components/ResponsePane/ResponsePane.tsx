import React from "react";
import { useRequestStore } from "../../store/requestStore";
import { Group, Panel, Separator } from "react-resizable-panels";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import {
  Copy,
  Terminal,
  List,
  FileText,
  Inbox,
} from "lucide-react";
import { buildCurlCommand } from "../../utils/curl";
import { useToastStore } from "../../store/toastStore";

export const ResponsePane: React.FC = () => {
  const { response, isLoading, activeRequest } = useRequestStore();
  const { showToast } = useToastStore();


  // Bytes formatting helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Safe JSON pretty print
  const renderResponseBody = (body: string) => {
    if (!body) return "(Empty response)";
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body; // Fallback to raw text
    }
  };

  const isJson = (body: string): boolean => {
    try {
      JSON.parse(body);
      return true;
    } catch {
      return false;
    }
  };

  // Clipboard actions
  const handleCopyBody = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.body);
    showToast("Response body copied to clipboard", "success");
  };

  const handleCopyHeaders = () => {
    if (!response) return;
    const headerText = response.headers
      .map((h) => `${h.key}: ${h.value}`)
      .join("\n");
    navigator.clipboard.writeText(headerText);
    showToast("Response headers copied to clipboard", "success");
  };

  const handleCopyCurl = () => {
    if (!activeRequest) return;
    const curl = buildCurlCommand(activeRequest);
    navigator.clipboard.writeText(curl);
    showToast("cURL command copied to clipboard", "success");
  };

  // Status color mapper
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-green-950/40 text-green-400 border-green-800/40";
    if (status >= 300 && status < 400) return "bg-blue-950/40 text-blue-400 border-blue-800/40";
    if (status >= 400) return "bg-red-950/40 text-red-400 border-red-800/40";
    return "bg-[#272a30] text-[#e0e2ea] border-[#30363D]"; // Status 0
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header Metrics */}
      <div className="flex items-center justify-between border-b border-[#30363D] pb-2.5 mb-2.5 flex-shrink-0">
        <h3 className="text-xs font-semibold text-[#8b919d] uppercase tracking-wider">
          Response View
        </h3>
        
        {response && (
          <div className="flex items-center space-x-2.5 text-xs font-mono">
            {/* Status Code */}
            <span className={`px-2 py-0.5 rounded ${getStatusColor(response.status)}`}>
              {response.status === 0 ? "0 Error" : `${response.status} ${response.status_text}`}
            </span>
            
            {response.status !== 0 && (
              <>
                <span className="text-[#8b919d]">
                  Time: <strong className="text-[#e0e2ea]">{response.time_ms} ms</strong>
                </span>
                <span className="text-[#8b919d]">
                  Size: <strong className="text-[#e0e2ea]">{formatBytes(response.size_bytes)}</strong>
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3">
          <div className="w-7 h-7 border-2 border-[#a1c9ff] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-[#8b919d] animate-pulse">Dispatching API request...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !response && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#30363D] rounded-sm bg-[#101419]/50">
          <Inbox className="w-8 h-8 text-[#8b919d]/40 mb-2" />
          <span className="text-[#8b919d] text-xs max-w-xs leading-relaxed">
            Hit Send in the Request Builder to dispatch the request and inspect the response.
          </span>
        </div>
      )}

      {/* Realized Response view split (Vertical Resizing) */}
      {!isLoading && response && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          
          {/* Quick Actions Panel */}
          <div className="flex items-center justify-end space-x-1.5 border border-[#30363D] bg-[#1c2025] py-1 px-2 flex-shrink-0 rounded-t-sm border-b-0">
            <button
              onClick={handleCopyCurl}
              className="p-1 hover:bg-[#272a30] text-[#8b919d] hover:text-[#e0e2ea] border border-transparent hover:border-[#30363D] rounded-sm transition flex items-center space-x-1 text-[11px]"
              title="Copy request as cURL command"
            >
              <Terminal size={11} />
              <span>cURL</span>
            </button>
            <button
              onClick={handleCopyBody}
              className="p-1 hover:bg-[#272a30] text-[#8b919d] hover:text-[#e0e2ea] border border-transparent hover:border-[#30363D] rounded-sm transition flex items-center space-x-1 text-[11px]"
              title="Copy response body"
            >
              <Copy size={11} />
              <span>Copy Body</span>
            </button>
            <button
              onClick={handleCopyHeaders}
              className="p-1 hover:bg-[#272a30] text-[#8b919d] hover:text-[#e0e2ea] border border-transparent hover:border-[#30363D] rounded-sm transition flex items-center space-x-1 text-[11px]"
              title="Copy response headers"
            >
              <Copy size={11} />
              <span>Copy Headers</span>
            </button>
          </div>

          {/* Resizable Headers vs Body vertically split */}
          <div className="flex-1 bg-[#101419] p-3 border border-[#30363D] rounded-b-sm overflow-hidden min-h-0 flex flex-col">
            <Group id="response-workspace-layout-v5" orientation="vertical">
              
              {/* Response Headers (Top) */}
              {response.headers.length > 0 ? (
                <Panel defaultSize={30} minSize={15} className="flex flex-col min-h-0 overflow-hidden pb-1 h-full">
                  <h4 className="text-[10px] font-semibold text-[#8b919d] uppercase mb-1.5 flex items-center space-x-1.5 flex-shrink-0">
                    <List size={12} />
                    <span>Response Headers ({response.headers.length})</span>
                  </h4>
                  <div className="flex-1 bg-[#161B22]/20 rounded border border-[#30363D] font-mono text-[11px] overflow-y-auto min-h-0 divide-y divide-[#1c2025]">
                    {response.headers.map((h, i) => (
                      <div key={i} className="flex justify-between py-1 px-2">
                        <span className="text-[#8b919d] font-semibold select-none">{h.key}</span>
                        <span className="text-[#e0e2ea] text-right break-all pl-6 select-all">{h.value}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              ) : (
                <Panel defaultSize={0} minSize={0} maxSize={0} className="hidden" />
              )}

              {/* Vertical Resize Separator */}
              {response.headers.length > 0 && (
                <Separator className="h-2 hover:bg-[#a1c9ff]/10 active:bg-[#a1c9ff]/20 transition-all cursor-row-resize flex-shrink-0 flex flex-col items-center justify-center my-1">
                  <div className="h-[1px] w-full bg-[#30363D]" />
                </Separator>
              )}

              {/* Response Body (Bottom) */}
              <Panel defaultSize={70} minSize={25} className="flex flex-col min-h-0 overflow-hidden pt-1 h-full">
                <h4 className="text-[10px] font-semibold text-[#8b919d] uppercase mb-1.5 flex items-center space-x-1.5 flex-shrink-0">
                  <FileText size={12} />
                  <span>Response Body</span>
                </h4>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  {isJson(response.body) ? (
                    <div className="border border-[#30363D] rounded-sm overflow-hidden text-xs font-mono flex-1 flex flex-col min-h-0">
                      <CodeMirror
                        value={renderResponseBody(response.body)}
                        height="100%"
                        extensions={[json()]}
                        theme="dark"
                        readOnly={true}
                        className="flex-1 min-h-0"
                        style={{ height: "100%" }}
                      />
                    </div>
                  ) : (
                    <pre className="flex-1 w-full bg-[#101419] text-green-300 p-3 rounded border border-[#30363D] font-mono text-xs overflow-y-auto whitespace-pre-wrap min-h-0">
                      {response.body || "(No response body returned)"}
                    </pre>
                  )}
                </div>
              </Panel>

            </Group>
          </div>

        </div>
      )}
    </div>
  );
};
