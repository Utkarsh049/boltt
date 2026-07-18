import React, { useState, useRef, useEffect } from "react";
import { useRequestStore, KeyValue, RequestBody } from "../../store/requestStore";
import { KVEditor } from "../KVEditor/KVEditor";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { ListFilter, Sliders, Code2, KeyRound, ShieldOff, Key, User, ChevronDown, Check, Sparkles } from "lucide-react";
import { useToastStore } from "../../store/toastStore";

type TabType = "params" | "headers" | "body" | "auth";

export const RequestPane: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("params");
  const { activeRequest, setParams, setHeaders, setBody, setAuth, tabs, activeTabId, theme } = useRequestStore();

  const [isAuthDropdownOpen, setIsAuthDropdownOpen] = useState(false);
  const authDropdownRef = useRef<HTMLDivElement>(null);

  const activeTabObj = tabs.find((t) => t.id === activeTabId);
  const bodyCache = activeTabObj?.bodyCache;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (authDropdownRef.current && !authDropdownRef.current.contains(event.target as Node)) {
        setIsAuthDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const authOptions = [
    { value: "None", label: "Inherit / None", icon: ShieldOff },
    { value: "Bearer", label: "Bearer Token", icon: Key },
    { value: "Basic", label: "Basic Auth", icon: User },
  ] as const;

  const selectedOption = authOptions.find((opt) => opt.value === activeRequest.auth.type) || authOptions[0];
  const SelectedIcon = selectedOption.icon;

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
    return `h-9 px-4 flex items-center space-x-1.5 border border-transparent text-xs font-semibold select-none cursor-pointer transition-[color,background-color] duration-150 ${
      isActive
        ? `bg-bg-primary text-text-accent border-r-border-primary ${
            tab === "params" ? "border-l-transparent" : "border-l-border-primary"
          } -mb-[1px]`
        : "text-text-secondary hover:text-text-primary"
    }`;
  };

  // Body change handler
  const handleBodyTypeChange = (type: "Json" | "Raw" | "FormData" | "None") => {
    if (type === "None") {
      setBody({ type: "None" });
    } else if (type === "Json") {
      setBody({ type: "Json", content: bodyCache?.Json ?? "{}" });
    } else if (type === "Raw") {
      setBody({ type: "Raw", content: bodyCache?.Raw ?? "" });
    } else if (type === "FormData") {
      setBody({ type: "FormData", content: bodyCache?.FormData ?? [] });
    }
  };

  const handleBodyContentChange = (content: string) => {
    if (activeRequest.body.type === "Json" || activeRequest.body.type === "Raw") {
      setBody({ ...activeRequest.body, content } as RequestBody);
    }
  };

  const handleBeautifyJson = () => {
    if (activeRequest.body.type !== "Json") return;
    try {
      const currentContent = activeRequest.body.content || "";
      if (!currentContent.trim()) return;
      const parsed = JSON.parse(currentContent);
      const formatted = JSON.stringify(parsed, null, 2);
      handleBodyContentChange(formatted);
      useToastStore.getState().showToast("JSON formatted successfully", "success");
    } catch (err) {
      useToastStore.getState().showToast("Invalid JSON syntax", "error");
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
    <div className="flex-1 flex flex-col border border-border-primary bg-bg-secondary rounded-sm overflow-hidden">
      {/* Horizontal Tabs Header */}
      <div className="flex items-end border-b border-border-primary bg-bg-tertiary h-9">
        <button onClick={() => setActiveTab("params")} className={tabClass("params")}>
          <ListFilter size={13} />
          <span>Params</span>
          {activeParamsCount > 0 && (
            <span className="bg-bg-hover text-text-accent text-[10px] px-1.5 rounded-full border border-border-primary">
              {activeParamsCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("headers")} className={tabClass("headers")}>
          <Sliders size={13} />
          <span>Headers</span>
          {activeHeadersCount > 0 && (
            <span className="bg-bg-hover text-text-accent text-[10px] px-1.5 rounded-full border border-border-primary">
              {activeHeadersCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("body")} className={tabClass("body")}>
          <Code2 size={13} />
          <span>Body</span>
          {activeBodyCount > 0 && (
            <span className="w-1.5 h-1.5 bg-text-accent rounded-full"></span>
          )}
        </button>
        <button onClick={() => setActiveTab("auth")} className={tabClass("auth")}>
          <KeyRound size={13} />
          <span>Authorization</span>
          {isAuthActive && (
            <span className="w-1.5 h-1.5 bg-text-accent rounded-full"></span>
          )}
        </button>
      </div>

      {/* Tab Panel Content */}
      <div className="flex-1 p-4 bg-bg-primary overflow-y-auto">
        {/* Params Tab */}
        {activeTab === "params" && (
          <div className="animate-tab-fade space-y-2">
            <div className="text-[11px] text-text-secondary mb-2 font-semibold uppercase tracking-wider">
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
          <div className="animate-tab-fade space-y-2">
            <div className="text-[11px] text-text-secondary mb-2 font-semibold uppercase tracking-wider">
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
          <div className="animate-tab-fade space-y-4 flex flex-col h-full">
            {/* Body Mode Selector */}
            <div className="flex space-x-2 border-b border-border-primary pb-3">
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
                        ? "bg-bg-hover text-text-accent border-text-accent"
                        : "bg-transparent text-text-secondary border-border-primary hover:text-text-primary"
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
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] text-text-secondary font-mono">JSON Body Content:</div>
                   <button
                    type="button"
                    onClick={handleBeautifyJson}
                    className="text-[9px] bg-bg-hover text-text-accent border border-border-primary px-2 py-0.5 rounded hover:bg-[#32353b] cursor-pointer transition select-none font-semibold hover:border-text-accent/30 active:scale-95 flex items-center space-x-1"
                    title="Format JSON content"
                  >
                    <Sparkles size={10} />
                    <span>Beautify</span>
                  </button>
                </div>
                <div className="flex-1 border border-border-primary rounded-sm overflow-hidden text-xs">
                  <CodeMirror
                    value={activeRequest.body.content || ""}
                    height="100%"
                    minHeight="200px"
                    extensions={[json()]}
                    onChange={handleBodyContentChange}
                    theme={theme === "light" ? "light" : "dark"}
                    className="font-mono h-full"
                  />
                </div>
              </div>
            )}

            {/* Raw Text Editor */}
            {activeRequest.body.type === "Raw" && (
              <div className="flex-1 flex flex-col min-h-[220px]">
                <div className="text-[10px] text-text-secondary mb-1 font-mono">Plain Text Body Content:</div>
                <textarea
                  value={activeRequest.body.content || ""}
                  onChange={(e) => handleBodyContentChange(e.target.value)}
                  className="flex-1 bg-bg-primary text-text-primary border border-border-primary p-3 rounded-sm font-mono text-xs focus:outline-none focus:border-text-accent placeholder-text-secondary/40 min-h-[180px]"
                  placeholder="Enter raw request body..."
                />
              </div>
            )}

            {/* FormData KV Table */}
            {activeRequest.body.type === "FormData" && (
              <div className="space-y-2">
                <div className="text-[10px] text-text-secondary mb-1 font-mono">Multipart Form parameters:</div>
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
              <div className="flex-1 flex items-center justify-center py-10 border border-dashed border-border-primary rounded bg-bg-secondary/20">
                <span className="text-text-secondary text-xs">This request has no body payload.</span>
              </div>
            )}
          </div>
        )}

        {/* Auth Tab */}
        {activeTab === "auth" && (
          <div className="animate-tab-fade space-y-4">
            {/* Auth Dropdown selector type */}
            <div className="flex items-center space-x-3 mb-4">
              <label className="text-xs text-text-secondary">Auth Type:</label>
              <div className="relative inline-block text-left" ref={authDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsAuthDropdownOpen(!isAuthDropdownOpen)}
                  className="flex items-center justify-between px-3 py-1.5 min-w-[150px] bg-bg-tertiary text-text-primary border border-border-primary rounded-sm text-xs font-medium cursor-pointer select-none hover:bg-bg-hover transition duration-150 focus:outline-none focus:border-text-accent"
                >
                  <div className="flex items-center space-x-2">
                    <SelectedIcon size={13} className="text-text-secondary" />
                    <span>{selectedOption.label}</span>
                  </div>
                  <ChevronDown size={14} className="text-text-secondary ml-1 flex-shrink-0" />
                </button>

                {isAuthDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-[160px] bg-bg-secondary border border-border-primary rounded shadow-2xl z-50 py-1 overflow-hidden font-sans">
                    {authOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = activeRequest.auth.type === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            handleAuthTypeChange(opt.value);
                            setIsAuthDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition cursor-pointer hover:bg-bg-tertiary/60 ${
                            isSelected ? "text-text-accent font-semibold bg-bg-tertiary" : "text-text-primary"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Icon
                              size={13}
                              className={isSelected ? "text-text-accent" : "text-text-secondary"}
                            />
                            <span>{opt.label}</span>
                          </div>
                          {isSelected && <Check size={12} className="text-text-accent" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bearer Token Form */}
            {activeRequest.auth.type === "Bearer" && (
              <div className="space-y-3 p-4 bg-bg-secondary border border-border-primary rounded-sm max-w-lg">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs text-text-secondary font-semibold">Token</label>
                  <input
                    type="text"
                    value={activeRequest.auth.config.token}
                    onChange={(e) => handleBearerTokenChange(e.target.value)}
                    placeholder="Enter Bearer Token value"
                    className="bg-bg-primary text-text-primary border border-border-primary px-3 py-1.5 rounded-sm text-xs font-mono focus:outline-none focus:border-text-accent placeholder-text-secondary/40"
                  />
                </div>
                {/* Visual token live preview */}
                <div className="text-[11px] text-text-secondary pt-1">
                  This will be sent as:{" "}
                  <code className="text-amber-300 font-mono select-all break-all bg-bg-primary px-1.5 py-1 rounded border border-border-primary">
                    Authorization: Bearer {activeRequest.auth.config.token || "<token>"}
                  </code>
                </div>
              </div>
            )}

            {/* Basic Auth Form */}
            {activeRequest.auth.type === "Basic" && (
              <div className="space-y-3 p-4 bg-bg-secondary border border-border-primary rounded-sm max-w-lg">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs text-text-secondary font-semibold">Username</label>
                  <input
                    type="text"
                    value={activeRequest.auth.config.username}
                    onChange={(e) => handleBasicAuthChange("username", e.target.value)}
                    placeholder="Username"
                    className="bg-bg-primary text-text-primary border border-border-primary px-3 py-1.5 rounded-sm text-xs font-mono focus:outline-none focus:border-text-accent placeholder-text-secondary/40"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs text-text-secondary font-semibold">Password</label>
                  <input
                    type="password"
                    value={activeRequest.auth.config.password}
                    onChange={(e) => handleBasicAuthChange("password", e.target.value)}
                    placeholder="Password"
                    className="bg-bg-primary text-text-primary border border-border-primary px-3 py-1.5 rounded-sm text-xs font-mono focus:outline-none focus:border-text-accent placeholder-text-secondary/40"
                  />
                </div>
                {/* Visual basic auth live preview */}
                <div className="text-[11px] text-text-secondary pt-1">
                  This will be sent as:{" "}
                  <code className="text-amber-300 font-mono bg-bg-primary px-1.5 py-0.5 rounded border border-border-primary">
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
              <div className="py-10 text-center border border-dashed border-border-primary rounded bg-bg-secondary/20">
                <span className="text-text-secondary text-xs">
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
