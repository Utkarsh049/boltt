import React, { useState, useRef, useEffect, useMemo } from "react";
import { useRequestStore, ExtractorSource } from "../../store/requestStore";
import { useEnvStore } from "../../store/envStore";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import {
  Copy,
  Terminal,
  List,
  FileText,
  Inbox,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  WifiOff,
  RefreshCw,
  Activity,
  Filter,
  X,
} from "lucide-react";
import { buildCurlCommand } from "../../utils/curl";
import { useToastStore } from "../../store/toastStore";
import { CaptureVariableModal } from "../CaptureVariableModal/CaptureVariableModal";
import { TimingWaterfallPopover } from "../TimingWaterfall/TimingWaterfallPopover";
import { evaluateJsonPath } from "../../utils/jsonPath";

export const ResponsePane: React.FC = () => {
  const { response, isLoading, activeRequest, theme, sendRequest } = useRequestStore();
  const { showToast } = useToastStore();

  const [headersExpanded, setHeadersExpanded] = useState(true);
  const [bodyExpanded, setBodyExpanded] = useState(true);

  const [captureModalConfig, setCaptureModalConfig] = useState<{
    isOpen: boolean;
    source: ExtractorSource;
    property: string;
    targetVariable: string;
  }>({
    isOpen: false,
    source: "body",
    property: "",
    targetVariable: "",
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [headersHeight, setHeadersHeight] = useState(120);
  const [isResizing, setIsResizing] = useState(false);

  const [jsonPathQuery, setJsonPathQuery] = useState("");
  const [isWaterfallOpen, setIsWaterfallOpen] = useState(false);

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

  const parsedJson = useMemo(() => {
    if (!response?.body) return null;
    try {
      return JSON.parse(response.body);
    } catch {
      return null;
    }
  }, [response?.body]);

  const isResponseJson = parsedJson !== null;

  const filterResult = useMemo(() => {
    if (!isResponseJson || !jsonPathQuery.trim()) return null;
    return evaluateJsonPath(parsedJson, jsonPathQuery);
  }, [parsedJson, isResponseJson, jsonPathQuery]);

  const displayedBody = useMemo(() => {
    if (!response) return "";
    if (filterResult) {
      if (filterResult.success) {
        return filterResult.formatted || "[]";
      }
      return `// JSONPath syntax error: ${filterResult.error}\n\n${renderResponseBody(response.body)}`;
    }
    return renderResponseBody(response.body);
  }, [response, filterResult]);

  // Clipboard actions
  const handleCopyBody = () => {
    if (!response) return;
    if (filterResult && filterResult.success && filterResult.formatted) {
      navigator.clipboard.writeText(filterResult.formatted);
      showToast("Filtered JSON copied to clipboard", "success");
    } else {
      navigator.clipboard.writeText(response.body);
      showToast("Response body copied to clipboard", "success");
    }
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

  const handleCopyError = () => {
    if (!response?.body) return;
    navigator.clipboard.writeText(response.body);
    showToast("Error details copied to clipboard", "success");
  };

  const handleRetry = () => {
    const flatVars = useEnvStore.getState().getFlatActiveVariables();
    sendRequest(flatVars);
  };

  const handleOpenCaptureFromBody = () => {
    let initialProp = "";
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      const cleanSelection = selection.replace(/^["']|["']$/g, "").trim();
      if (/^[a-zA-Z0-9_$.[\]]+$/.test(cleanSelection)) {
        initialProp = cleanSelection;
      }
    } else if (jsonPathQuery.trim() && filterResult?.success) {
      initialProp = jsonPathQuery.trim();
    }

    setCaptureModalConfig({
      isOpen: true,
      source: "body",
      property: initialProp,
      targetVariable: initialProp ? initialProp.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() : "",
    });
  };

  const handleCaptureHeader = (headerKey: string) => {
    setCaptureModalConfig({
      isOpen: true,
      source: "header",
      property: headerKey,
      targetVariable: headerKey.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase(),
    });
  };

  // Status color mapper
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-green-400 bg-green-500/10 border-green-800/40";
    if (status >= 300 && status < 400) return "text-blue-400 bg-blue-500/10 border-blue-800/40";
    if (status >= 400 && status < 500) return "text-amber-400 bg-amber-500/10 border-amber-800/40";
    if (status >= 500) return "text-red-400 bg-red-500/10 border-red-800/40";
    return "text-red-400 bg-red-500/10 border-red-500/30"; // Status 0
  };

  // Drag resizing handler
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setHeadersExpanded(true);
    setBodyExpanded(true);
  };

  useEffect(() => {
    if (!isResizing || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const newHeight = e.clientY - containerRect.top;

      // Calculate max content height of headers list to limit expansion
      const headersCount = response?.headers?.length || 0;
      const maxContentHeight = headersCount * 26 + 32;

      // Clamp between min 40px and maxContentHeight
      const clampedHeight = Math.max(40, Math.min(maxContentHeight, newHeight));
      setHeadersHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, response?.headers?.length]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header Metrics */}
      <div className="flex items-center justify-between border-b border-border-primary pb-2.5 mb-2.5 flex-shrink-0 flex-wrap gap-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Response View
        </h3>
        
        {response && (
          <div className="flex items-center space-x-2.5 text-xs font-mono flex-wrap gap-y-1">
            {/* Status Code */}
            <span
              className={`px-2 py-0.5 rounded border text-xs font-mono font-semibold flex items-center space-x-1 ${getStatusColor(
                response.status
              )}`}
            >
              {response.status === 0 ? (
                <>
                  <AlertTriangle size={11} className="text-red-400" />
                  <span>0 {response.status_text || "Network Error"}</span>
                </>
              ) : (
                <span>{`${response.status} ${response.status_text}`}</span>
              )}
            </span>
            
            {response.status !== 0 && (
              <>
                {response.timing ? (
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setIsWaterfallOpen(!isWaterfallOpen)}
                      className="text-text-secondary hover:text-text-primary px-1.5 py-0.5 rounded hover:bg-bg-hover transition cursor-pointer flex items-center space-x-1"
                      title="Click to view detailed network timing waterfall"
                    >
                      <Activity size={11} className="text-text-accent" />
                      <span>
                        Time: <strong className="text-text-primary">{response.time_ms} ms</strong>
                      </span>
                    </button>
                    <TimingWaterfallPopover
                      timing={response.timing}
                      isOpen={isWaterfallOpen}
                      onClose={() => setIsWaterfallOpen(false)}
                    />
                  </div>
                ) : (
                  <span className="text-text-secondary">
                    Time: <strong className="text-text-primary">{response.time_ms} ms</strong>
                  </span>
                )}
                <span className="text-text-secondary">
                  Size: <strong className="text-text-primary">{formatBytes(response.size_bytes)}</strong>
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3">
          <div className="w-7 h-7 border-2 border-text-accent border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-text-secondary animate-pulse">Dispatching API request...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !response && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border-primary rounded-sm bg-bg-primary/50">
          <Inbox className="w-8 h-8 text-text-secondary/40 mb-2" />
          <span className="text-text-secondary text-xs max-w-xs leading-relaxed">
            Hit Send in the Request Builder to dispatch the request and inspect the response.
          </span>
        </div>
      )}

      {/* Dedicated Network Error State (Status 0) */}
      {!isLoading && response && response.status === 0 && (
        <div className="flex-1 flex flex-col p-6 items-center justify-center text-center bg-bg-primary border border-border-primary rounded-sm min-h-0 overflow-y-auto">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3 text-red-400 flex-shrink-0">
            <WifiOff size={22} />
          </div>
          <h4 className="text-sm font-semibold text-text-primary tracking-wide mb-1">
            Could Not Send Request
          </h4>
          <p className="text-xs text-text-secondary max-w-sm leading-relaxed mb-4">
            Boltt was unable to establish a connection to the server. Check your connection or the URL and try again.
          </p>

          {/* Error Details Box */}
          <div className="w-full max-w-md bg-bg-secondary border border-red-500/20 rounded p-3 mb-4 text-left shadow-inner">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-red-400/90 tracking-wider mb-1.5">
              <span className="flex items-center space-x-1">
                <AlertCircle size={11} />
                <span>Error Details</span>
              </span>
              <button
                type="button"
                onClick={handleCopyError}
                className="text-text-secondary hover:text-text-primary flex items-center space-x-1 text-[10px] transition cursor-pointer"
                title="Copy error details"
              >
                <Copy size={10} />
                <span>Copy</span>
              </button>
            </div>
            <pre className="font-mono text-xs text-red-300 whitespace-pre-wrap break-all max-h-32 overflow-y-auto select-all leading-relaxed">
              {response.body.replace(/^send_request failed:\s*/i, "") || "Unknown network failure"}
            </pre>
          </div>

          {/* Troubleshooting Checklist */}
          <div className="w-full max-w-md bg-bg-tertiary/40 border border-border-primary rounded p-3 text-left mb-5">
            <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider mb-2">
              Troubleshooting Suggestions
            </div>
            <ul className="text-[11px] text-text-secondary space-y-1.5 list-disc list-inside leading-relaxed">
              <li>Ensure the server is running and reachable at the target URL.</li>
              <li>
                If using local or self-signed HTTPS, verify or disable{" "}
                <strong className="text-text-primary">SSL Verification</strong> in the URL bar.
              </li>
              <li>Check for typos in URL protocol (<code className="text-text-accent">http://</code> vs <code className="text-text-accent">https://</code>) or port number.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleRetry}
              className="px-3.5 py-1.5 rounded text-xs font-semibold bg-text-accent text-bg-primary hover:opacity-90 transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <RefreshCw size={12} />
              <span>Retry Request</span>
            </button>
            <button
              type="button"
              onClick={handleCopyCurl}
              className="px-3.5 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-primary transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Terminal size={12} />
              <span>Copy as cURL</span>
            </button>
          </div>
        </div>
      )}

      {/* Realized Response view split (Status != 0) */}
      {!isLoading && response && response.status !== 0 && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          
          {/* Quick Actions Panel */}
          <div className="flex items-center justify-end space-x-1.5 border border-border-primary bg-bg-tertiary py-1 px-2 flex-shrink-0 rounded-t-sm border-b-0">
            <button
              onClick={handleOpenCaptureFromBody}
              className="p-1 hover:bg-bg-hover text-text-accent hover:text-text-primary border border-transparent hover:border-border-primary rounded-sm transition flex items-center space-x-1 text-[11px] cursor-pointer"
              title="Capture response value into environment variable"
            >
              <Sparkles size={11} />
              <span>Capture Variable</span>
            </button>
            <button
              onClick={handleCopyCurl}
              className="p-1 hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-transparent hover:border-border-primary rounded-sm transition flex items-center space-x-1 text-[11px] cursor-pointer"
              title="Copy request as cURL command"
            >
              <Terminal size={11} />
              <span>cURL</span>
            </button>
            <button
              onClick={handleCopyBody}
              className="p-1 hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-transparent hover:border-border-primary rounded-sm transition flex items-center space-x-1 text-[11px] cursor-pointer"
              title="Copy response body"
            >
              <Copy size={11} />
              <span>Copy Body</span>
            </button>
            <button
              onClick={handleCopyHeaders}
              className="p-1 hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-transparent hover:border-border-primary rounded-sm transition flex items-center space-x-1 text-[11px] cursor-pointer"
              title="Copy response headers"
            >
              <Copy size={11} />
              <span>Copy Headers</span>
            </button>
          </div>

          {/* Resizable Headers vs Body vertically split */}
          <div
            ref={containerRef}
            className={`flex-grow bg-bg-primary p-3 border border-border-primary rounded-b-sm overflow-hidden min-h-0 flex flex-col ${
              isResizing ? "select-none" : ""
            }`}
          >
            {/* 1. Response Headers (Top) */}
            {response.headers.length > 0 ? (
              <div
                style={
                  !headersExpanded
                    ? { height: "20px" }
                    : headersExpanded && bodyExpanded
                    ? { height: `${headersHeight}px` }
                    : { height: `${Math.min((response?.headers?.length || 0) * 26 + 32, headersHeight)}px` }
                }
                className="flex flex-col min-h-0 overflow-hidden mb-2"
              >
                <h4
                  onClick={() => setHeadersExpanded(!headersExpanded)}
                  className="text-[10px] font-bold text-text-secondary uppercase mb-1.5 flex items-center space-x-1.5 flex-shrink-0 cursor-pointer hover:text-text-primary transition select-none"
                >
                  {headersExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <List size={11} />
                  <span>Response Headers ({response.headers.length})</span>
                </h4>
                {headersExpanded && (
                  <div className="flex-1 bg-bg-secondary/20 rounded border border-border-primary font-mono text-[11px] overflow-y-auto min-h-0 divide-y divide-bg-tertiary">
                    {response.headers.map((h, i) => (
                      <div
                        key={i}
                        className="group flex items-center justify-between py-1 px-2 hover:bg-bg-tertiary/40 transition"
                      >
                        <span className="text-text-secondary font-semibold select-none">{h.key}</span>
                        <div className="flex items-center space-x-2 pl-4 min-w-0">
                          <span className="text-text-primary text-right break-all select-all">{h.value}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCaptureHeader(h.key);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-bg-hover text-text-secondary hover:text-text-accent rounded cursor-pointer flex-shrink-0"
                            title={`Capture "${h.key}" as variable`}
                          >
                            <Sparkles size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* 2. Vertical Resize Separator */}
            {response.headers.length > 0 && (headersExpanded || bodyExpanded) && (
              <div
                onMouseDown={startResizing}
                className="h-2 hover:bg-text-accent/10 active:bg-text-accent/20 transition-all cursor-row-resize flex-shrink-0 flex flex-col items-center justify-center my-1 select-none"
              >
                <div className="h-[1px] w-full bg-border-primary" />
              </div>
            )}

            {/* 3. Response Body (Bottom) */}
            <div
              style={
                !bodyExpanded
                  ? { height: "20px" }
                  : { flex: 1 }
              }
              className="flex flex-col min-h-0 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1.5 flex-shrink-0 select-none">
                <h4
                  onClick={() => setBodyExpanded(!bodyExpanded)}
                  className="text-[10px] font-bold text-text-secondary uppercase flex items-center space-x-1.5 cursor-pointer hover:text-text-primary transition"
                >
                  {bodyExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <FileText size={11} />
                  <span>Response Body</span>
                </h4>
                {bodyExpanded && (
                  <button
                    type="button"
                    onClick={handleOpenCaptureFromBody}
                    className="text-[10px] text-text-secondary hover:text-text-accent flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-bg-hover transition cursor-pointer"
                    title="Capture variable from response body or current selection"
                  >
                    <Sparkles size={10} />
                    <span>Capture Variable</span>
                  </button>
                )}
              </div>
              {bodyExpanded && (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col border border-border-primary rounded-sm bg-bg-secondary/20">
                  {isResponseJson && (
                    <div className="flex items-center space-x-2 px-2.5 py-1.5 bg-bg-secondary border-b border-border-primary text-xs flex-shrink-0">
                      <div className="relative flex-1 flex items-center">
                        <Filter size={11} className="absolute left-2.5 text-text-secondary pointer-events-none" />
                        <input
                          type="text"
                          value={jsonPathQuery}
                          onChange={(e) => setJsonPathQuery(e.target.value)}
                          placeholder="Filter JSON with JSONPath (e.g. $.items[*].id or $.data)"
                          className="w-full bg-bg-primary text-text-primary border border-border-primary hover:border-text-secondary/40 focus:border-text-accent pl-7 pr-7 py-1 rounded text-xs font-mono focus:outline-none placeholder-text-secondary/40"
                        />
                        {jsonPathQuery && (
                          <button
                            type="button"
                            onClick={() => setJsonPathQuery("")}
                            className="absolute right-2 text-text-secondary hover:text-text-primary p-0.5 cursor-pointer"
                            title="Clear filter"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>

                      {jsonPathQuery && filterResult && (
                        <div className="flex-shrink-0">
                          {filterResult.success ? (
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-bg-hover text-text-accent border border-border-primary">
                              {filterResult.count} {filterResult.count === 1 ? "match" : "matches"}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30">
                              Invalid syntax
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {isResponseJson ? (
                    <div className="overflow-hidden text-xs font-mono flex-1 flex flex-col min-h-0">
                      <CodeMirror
                        value={displayedBody}
                        height="100%"
                        extensions={[json()]}
                        theme={theme === "light" ? "light" : "dark"}
                        readOnly={true}
                        className="flex-1 min-h-0"
                        style={{ height: "100%" }}
                      />
                    </div>
                  ) : (
                    <pre className="flex-1 w-full bg-bg-primary text-text-primary p-3 rounded font-mono text-xs overflow-y-auto whitespace-pre-wrap min-h-0">
                      {response.body || "(No response body returned)"}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* 4. Spacer at the bottom (if body is collapsed) */}
            {!bodyExpanded && <div className="flex-grow" />}
          </div>
        </div>
      )}

      {/* Capture Variable Modal */}
      <CaptureVariableModal
        isOpen={captureModalConfig.isOpen}
        onClose={() => setCaptureModalConfig((prev) => ({ ...prev, isOpen: false }))}
        initialSource={captureModalConfig.source}
        initialProperty={captureModalConfig.property}
        initialTargetVariable={captureModalConfig.targetVariable}
      />
    </div>
  );
};
