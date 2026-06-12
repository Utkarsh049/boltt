import React, { useState } from "react";
import { useRequestStore, KeyValue, RequestBody } from "../../store/requestStore";
import { KVEditor } from "../KVEditor/KVEditor";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { ListFilter, Sliders, Code2, KeyRound } from "lucide-react";

type TabType = "params" | "headers" | "body" | "auth";

export const RequestPane: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("params");
  const { activeRequest, setParams, setHeaders, setBody, setAuth } = useRequestStore();

  // Active counts
  const activeParamsCount = activeRequest.params.filter((p) => p.enabled && p.key).length;
  const activeHeadersCount = activeRequest.headers.filter((h) => h.enabled && h.key).length;

  let activeBodyCount = 0;
  if (activeRequest.body.type === "FormData") {
    activeBodyCount = activeRequest.body.content.filter((f) => f.enabled && f.key).length;
  } else if (activeRequest.body.type === "Json" && activeRequest.body.content) {
    activeBodyCount = 1;
  } else if (activeRequest.body.type === "Raw" && activeRequest.body.content) {
    activeBodyCount = 1;
  }

  const isAuthActive = activeRequest.auth.type !== "None";

  // Tab label helper
  const tabClass = (tab: TabType) => {
    const isActive = activeTab === tab;
    return `h-9 px-4 flex items-center space-x-1.5 border-t-2 text-xs font-semibold select-none cursor-pointer transition ${
      isActive
        ? "bg-[#101419] text-[#a1c9ff] border-t-[#a1c9ff] border-r border-l border-[#30363D]"
        : "border-t-transparent text-[#8b919d] hover:text-[#e0e2ea]"
    }`;
  };

  // Body change handler
  const handleBodyTypeChange = (type: "Json" | "Raw" | "FormData" | "None") => {
    if (type === "None") {
      setBody({ type: "None" });
    } else if (type === "Json") {
      setBody({ type: "Json", content: "{}" });
    } else if (type === "Raw") {
      setBody({ type: "Raw", content: "" });
    } else if (type === "FormData") {
      setBody({ type: "FormData", content: [] });
    }
  };

  const handleBodyContentChange = (content: string) => {
    if (activeRequest.body.type === "Json" || activeRequest.body.type === "Raw") {
      setBody({ ...activeRequest.body, content } as RequestBody);
    }
  };

  const handleBodyFormChange = (formRows: KeyValue[]) => {
    if (activeRequest.body.type === "FormData") {
      setBody({ type: "FormData", content: formRows });
    }
  };

  // Auth helper handlers
  const handleAuthTypeChange = (type: "None" | "Bearer" | "Basic") => {
    if (type === "None") {
      setAuth({ type: "None" });
    } else if (type === "Bearer") {
      setAuth({ type: "Bearer", config: { token: "" } });
    } else if (type === "Basic") {
      setAuth({ type: "Basic", config: { username: "", password: "" } });
    }
  };

  const handleBearerTokenChange = (token: string) => {
    if (activeRequest.auth.type === "Bearer") {
      setAuth({ type: "Bearer", config: { token } });
    }
  };

  const handleBasicAuthChange = (field: "username" | "password", val: string) => {
    if (activeRequest.auth.type === "Basic") {
      setAuth({
        type: "Basic",
        config: {
          ...activeRequest.auth.config,
          [field]: val,
        },
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col border border-[#30363D] bg-[#161B22] rounded-sm overflow-hidden">
      {/* Horizontal Tabs Header */}
      <div className="flex items-end border-b border-[#30363D] bg-[#1c2025] h-9">
        <button onClick={() => setActiveTab("params")} className={tabClass("params")}>
          <ListFilter size={13} />
          <span>Params</span>
          {activeParamsCount > 0 && (
            <span className="bg-[#272a30] text-[#a1c9ff] text-[10px] px-1.5 rounded-full border border-[#30363D]">
              {activeParamsCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("headers")} className={tabClass("headers")}>
          <Sliders size={13} />
          <span>Headers</span>
          {activeHeadersCount > 0 && (
            <span className="bg-[#272a30] text-[#a1c9ff] text-[10px] px-1.5 rounded-full border border-[#30363D]">
              {activeHeadersCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("body")} className={tabClass("body")}>
          <Code2 size={13} />
          <span>Body</span>
          {activeBodyCount > 0 && (
            <span className="w-1.5 h-1.5 bg-[#a1c9ff] rounded-full"></span>
          )}
        </button>
        <button onClick={() => setActiveTab("auth")} className={tabClass("auth")}>
          <KeyRound size={13} />
          <span>Authorization</span>
          {isAuthActive && (
            <span className="w-1.5 h-1.5 bg-[#a1c9ff] rounded-full animate-pulse"></span>
          )}
        </button>
      </div>

      {/* Tab Panel Content */}
      <div className="flex-1 p-4 bg-[#101419] overflow-y-auto">
        {/* Params Tab */}
        {activeTab === "params" && (
          <div className="space-y-2">
            <div className="text-[11px] text-[#8b919d] mb-2 font-semibold uppercase tracking-wider">
              Query Parameters
            </div>
            <KVEditor
              rows={activeRequest.params}
              onChange={setParams}
              keyPlaceholder="Parameter Name"
              valuePlaceholder="Value"
            />
          </div>
        )}

        {/* Headers Tab */}
        {activeTab === "headers" && (
          <div className="space-y-2">
            <div className="text-[11px] text-[#8b919d] mb-2 font-semibold uppercase tracking-wider">
              Request Headers
            </div>
            <KVEditor
              rows={activeRequest.headers}
              onChange={setHeaders}
              keyPlaceholder="Header Name"
              valuePlaceholder="Value"
            />
          </div>
        )}

        {/* Body Tab */}
        {activeTab === "body" && (
          <div className="space-y-4 flex flex-col h-full">
            {/* Body Mode Selector */}
            <div className="flex space-x-2 border-b border-[#30363D] pb-3">
              {(["None", "Json", "Raw", "FormData"] as const).map((mode) => {
                const isSelected =
                  (mode === "None" && activeRequest.body.type === "None") ||
                  (mode === "Json" && activeRequest.body.type === "Json") ||
                  (mode === "Raw" && activeRequest.body.type === "Raw") ||
                  (mode === "FormData" && activeRequest.body.type === "FormData");

                return (
                  <button
                    key={mode}
                    onClick={() => handleBodyTypeChange(mode)}
                    className={`px-3 py-1 text-xs rounded-sm border transition ${
                      isSelected
                        ? "bg-[#272a30] text-[#a1c9ff] border-[#a1c9ff]"
                        : "bg-transparent text-[#8b919d] border-[#30363D] hover:text-[#e0e2ea]"
                    }`}
                  >
                    {mode === "FormData" ? "Form-data" : mode}
                  </button>
                );
              })}
            </div>

            {/* JSON Code Editor */}
            {activeRequest.body.type === "Json" && (
              <div className="flex-1 flex flex-col min-h-[220px]">
                <div className="text-[10px] text-[#8b919d] mb-1 font-mono">JSON Body Content:</div>
                <div className="flex-1 border border-[#30363D] rounded-sm overflow-hidden text-xs">
                  <CodeMirror
                    value={activeRequest.body.content || ""}
                    height="100%"
                    minHeight="200px"
                    extensions={[json()]}
                    onChange={handleBodyContentChange}
                    theme="dark"
                    className="font-mono h-full"
                  />
                </div>
              </div>
            )}

            {/* Raw Text Editor */}
            {activeRequest.body.type === "Raw" && (
              <div className="flex-1 flex flex-col min-h-[220px]">
                <div className="text-[10px] text-[#8b919d] mb-1 font-mono">Plain Text Body Content:</div>
                <textarea
                  value={activeRequest.body.content || ""}
                  onChange={(e) => handleBodyContentChange(e.target.value)}
                  className="flex-1 bg-[#101419] text-[#e0e2ea] border border-[#30363D] p-3 rounded-sm font-mono text-xs focus:outline-none focus:border-[#a1c9ff] placeholder-[#8b919d]/40 min-h-[180px]"
                  placeholder="Enter raw request body..."
                />
              </div>
            )}

            {/* FormData KV Table */}
            {activeRequest.body.type === "FormData" && (
              <div className="space-y-2">
                <div className="text-[10px] text-[#8b919d] mb-1 font-mono">Multipart Form parameters:</div>
                <KVEditor
                  rows={activeRequest.body.content || []}
                  onChange={handleBodyFormChange}
                  keyPlaceholder="Form Key"
                  valuePlaceholder="Form Value"
                />
              </div>
            )}

            {/* None / Empty state */}
            {activeRequest.body.type === "None" && (
              <div className="flex-1 flex items-center justify-center py-10 border border-dashed border-[#30363D] rounded bg-[#161B22]/20">
                <span className="text-[#8b919d] text-xs">This request has no body payload.</span>
              </div>
            )}
          </div>
        )}

        {/* Auth Tab */}
        {activeTab === "auth" && (
          <div className="space-y-4">
            {/* Auth Dropdown selector type */}
            <div className="flex items-center space-x-3 mb-4">
              <label className="text-xs text-[#8b919d]">Auth Type:</label>
              <select
                value={activeRequest.auth.type}
                onChange={(e) => handleAuthTypeChange(e.target.value as "None" | "Bearer" | "Basic")}
                className="bg-[#1c2025] text-[#e0e2ea] border border-[#30363D] px-2 py-1 rounded-sm text-xs focus:outline-none focus:border-[#a1c9ff] cursor-pointer"
              >
                <option value="None">Inherit / None</option>
                <option value="Bearer">Bearer Token</option>
                <option value="Basic">Basic Auth</option>
              </select>
            </div>

            {/* Bearer Token Form */}
            {activeRequest.auth.type === "Bearer" && (
              <div className="space-y-3 p-4 bg-[#161B22] border border-[#30363D] rounded-sm max-w-lg">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs text-[#8b919d] font-semibold">Token</label>
                  <input
                    type="text"
                    value={activeRequest.auth.config.token}
                    onChange={(e) => handleBearerTokenChange(e.target.value)}
                    placeholder="Enter Bearer Token value"
                    className="bg-[#101419] text-[#e0e2ea] border border-[#30363D] px-3 py-1.5 rounded-sm text-xs font-mono focus:outline-none focus:border-[#a1c9ff] placeholder-[#8b919d]/40"
                  />
                </div>
                {/* Visual token live preview */}
                <div className="text-[11px] text-[#8b919d] pt-1">
                  💡 This will be sent as:{" "}
                  <code className="text-amber-300 font-mono select-all break-all bg-[#101419] px-1.5 py-0.5 rounded border border-[#30363D]">
                    Authorization: Bearer {activeRequest.auth.config.token || "<token>"}
                  </code>
                </div>
              </div>
            )}

            {/* Basic Auth Form */}
            {activeRequest.auth.type === "Basic" && (
              <div className="space-y-3 p-4 bg-[#161B22] border border-[#30363D] rounded-sm max-w-lg">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs text-[#8b919d] font-semibold">Username</label>
                  <input
                    type="text"
                    value={activeRequest.auth.config.username}
                    onChange={(e) => handleBasicAuthChange("username", e.target.value)}
                    placeholder="Username"
                    className="bg-[#101419] text-[#e0e2ea] border border-[#30363D] px-3 py-1.5 rounded-sm text-xs font-mono focus:outline-none focus:border-[#a1c9ff] placeholder-[#8b919d]/40"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs text-[#8b919d] font-semibold">Password</label>
                  <input
                    type="password"
                    value={activeRequest.auth.config.password}
                    onChange={(e) => handleBasicAuthChange("password", e.target.value)}
                    placeholder="Password"
                    className="bg-[#101419] text-[#e0e2ea] border border-[#30363D] px-3 py-1.5 rounded-sm text-xs font-mono focus:outline-none focus:border-[#a1c9ff] placeholder-[#8b919d]/40"
                  />
                </div>
                {/* Visual basic auth live preview */}
                <div className="text-[11px] text-[#8b919d] pt-1">
                  💡 This will be sent as:{" "}
                  <code className="text-amber-300 font-mono bg-[#101419] px-1.5 py-0.5 rounded border border-[#30363D]">
                    Authorization: Basic {
                      activeRequest.auth.config.username || activeRequest.auth.config.password
                        ? btoa(`${activeRequest.auth.config.username}:${activeRequest.auth.config.password}`)
                        : "<base64 encoded credentials>"
                    }
                  </code>
                </div>
              </div>
            )}

            {/* Inherit / None state */}
            {activeRequest.auth.type === "None" && (
              <div className="py-10 text-center border border-dashed border-[#30363D] rounded bg-[#161B22]/20">
                <span className="text-[#8b919d] text-xs">
                  No authorization headers will be injected automatically.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
