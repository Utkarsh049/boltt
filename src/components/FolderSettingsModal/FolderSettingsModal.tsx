import React, { useState, useEffect, useRef, useMemo } from "react";
import { Folder, useProjectsStore } from "../../store/projectsStore";
import { AuthConfig, KeyValue } from "../../store/requestStore";
import { useToastStore } from "../../store/toastStore";
import { KVEditor } from "../KVEditor/KVEditor";
import { findFolderParentChain, resolveEffectiveAuth } from "../../utils/inheritance";
import {
  X,
  Folder as FolderIcon,
  KeyRound,
  Sliders,
  ShieldOff,
  Key,
  User,
  Check,
  ChevronDown,
  Save,
  Link2,
} from "lucide-react";

export interface FolderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  folder: Folder;
}

type TabType = "auth" | "headers";

export const FolderSettingsModal: React.FC<FolderSettingsModalProps> = ({
  isOpen,
  onClose,
  projectId,
  folder,
}) => {
  const { projects, updateFolderSettings } = useProjectsStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<TabType>("auth");
  const [auth, setAuth] = useState<AuthConfig>(folder.auth || { type: "Inherit" });
  const [headers, setHeaders] = useState<KeyValue[]>(folder.headers || []);
  const [isAuthDropdownOpen, setIsAuthDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const authDropdownRef = useRef<HTMLDivElement>(null);

  // Sync state when modal opens or folder changes
  useEffect(() => {
    if (isOpen) {
      setAuth(folder.auth || { type: "Inherit" });
      setHeaders(folder.headers ? JSON.parse(JSON.stringify(folder.headers)) : []);
      setActiveTab("auth");
      setIsAuthDropdownOpen(false);
    }
  }, [isOpen, folder]);

  // Close dropdown and modal handlers
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        authDropdownRef.current &&
        !authDropdownRef.current.contains(e.target as Node)
      ) {
        setIsAuthDropdownOpen(false);
      }
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Compute live parent inheritance preview for this folder
  const parentAuthPreview = useMemo(() => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return null;
    const parentChain = findFolderParentChain(project, folder.id);
    return resolveEffectiveAuth({ type: "Inherit" }, parentChain);
  }, [projects, projectId, folder.id]);

  if (!isOpen) return null;

  const authOptions = [
    { value: "Inherit", label: "Inherit from parent", icon: Link2 },
    { value: "None", label: "No Auth", icon: ShieldOff },
    { value: "Bearer", label: "Bearer Token", icon: Key },
    { value: "Basic", label: "Basic Auth", icon: User },
  ] as const;

  const currentAuthOption =
    authOptions.find((opt) => opt.value === auth.type) || authOptions[0];
  const CurrentAuthIcon = currentAuthOption.icon;

  const handleAuthTypeChange = (type: "Inherit" | "None" | "Bearer" | "Basic") => {
    setIsAuthDropdownOpen(false);
    if (type === "Inherit") {
      setAuth({ type: "Inherit" });
    } else if (type === "None") {
      setAuth({ type: "None" });
    } else if (type === "Bearer") {
      setAuth({
        type: "Bearer",
        config: {
          token: auth.type === "Bearer" ? auth.config.token : "",
        },
      });
    } else if (type === "Basic") {
      setAuth({
        type: "Basic",
        config: {
          username: auth.type === "Basic" ? auth.config.username : "",
          password: auth.type === "Basic" ? auth.config.password : "",
        },
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const cleanHeaders = headers.filter((h) => h.key.trim() !== "");
      await updateFolderSettings(projectId, folder.id, auth, cleanHeaders);
      showToast(`Updated folder settings for "${folder.name}"`, "success");
      onClose();
    } catch (err) {
      console.error("Failed to update folder settings:", err);
      showToast("Failed to save folder settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const activeHeadersCount = headers.filter((h) => h.enabled && h.key.trim()).length;
  const isAuthCustom = auth.type !== "Inherit" && auth.type !== "None";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-[560px] max-h-[85vh] bg-bg-secondary border border-border-primary rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
      >
        {/* Header */}
        <div className="h-12 border-b border-border-primary bg-bg-tertiary flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <FolderIcon size={16} className="text-text-accent flex-shrink-0 fill-text-accent/10" />
            <span className="font-semibold text-xs uppercase tracking-wider text-text-primary truncate">
              Folder Settings — {folder.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition cursor-pointer p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-border-primary bg-bg-primary px-4 pt-2 space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab("auth")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t flex items-center space-x-1.5 transition cursor-pointer border-t border-l border-r ${
              activeTab === "auth"
                ? "bg-bg-secondary text-text-accent border-border-primary -mb-[1px]"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <KeyRound size={12} />
            <span>Authorization</span>
            {isAuthCustom && (
              <span className="w-1.5 h-1.5 bg-text-accent rounded-full"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("headers")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t flex items-center space-x-1.5 transition cursor-pointer border-t border-l border-r ${
              activeTab === "headers"
                ? "bg-bg-secondary text-text-accent border-border-primary -mb-[1px]"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <Sliders size={12} />
            <span>Default Headers</span>
            {activeHeadersCount > 0 && (
              <span className="bg-bg-hover text-text-accent text-[10px] px-1.5 rounded-full border border-border-primary font-mono">
                {activeHeadersCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Form */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs font-sans">
            {/* 1. Auth Tab */}
            {activeTab === "auth" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    Folder Auth Type
                  </label>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Set default credentials to cascade to all endpoints in this folder. Requests can inherit this automatically.
                  </p>
                </div>

                {/* Custom Auth Dropdown */}
                <div className="relative" ref={authDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsAuthDropdownOpen(!isAuthDropdownOpen)}
                    className="flex items-center justify-between w-full px-3 py-2 bg-bg-primary border border-border-primary rounded text-xs text-text-primary hover:border-text-secondary/50 transition cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <CurrentAuthIcon size={13} className="text-text-accent" />
                      <span className="font-semibold">{currentAuthOption.label}</span>
                    </div>
                    <ChevronDown size={14} className="text-text-secondary" />
                  </button>

                  {isAuthDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-full bg-bg-secondary border border-border-primary rounded shadow-2xl z-50 py-1 overflow-hidden font-sans">
                      {authOptions.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = auth.type === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleAuthTypeChange(opt.value)}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? "bg-bg-tertiary text-text-accent font-semibold"
                                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60"
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <Icon size={13} />
                              <span>{opt.label}</span>
                            </div>
                            {isSelected && <Check size={12} className="text-text-accent" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Inherit Preview Card */}
                {auth.type === "Inherit" && (
                  <div className="p-3 bg-bg-primary/80 border border-border-primary rounded space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-text-primary font-semibold text-xs">
                      <Link2 size={13} className="text-text-accent" />
                      <span>Parent Inheritance Status</span>
                    </div>
                    {parentAuthPreview && parentAuthPreview.inheritedFromFolderName ? (
                      <p className="text-[11px] text-text-secondary">
                        This folder will inherit{" "}
                        <strong className="text-text-accent">
                          {parentAuthPreview.effectiveAuth.type === "Bearer"
                            ? "Bearer Token"
                            : "Basic Auth"}
                        </strong>{" "}
                        from folder{" "}
                        <strong className="text-text-primary">
                          "{parentAuthPreview.inheritedFromFolderName}"
                        </strong>
                        .
                      </p>
                    ) : (
                      <p className="text-[11px] text-text-secondary italic">
                        No parent folder auth configured. Endpoints will default to No Auth unless configured higher up.
                      </p>
                    )}
                  </div>
                )}

                {/* Bearer Token Form */}
                {auth.type === "Bearer" && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      Bearer Token
                    </label>
                    <input
                      type="text"
                      value={auth.config.token}
                      onChange={(e) =>
                        setAuth({
                          type: "Bearer",
                          config: { token: e.target.value },
                        })
                      }
                      placeholder="eyJhbGciOi... or {{token}}"
                      className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 font-mono text-text-primary focus:outline-none focus:border-text-accent"
                    />
                    <span className="text-[10px] text-text-secondary">
                      Supports environment variables like <code className="text-text-accent font-mono">{"{{token}}"}</code>.
                    </span>
                  </div>
                )}

                {/* Basic Auth Form */}
                {auth.type === "Basic" && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        Username
                      </label>
                      <input
                        type="text"
                        value={auth.config.username}
                        onChange={(e) =>
                          setAuth({
                            type: "Basic",
                            config: {
                              ...auth.config,
                              username: e.target.value,
                            },
                          })
                        }
                        placeholder="admin or {{username}}"
                        className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 font-mono text-text-primary focus:outline-none focus:border-text-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        Password
                      </label>
                      <input
                        type="password"
                        value={auth.config.password}
                        onChange={(e) =>
                          setAuth({
                            type: "Basic",
                            config: {
                              ...auth.config,
                              password: e.target.value,
                            },
                          })
                        }
                        placeholder="•••••••• or {{password}}"
                        className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 font-mono text-text-primary focus:outline-none focus:border-text-accent"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Headers Tab */}
            {activeTab === "headers" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    Cascading Folder Headers
                  </label>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Headers added here will cascade downward to every request in this folder and its subfolders.
                  </p>
                </div>

                <div className="border border-border-primary rounded bg-bg-primary overflow-hidden">
                  <KVEditor
                    rows={headers}
                    onChange={setHeaders}
                    keyPlaceholder="Header Name"
                    valuePlaceholder="Value"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="h-14 border-t border-border-primary bg-bg-tertiary flex items-center justify-end px-5 space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition cursor-pointer border border-border-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-text-accent text-bg-primary hover:opacity-90 disabled:opacity-50 transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <Save size={13} />
              <span>{isSaving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

