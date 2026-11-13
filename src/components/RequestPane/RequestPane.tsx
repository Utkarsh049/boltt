import React, { useState, useRef, useEffect, useMemo } from "react";
import { useRequestStore, KeyValue, RequestBody, ResponseExtractor, ExtractorSource } from "../../store/requestStore";
import { useEnvStore } from "../../store/envStore";
import { useProjectsStore } from "../../store/projectsStore";
import { findFolderAncestry, resolveEffectiveAuth, resolveRequestInheritance } from "../../utils/inheritance";
import { KVEditor } from "../KVEditor/KVEditor";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { autocompletion } from "@codemirror/autocomplete";
import { createVariableCompletionSource } from "../../utils/dynamicVariables";
import { extractValueFromResponse } from "../../utils/responseExtractor";
import {
  ListFilter,
  Sliders,
  Code2,
  KeyRound,
  ShieldOff,
  Key,
  User,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Link2,
  Plus,
  Trash2,
} from "lucide-react";
import { useToastStore } from "../../store/toastStore";

type TabType = "params" | "headers" | "body" | "auth" | "extractors";

const ExtractorSourceDropdown: React.FC<{
  source: ExtractorSource;
  onChange: (s: ExtractorSource) => void;
}> = ({ source, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options: { value: ExtractorSource; label: string }[] = [
    { value: "body", label: "Body (JSONPath)" },
    { value: "header", label: "Response Header" },
    { value: "status", label: "Status Code" },
  ];

  const currentLabel = options.find((o) => o.value === source)?.label || "Body (JSONPath)";

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-bg-primary text-text-primary border border-border-primary hover:border-text-secondary/50 px-2 py-1 rounded-sm text-xs flex items-center justify-between transition cursor-pointer select-none"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={11} className="text-text-secondary ml-1 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-full min-w-[145px] bg-bg-secondary border border-border-primary rounded shadow-2xl z-50 py-1 overflow-hidden font-sans">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between transition cursor-pointer ${
                source === opt.value
                  ? "bg-bg-tertiary text-text-accent font-semibold"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60"
              }`}
            >
              <span>{opt.label}</span>
              {source === opt.value && <Check size={11} className="text-text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const RequestPane: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("params");
  const {
    activeRequest,
    setParams,
    setHeaders,
    setBody,
    setAuth,
    setExtractors,
    response,
    tabs,
    activeTabId,
    theme,
  } = useRequestStore();

  const projects = useProjectsStore((state) => state.projects);
  const activeRequestId = useProjectsStore((state) => state.activeRequestId);

  const [isAuthDropdownOpen, setIsAuthDropdownOpen] = useState(false);
  const [showInheritedHeaders, setShowInheritedHeaders] = useState(true);
  const authDropdownRef = useRef<HTMLDivElement>(null);

  // Scrollable & slidable tabs container state
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isDraggingTabsRef = useRef(false);
  const startTabsXRef = useRef(0);
  const scrollTabsLeftRef = useRef(0);
  const hasDraggedTabsRef = useRef(false);

  const checkTabsScroll = () => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    checkTabsScroll();
    const el = tabsContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkTabsScroll);
    const ro = new ResizeObserver(checkTabsScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkTabsScroll);
      ro.disconnect();
    };
  }, []);

  const handleTabsWheel = (e: React.WheelEvent) => {
    if (e.deltaY !== 0 && tabsContainerRef.current) {
      tabsContainerRef.current.scrollLeft += e.deltaY;
      checkTabsScroll();
    }
  };

  const handleTabsMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !tabsContainerRef.current) return;
    isDraggingTabsRef.current = true;
    hasDraggedTabsRef.current = false;
    startTabsXRef.current = e.pageX - tabsContainerRef.current.offsetLeft;
    scrollTabsLeftRef.current = tabsContainerRef.current.scrollLeft;
  };

  const handleTabsMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingTabsRef.current || !tabsContainerRef.current) return;
    const x = e.pageX - tabsContainerRef.current.offsetLeft;
    const walk = x - startTabsXRef.current;
    if (Math.abs(walk) > 3) {
      hasDraggedTabsRef.current = true;
    }
    tabsContainerRef.current.scrollLeft = scrollTabsLeftRef.current - walk;
    checkTabsScroll();
  };

  const handleTabsMouseUp = () => {
    isDraggingTabsRef.current = false;
  };

  const handleSelectTab = (tab: TabType, e: React.MouseEvent<HTMLButtonElement>) => {
    if (hasDraggedTabsRef.current) {
      hasDraggedTabsRef.current = false;
      return;
    }
    setActiveTab(tab);
    e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  };

  const activeTabObj = tabs.find((t) => t.id === activeTabId);
  const bodyCache = activeTabObj?.bodyCache;

  // Determine current request ID (request id, activeRequestId from projectsStore, or activeTabId)
  const currentRequestId = activeRequest.id || activeRequestId || activeTabId;

  // Resolve folder ancestry & inheritance
  const ancestry = useMemo(() => {
    return currentRequestId ? findFolderAncestry(projects, currentRequestId) : null;
  }, [projects, currentRequestId]);

  const inheritance = useMemo(() => {
    return resolveRequestInheritance(projects, currentRequestId, activeRequest);
  }, [projects, currentRequestId, activeRequest]);

  // Auth that would be inherited if set to "Inherit"
  const parentInheritedAuth = useMemo(() => {
    if (!ancestry || ancestry.folderChain.length === 0) return null;
    const res = resolveEffectiveAuth({ type: "Inherit" }, ancestry.folderChain);
    return res.effectiveAuth.type !== "None" ? res : null;
  }, [ancestry]);

  const completionExtension = useMemo(() => {
    return autocompletion({
      override: [
        createVariableCompletionSource(
          () => useEnvStore.getState().getFlatActiveVariables(),
          () => useEnvStore.getState().getSecretKeys()
        ),
      ],
      defaultKeymap: true,
    });
  }, []);

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
    { value: "Inherit", label: "Inherit from parent", icon: Link2 },
    { value: "None", label: "No Auth", icon: ShieldOff },
    { value: "Bearer", label: "Bearer Token", icon: Key },
    { value: "Basic", label: "Basic Auth", icon: User },
  ] as const;

  const selectedOption = authOptions.find((opt) => opt.value === activeRequest.auth.type) || authOptions[0];
  const SelectedIcon = selectedOption.icon;

  // Active counts
  const activeParamsCount = activeRequest.params.filter((p) => p.enabled && p.key).length;
  const activeHeadersCount = activeRequest.headers.filter((h) => h.enabled && h.key).length;
  const inheritedHeadersCount = inheritance.inheritedHeaders.filter((h) => h.enabled && h.key).length;

  let activeBodyCount = 0;
  if (activeRequest.body.type === "FormData") {
    activeBodyCount = activeRequest.body.content.filter((f) => f.enabled && f.key).length;
  } else if (activeRequest.body.type === "Json" && activeRequest.body.content) {
    activeBodyCount = 1;
  } else if (activeRequest.body.type === "Raw" && activeRequest.body.content) {
    activeBodyCount = 1;
  }

  const isAuthActive =
    activeRequest.auth.type === "Bearer" ||
    activeRequest.auth.type === "Basic" ||
    (activeRequest.auth.type === "Inherit" && inheritance.effectiveAuth.type !== "None");

  const extractors = activeRequest.extractors || [];
  const activeExtractorsCount = extractors.filter((e) => e.enabled && e.targetVariable.trim()).length;

  const handleAddExtractor = () => {
    const newExtractor: ResponseExtractor = {
      id: crypto.randomUUID(),
      source: "body",
      property: "",
      targetVariable: "",
      enabled: true,
    };
    setExtractors([...extractors, newExtractor]);
  };

  const handleUpdateExtractor = (id: string, updates: Partial<ResponseExtractor>) => {
    setExtractors(extractors.map((ext) => (ext.id === id ? { ...ext, ...updates } : ext)));
  };

  const handleDeleteExtractor = (id: string) => {
    setExtractors(extractors.filter((ext) => ext.id !== id));
  };

  // Tab label helper
  const tabClass = (tab: TabType) => {
    const isActive = activeTab === tab;
    return `h-full px-4 flex items-center space-x-1.5 text-xs font-semibold select-none cursor-pointer flex-shrink-0 whitespace-nowrap transition-[color,background-color] duration-150 ${
      isActive
        ? `bg-bg-primary text-text-accent border-r border-r-border-primary ${
            tab === "params" ? "border-l border-l-transparent" : "border-l border-l-border-primary"
          } border-b border-b-bg-primary border-t border-t-transparent`
        : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-hover/40 border-r border-r-border-primary border-l border-l-transparent border-b border-b-border-primary border-t border-t-transparent"
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
  const handleAuthTypeChange = (type: "Inherit" | "None" | "Bearer" | "Basic") => {
    if (type === "Inherit") {
      setAuth({ type: "Inherit" });
    } else if (type === "None") {
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
      <div className="relative flex items-center bg-bg-tertiary h-9 overflow-hidden">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => tabsContainerRef.current?.scrollBy({ left: -110, behavior: "smooth" })}
            className="absolute left-0 top-0 bottom-0 z-10 w-6 bg-gradient-to-r from-bg-tertiary via-bg-tertiary/90 to-transparent flex items-center justify-start pl-0.5 text-text-secondary hover:text-text-primary cursor-pointer transition-colors border-b border-b-border-primary"
            title="Scroll tabs left"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft size={13} />
          </button>
        )}

        <div
          ref={tabsContainerRef}
          onWheel={handleTabsWheel}
          onMouseDown={handleTabsMouseDown}
          onMouseMove={handleTabsMouseMove}
          onMouseUp={handleTabsMouseUp}
          onMouseLeave={handleTabsMouseUp}
          className="flex items-stretch h-full overflow-x-auto scrollbar-none flex-nowrap w-full select-none cursor-grab active:cursor-grabbing"
        >
          <button onClick={(e) => handleSelectTab("params", e)} className={tabClass("params")}>
            <ListFilter size={13} />
            <span>Params</span>
            {activeParamsCount > 0 && (
              <span className="bg-bg-hover text-text-accent text-[10px] px-1.5 rounded-full border border-border-primary">
                {activeParamsCount}
              </span>
            )}
          </button>
          <button onClick={(e) => handleSelectTab("headers", e)} className={tabClass("headers")}>
            <Sliders size={13} />
            <span>Headers</span>
            {activeHeadersCount > 0 && (
              <span className="bg-bg-hover text-text-accent text-[10px] px-1.5 rounded-full border border-border-primary">
                {activeHeadersCount}
              </span>
            )}
            {inheritedHeadersCount > 0 && (
              <span
                className="bg-bg-tertiary text-text-secondary text-[10px] px-1.5 rounded-full border border-border-primary font-mono"
                title={`${inheritedHeadersCount} headers cascading from parent folders`}
              >
                +{inheritedHeadersCount}
              </span>
            )}
          </button>
          <button onClick={(e) => handleSelectTab("body", e)} className={tabClass("body")}>
            <Code2 size={13} />
            <span>Body</span>
            {activeBodyCount > 0 && (
              <span className="w-1.5 h-1.5 bg-text-accent rounded-full"></span>
            )}
          </button>
          <button onClick={(e) => handleSelectTab("auth", e)} className={tabClass("auth")}>
            <KeyRound size={13} />
            <span>Authorization</span>
            {isAuthActive && (
              <span className="w-1.5 h-1.5 bg-text-accent rounded-full"></span>
            )}
          </button>
          <button onClick={(e) => handleSelectTab("extractors", e)} className={tabClass("extractors")}>
            <Link2 size={13} />
            <span>Extractors</span>
            {activeExtractorsCount > 0 && (
              <span className="bg-bg-hover text-text-accent text-[10px] px-1.5 rounded-full border border-border-primary font-mono">
                {activeExtractorsCount}
              </span>
            )}
          </button>
          {/* Spacer filling remaining tabs bar width with bottom border */}
          <div className="flex-1 h-full border-b border-b-border-primary bg-bg-tertiary min-w-[20px]" />
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => tabsContainerRef.current?.scrollBy({ left: 110, behavior: "smooth" })}
            className="absolute right-0 top-0 bottom-0 z-10 w-6 bg-gradient-to-l from-bg-tertiary via-bg-tertiary/90 to-transparent flex items-center justify-end pr-0.5 text-text-secondary hover:text-text-primary cursor-pointer transition-colors border-b border-b-border-primary"
            title="Scroll tabs right"
            aria-label="Scroll tabs right"
          >
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      {/* Tab Panel Content */}
      <div className="flex-1 p-4 bg-bg-primary overflow-y-auto">
        {/* Params Tab */}
        {activeTab === "params" && (
          <div className="animate-tab-fade space-y-2">
            <div className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider">
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
            {/* Inherited Headers Cascade */}
            {inheritance.inheritedHeaders.length > 0 && (
              <div className="border border-border-primary rounded-sm bg-bg-secondary/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowInheritedHeaders(!showInheritedHeaders)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-bg-tertiary text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer select-none"
                >
                  <div className="flex items-center space-x-2">
                    <Link2 size={12} className="text-text-accent" />
                    <span>Inherited Headers from Folders</span>
                    <span className="bg-bg-primary text-text-accent text-[10px] px-1.5 rounded border border-border-primary font-mono">
                      {inheritance.inheritedHeaders.length}
                    </span>
                  </div>
                  {showInheritedHeaders ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {showInheritedHeaders && (
                  <div className="p-2 space-y-1 divide-y divide-border-primary/40 font-mono text-xs">
                    {inheritance.inheritedHeaders.map((ih, idx) => {
                      const isOverridden = activeRequest.headers.some(
                        (rh) => rh.enabled && rh.key.trim().toLowerCase() === ih.key.trim().toLowerCase()
                      );
                      return (
                        <div key={idx} className="flex items-center justify-between py-1 px-1 text-[11px]">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className={`font-semibold ${isOverridden ? "line-through text-text-secondary/50" : "text-text-primary"}`}>
                              {ih.key}:
                            </span>
                            <span className={`truncate ${isOverridden ? "line-through text-text-secondary/40" : "text-text-secondary"}`}>
                              {ih.value}
                            </span>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {isOverridden ? (
                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-bg-primary text-text-secondary/60 border border-border-primary">
                                Overridden
                              </span>
                            ) : (
                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-bg-hover text-text-accent border border-border-primary">
                                Cascading
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="text-[11px] text-text-secondary font-semibold uppercase tracking-wider">
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
                    extensions={[json(), completionExtension]}
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
                <div className="flex-1 border border-border-primary rounded-sm overflow-hidden text-xs">
                  <CodeMirror
                    value={activeRequest.body.content || ""}
                    height="100%"
                    minHeight="180px"
                    extensions={[completionExtension]}
                    onChange={handleBodyContentChange}
                    theme={theme === "light" ? "light" : "dark"}
                    className="font-mono h-full"
                  />
                </div>
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
            {/* Parent Auth Override Notice (shown when request has explicit auth or None, but parent folder has auth) */}
            {activeRequest.auth.type !== "Inherit" && parentInheritedAuth && (
              <div className="flex items-center justify-between p-2.5 bg-bg-tertiary border border-border-primary rounded-sm text-xs max-w-lg">
                <div className="flex items-center space-x-2 text-text-secondary min-w-0">
                  <Link2 size={13} className="text-text-accent flex-shrink-0" />
                  <span className="truncate">
                    Parent folder <strong className="text-text-primary">"{parentInheritedAuth.inheritedFromFolderName}"</strong> provides {parentInheritedAuth.effectiveAuth.type} Auth.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAuth({ type: "Inherit" })}
                  className="px-2 py-1 text-[11px] bg-bg-primary hover:bg-bg-hover text-text-accent border border-border-primary rounded transition cursor-pointer flex-shrink-0 ml-3 font-medium"
                >
                  Use Inherited Auth
                </button>
              </div>
            )}

            {/* Auth Dropdown selector type */}
            <div className="flex items-center space-x-3 mb-4">
              <label className="text-xs text-text-secondary">Auth Type:</label>
              <div className="relative inline-block text-left" ref={authDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsAuthDropdownOpen(!isAuthDropdownOpen)}
                  className="flex items-center justify-between px-3 py-1.5 min-w-[170px] bg-bg-tertiary text-text-primary border border-border-primary rounded-sm text-xs font-medium cursor-pointer select-none hover:bg-bg-hover transition duration-150 focus:outline-none focus:border-text-accent"
                >
                  <div className="flex items-center space-x-2">
                    <SelectedIcon size={13} className="text-text-accent" />
                    <span>{selectedOption.label}</span>
                  </div>
                  <ChevronDown size={14} className="text-text-secondary ml-1 flex-shrink-0" />
                </button>

                {isAuthDropdownOpen && (
                  <div className="absolute left-0 mt-1 w-[180px] bg-bg-secondary border border-border-primary rounded shadow-2xl z-50 py-1 overflow-hidden font-sans">
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

            {/* Inherit from Parent Tab Panel */}
            {activeRequest.auth.type === "Inherit" && (
              <div className="space-y-3 p-4 bg-bg-secondary border border-border-primary rounded-sm max-w-lg">
                <div className="flex items-center space-x-2 text-text-accent">
                  <Link2 size={14} className="flex-shrink-0" />
                  <span className="font-semibold text-xs">
                    {inheritance.inheritedFromFolderName
                      ? `Inheriting from folder "${inheritance.inheritedFromFolderName}"`
                      : ancestry && ancestry.folderChain.length > 0
                      ? "Inheriting from parent folders (No auth configured)"
                      : "Inheriting Auth (Request not in a saved folder)"}
                  </span>
                </div>

                {inheritance.effectiveAuth.type === "Bearer" && (
                  <div className="space-y-2 pt-2 border-t border-border-primary/50 text-xs font-mono">
                    <div className="text-text-secondary text-[11px]">
                      Effective Type: <span className="text-text-primary font-bold">Bearer Token</span>
                    </div>
                    <div className="text-[11px] text-text-secondary">
                      Sent as:{" "}
                      <code className="text-amber-300 font-mono select-all break-all bg-bg-primary px-1.5 py-1 rounded border border-border-primary">
                        Authorization: Bearer {inheritance.effectiveAuth.config.token || "<empty>"}
                      </code>
                    </div>
                  </div>
                )}

                {inheritance.effectiveAuth.type === "Basic" && (
                  <div className="space-y-2 pt-2 border-t border-border-primary/50 text-xs font-mono">
                    <div className="text-text-secondary text-[11px]">
                      Effective Type: <span className="text-text-primary font-bold">Basic Auth</span> (User: {inheritance.effectiveAuth.config.username || "<empty>"})
                    </div>
                    <div className="text-[11px] text-text-secondary">
                      Sent as:{" "}
                      <code className="text-amber-300 font-mono bg-bg-primary px-1.5 py-0.5 rounded border border-border-primary">
                        Authorization: Basic {
                          inheritance.effectiveAuth.config.username || inheritance.effectiveAuth.config.password
                            ? btoa(`${inheritance.effectiveAuth.config.username}:${inheritance.effectiveAuth.config.password}`)
                            : "<base64 encoded credentials>"
                        }
                      </code>
                    </div>
                  </div>
                )}

                {inheritance.effectiveAuth.type === "None" && (
                  <div className="text-text-secondary text-xs pt-1 leading-relaxed">
                    {ancestry && ancestry.folderChain.length > 0
                      ? "None of the ancestor folders have authorization configured. This request will be sent without auth headers."
                      : "Save this request into a project folder with configured auth to inherit credentials."}
                  </div>
                )}
              </div>
            )}

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

            {/* None state */}
            {activeRequest.auth.type === "None" && (
              <div className="py-10 text-center border border-dashed border-border-primary rounded bg-bg-secondary/20">
                <span className="text-text-secondary text-xs">
                  No authorization headers will be injected automatically.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Extractors Tab */}
        {activeTab === "extractors" && (
          <div className="animate-tab-fade space-y-4">
            <div className="flex items-center justify-between border-b border-border-primary pb-3">
              <div>
                <div className="text-[11px] text-text-primary font-semibold uppercase tracking-wider">
                  Response Chaining & Extractors
                </div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  Capture values from successful responses directly into environment variables without scripting.
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddExtractor}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border-primary rounded-sm transition cursor-pointer"
              >
                <Plus size={12} />
                <span>Add Extractor</span>
              </button>
            </div>

            {extractors.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-border-primary rounded-sm bg-bg-secondary/20">
                <Link2 size={24} className="text-text-secondary/50 mb-2" />
                <div className="text-xs font-medium text-text-primary mb-1">
                  No extractors configured
                </div>
                <div className="text-[11px] text-text-secondary max-w-sm mb-4">
                  Extract values like tokens, user IDs, or headers into environment variables automatically upon 2xx responses.
                </div>
                <button
                  type="button"
                  onClick={handleAddExtractor}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border-primary rounded-sm transition cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Add First Extractor</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-text-secondary uppercase px-2 py-1 bg-bg-secondary border border-border-primary rounded-sm">
                  <div className="col-span-1 text-center">Active</div>
                  <div className="col-span-3">Source</div>
                  <div className="col-span-4">Property / Path</div>
                  <div className="col-span-3">Target Variable</div>
                  <div className="col-span-1 text-center">Action</div>
                </div>

                <div className="space-y-1.5">
                  {extractors.map((ext) => {
                    const previewValue = response
                      ? extractValueFromResponse(response, ext)
                      : null;

                    return (
                      <div
                        key={ext.id}
                        className="p-2 bg-bg-secondary/40 border border-border-primary rounded-sm flex flex-col space-y-2 text-xs font-mono"
                      >
                        <div className="grid grid-cols-12 gap-2 items-center">
                          {/* Toggle */}
                          <div className="col-span-1 flex justify-center">
                            <input
                              type="checkbox"
                              checked={ext.enabled}
                              onChange={(e) =>
                                handleUpdateExtractor(ext.id, { enabled: e.target.checked })
                              }
                              className="cursor-pointer"
                              title="Enable / Disable extractor"
                            />
                          </div>

                          {/* Source Dropdown */}
                          <div className="col-span-3">
                            <ExtractorSourceDropdown
                              source={ext.source}
                              onChange={(newSource) =>
                                handleUpdateExtractor(ext.id, { source: newSource })
                              }
                            />
                          </div>

                          {/* Property Path */}
                          <div className="col-span-4">
                            <input
                              type="text"
                              value={ext.property}
                              disabled={ext.source === "status"}
                              onChange={(e) =>
                                handleUpdateExtractor(ext.id, { property: e.target.value })
                              }
                              placeholder={
                                ext.source === "body"
                                  ? "e.g. data.token or token"
                                  : ext.source === "header"
                                  ? "e.g. Authorization or Set-Cookie"
                                  : "HTTP Status Code (e.g. 200)"
                              }
                              className={`w-full bg-bg-primary text-text-primary border border-border-primary px-2 py-1 rounded-sm text-xs focus:outline-none focus:border-text-accent placeholder-text-secondary/40 ${
                                ext.source === "status" ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            />
                          </div>

                          {/* Target Variable */}
                          <div className="col-span-3 flex items-center space-x-1">
                            <span className="text-text-secondary text-xs select-none">{"{{"}</span>
                            <input
                              type="text"
                              value={ext.targetVariable}
                              onChange={(e) =>
                                handleUpdateExtractor(ext.id, {
                                  targetVariable: e.target.value.replace(/[{}]/g, ""),
                                })
                              }
                              placeholder="variableName"
                              className="w-full bg-bg-primary text-text-primary border border-border-primary px-2 py-1 rounded-sm text-xs focus:outline-none focus:border-text-accent placeholder-text-secondary/40 text-amber-300 font-semibold"
                            />
                            <span className="text-text-secondary text-xs select-none">{"}}"}</span>
                          </div>

                          {/* Delete Action */}
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteExtractor(ext.id)}
                              className="p-1 text-text-secondary hover:text-red-400 transition cursor-pointer"
                              title="Delete extractor"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Live Resolution Preview */}
                        <div className="flex items-center space-x-2 pl-9 text-[11px] text-text-secondary">
                          <span className="text-[10px] uppercase font-bold text-text-secondary/70">
                            Live Preview:
                          </span>
                          {!response ? (
                            <span className="text-text-secondary/50 italic">
                              (Send a request to preview extracted value)
                            </span>
                          ) : previewValue !== null ? (
                            <span className="text-green-400 px-1.5 py-0.5 rounded font-mono break-all">
                              {previewValue.length > 80
                                ? `${previewValue.substring(0, 80)}...`
                                : previewValue}
                            </span>
                          ) : (
                            <span className="text-amber-400/80 italic">
                              (Property not found in current response)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
