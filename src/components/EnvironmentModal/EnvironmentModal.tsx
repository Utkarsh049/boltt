import React, { useState, useEffect } from "react";
import { useEnvStore, Environment, Variable, getGroupFromId } from "../../store/envStore";
import { X, Plus, Trash2, Eye, EyeOff, Save, Key, Minus, Square, Lock, Unlock, ShieldCheck } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const EnvironmentModal: React.FC = () => {
  const environments = useEnvStore((state) => state.environments);
  const isModalOpen = useEnvStore((state) => state.isModalOpen);
  const setModalOpen = useEnvStore((state) => state.setModalOpen);
  const saveEnvironment = useEnvStore((state) => state.saveEnvironment);
  const deleteEnvironment = useEnvStore((state) => state.deleteEnvironment);
  const setActiveIdForGroup = useEnvStore((state) => state.setActiveIdForGroup);
  const activeGroup = useEnvStore((state) => state.activeGroup);
  const setActiveGroup = useEnvStore((state) => state.setActiveGroup);
  const groupActiveIds = useEnvStore((state) => state.groupActiveIds);
  const loadEnvironments = useEnvStore((state) => state.loadEnvironments);

  // Load environments on mount and listen for backend/cross-window updates
  useEffect(() => {
    loadEnvironments();
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("environments-updated", () => {
        loadEnvironments();
      }).then((fn) => {
        unlisten = fn;
      });
    }).catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, [loadEnvironments]);

  const getInitialWindowLabel = () => {
    try {
      return getCurrentWindow().label;
    } catch (e) {
      return "main";
    }
  };

  const [windowLabel] = useState<string>(getInitialWindowLabel);

  const isEnvWindow = windowLabel.startsWith("env-");
  const initialGroup = isEnvWindow
    ? (windowLabel.split("-")[1] as "production" | "staging" | "local")
    : activeGroup;

  const [selectedGroup, setSelectedGroup] = useState<"production" | "staging" | "local">(initialGroup || "production");

  useEffect(() => {
    if (!isEnvWindow) {
      setSelectedGroup(activeGroup);
    }
  }, [isEnvWindow, activeGroup]);

  const targetGroup = selectedGroup;

  // Local state for buffering changes before clicking Save
  const [localEnvs, setLocalEnvs] = useState<Environment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  
  // Track visibility toggles for each row in the selected environment
  // Format: "envId-rowIdx": boolean
  const [visibleValues, setVisibleValues] = useState<Record<string, boolean>>({});
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  // When modal opens or group changes, copy store environments to local state
  useEffect(() => {
    if (isModalOpen || isEnvWindow) {
      const activeGroupEnvs = environments.filter((e) => getGroupFromId(e.id) === targetGroup);
      const clonedEnvs: Environment[] = JSON.parse(JSON.stringify(activeGroupEnvs));
      
      // For each environment, make sure there is at least one blank row if the last row is not empty
      clonedEnvs.forEach((env) => {
        if (!env.variables || !Array.isArray(env.variables) || env.variables.length === 0) {
          env.variables = [{ key: "", value: "", enabled: true, is_secret: false }];
        } else {
          const last = env.variables[env.variables.length - 1];
          if (last.key || last.value) {
            env.variables.push({ key: "", value: "", enabled: true, is_secret: false });
          }
        }
      });
      setLocalEnvs(clonedEnvs);

      // Auto-select the active environment for this group, or the first one, or null
      const groupActiveId = groupActiveIds[targetGroup];
      if (groupActiveId && clonedEnvs.some((e) => e.id === groupActiveId)) {
        setSelectedEnvId(groupActiveId);
      } else if (clonedEnvs.length > 0) {
        setSelectedEnvId(clonedEnvs[0].id);
      } else {
        setSelectedEnvId(null);
      }
    }
  }, [isModalOpen, isEnvWindow, environments, targetGroup, groupActiveIds]);

  const handleClose = async () => {
    if (isEnvWindow) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().close();
      } catch (e) {
        console.error("Failed to close window:", e);
      }
    } else {
      setModalOpen(false);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const window = getCurrentWindow();
      if (await window.isMaximized()) {
        await window.unmaximize();
      } else {
        await window.maximize();
      }
    } catch (err) {
      console.error("Failed to toggle maximize:", err);
    }
  };

  const handleHeaderMouseDown = async (e: React.MouseEvent) => {
    if (!isEnvWindow) return;
    if (e.button === 0) {
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("a") ||
        target.closest(".custom-interactive")
      ) {
        return;
      }
      try {
        await getCurrentWindow().startDragging();
      } catch (err) {
        console.error("Failed to start window drag:", err);
      }
    }
  };

  const handleHeaderDoubleClick = (e: React.MouseEvent) => {
    if (!isEnvWindow) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("a") ||
      target.closest(".custom-interactive")
    ) {
      return;
    }
    handleToggleMaximize();
  };

  // Handle escape key listener for standalone windows
  useEffect(() => {
    if (!isEnvWindow) return;
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        await handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEnvWindow]);

  if (!isModalOpen && !isEnvWindow) return null;

  const selectedEnv = localEnvs.find((e) => e.id === selectedEnvId);

  const handleAddEnvironment = () => {
    const newEnv: Environment = {
      id: `${targetGroup}:${crypto.randomUUID()}`,
      name: `New Env ${localEnvs.length + 1}`,
      variables: [
        { key: "", value: "", enabled: true, is_secret: false } // start with one ghost-like row
      ],
    };
    setLocalEnvs([...localEnvs, newEnv]);
    setSelectedEnvId(newEnv.id);
  };

  const handleDeleteEnvironment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = localEnvs.filter((env) => env.id !== id);
    setLocalEnvs(updated);
    
    if (selectedEnvId === id) {
      if (updated.length > 0) {
        setSelectedEnvId(updated[0].id);
      } else {
        setSelectedEnvId(null);
      }
    }
  };

  const handleNameChange = (name: string) => {
    if (!selectedEnvId) return;
    setLocalEnvs(
      localEnvs.map((env) => (env.id === selectedEnvId ? { ...env, name } : env))
    );
  };

  // Variable edits
  const handleVariableChange = (index: number, field: keyof Variable, value: any) => {
    if (!selectedEnvId || !selectedEnv) return;
    const updatedVars = selectedEnv.variables.map((v, i) =>
      i === index ? { ...v, [field]: value } : v
    );
    
    // Auto-add ghost row logic: if typing in the last row and key/value are not empty, append a new blank row
    const lastRow = updatedVars[updatedVars.length - 1];
    if (index === updatedVars.length - 1 && (lastRow.key || lastRow.value)) {
      updatedVars.push({ key: "", value: "", enabled: true, is_secret: false });
    }

    setLocalEnvs(
      localEnvs.map((env) =>
        env.id === selectedEnvId ? { ...env, variables: updatedVars } : env
      )
    );
  };

  const handleAddVariableRow = () => {
    if (!selectedEnvId || !selectedEnv) return;
    const updatedVars = [...selectedEnv.variables, { key: "", value: "", enabled: true, is_secret: false }];
    setLocalEnvs(
      localEnvs.map((env) =>
        env.id === selectedEnvId ? { ...env, variables: updatedVars } : env
      )
    );
  };

  const handleDeleteVariable = (index: number) => {
    if (!selectedEnvId || !selectedEnv) return;
    let updatedVars = selectedEnv.variables.filter((_, i) => i !== index);
    
    // Ensure there is at least one blank row
    if (updatedVars.length === 0) {
      updatedVars = [{ key: "", value: "", enabled: true, is_secret: false }];
    }

    setLocalEnvs(
      localEnvs.map((env) =>
        env.id === selectedEnvId ? { ...env, variables: updatedVars } : env
      )
    );
  };

  // Toggle mask state for a specific row
  const toggleValueVisibility = (rowIdx: number, isCurrentlyVisible: boolean) => {
    if (!selectedEnvId) return;
    const key = `${selectedEnvId}-${rowIdx}`;
    setVisibleValues({
      ...visibleValues,
      [key]: !isCurrentlyVisible,
    });
  };

  const handleSave = async (closeOnSave = false) => {
    // 1. Commit deletions/additions to the store
    // Find removed environments of the target active group
    const currentGroupEnvs = environments.filter((e) => getGroupFromId(e.id) === targetGroup);
    const currentIds = localEnvs.map((e) => e.id);
    for (const env of currentGroupEnvs) {
      if (!currentIds.includes(env.id)) {
        await deleteEnvironment(env.id);
      }
    }

    // Save/Update environments from local state
    for (const env of localEnvs) {
      // Clean up variables: remove blank trailing rows
      const cleanedVars = env.variables
        .filter((v) => v.key.trim() || v.value.trim())
        .map((v) => ({ ...v, is_secret: !!v.is_secret }));
      await saveEnvironment({
        ...env,
        variables: cleanedVars,
      });
    }

    // 2. Adjust active environment for the target group
    const currentGroupActiveId = groupActiveIds[targetGroup];
    if (currentGroupActiveId && localEnvs.some((e) => e.id === currentGroupActiveId)) {
      await setActiveIdForGroup(targetGroup, currentGroupActiveId);
    } else if (selectedEnvId && localEnvs.some((e) => e.id === selectedEnvId)) {
      await setActiveIdForGroup(targetGroup, selectedEnvId);
    } else if (localEnvs.length > 0) {
      await setActiveIdForGroup(targetGroup, localEnvs[0].id);
    } else {
      await setActiveIdForGroup(targetGroup, null);
    }

    setIsSavedRecently(true);
    setTimeout(() => {
      setIsSavedRecently(false);
    }, 2500);

    if (closeOnSave) {
      await handleClose();
    }
  };

  const content = (
    <div className={`bg-bg-secondary border-border-primary flex flex-col overflow-hidden ${
      isEnvWindow 
        ? "w-screen h-screen" 
        : "w-[880px] max-w-[95vw] h-[540px] max-h-[90vh] border rounded-xl shadow-2xl animate-slide-up"
    }`}>
      {/* Modal Header */}
      <div
        onMouseDown={handleHeaderMouseDown}
        onDoubleClick={handleHeaderDoubleClick}
        className={`h-12 border-b border-border-primary bg-bg-tertiary flex items-center justify-between px-4 flex-shrink-0 select-none cursor-default ${
          !isEnvWindow ? "rounded-t-xl" : ""
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Key size={16} className="text-text-accent" />
            <span className="font-semibold text-sm text-text-primary">
              Manage Environments
            </span>
          </div>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="flex items-center bg-bg-primary p-0.5 rounded-lg border border-border-primary text-xs"
          >
            {(["production", "staging", "local"] as const).map((group) => {
              const isSelected = targetGroup === group;
              return (
                <button
                  type="button"
                  key={group}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedGroup(group);
                    setActiveGroup(group);
                  }}
                  className={`px-3 py-1 rounded-md capitalize text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-bg-secondary text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                  }`}
                >
                  {group}
                </button>
              );
            })}
          </div>
        </div>
        {isEnvWindow ? (
          <div className="flex items-center space-x-1 pl-2 border-l border-border-primary h-6">
            <button
              onClick={() => getCurrentWindow().minimize()}
              className="p-1 hover:bg-bg-hover rounded text-text-secondary hover:text-text-primary transition cursor-pointer flex items-center justify-center"
              title="Minimize"
            >
              <Minus size={16} />
            </button>
            <button
              onClick={handleToggleMaximize}
              className="p-1 hover:bg-bg-hover rounded text-text-secondary hover:text-text-primary transition cursor-pointer flex items-center justify-center"
              title="Maximize / Restore"
            >
              <Square size={13} />
            </button>
            <button
              onClick={() => getCurrentWindow().close()}
              className="p-1 hover:bg-[#ea3e3e]/20 hover:text-[#ff8080] rounded text-text-secondary transition cursor-pointer flex items-center justify-center"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleClose}
            className="text-text-secondary hover:text-text-primary transition cursor-pointer"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Modal Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel: Environment List */}
        <div className="w-60 flex-shrink-0 bg-bg-primary/50 flex flex-col border-r border-border-primary">
          <div className="flex-1 p-3 overflow-y-auto space-y-1.5 min-h-0">
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2 px-1">
              Environments
            </div>
            {localEnvs.map((env) => (
              <div
                key={env.id}
                onClick={() => setSelectedEnvId(env.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-sm text-xs font-medium cursor-pointer transition ${
                  selectedEnvId === env.id
                    ? "bg-bg-tertiary text-text-accent"
                    : "text-text-secondary hover:bg-bg-tertiary/40 hover:text-text-primary"
                }`}
              >
                <span className="truncate max-w-[150px]">{env.name}</span>
                <button
                  onClick={(e) => handleDeleteEnvironment(env.id, e)}
                  className="text-text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-0.5 cursor-pointer"
                  title="Delete Environment"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          
          <div className="p-3 border-t border-border-primary bg-bg-primary/80 flex-shrink-0">
            <button
              onClick={handleAddEnvironment}
              className="w-full py-1.5 border border-dashed border-border-primary hover:border-text-accent/50 rounded-md text-xs text-text-secondary hover:text-text-accent flex items-center justify-center space-x-1.5 transition cursor-pointer bg-bg-tertiary/30 hover:bg-bg-tertiary/60"
            >
              <Plus size={13} />
              <span>Add Environment</span>
            </button>
          </div>
        </div>

        {/* Right Panel: Variable Editor */}
        <div className="flex-1 flex flex-col bg-bg-secondary min-w-0">
          {selectedEnv ? (
            <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
              {/* Environment Name Input */}
              <div className="flex flex-col space-y-1.5 flex-shrink-0">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                  Environment Name
                </label>
                <input
                  type="text"
                  value={selectedEnv.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="bg-bg-primary border border-border-primary hover:border-text-secondary/40 focus:border-text-accent px-3 py-1.5 rounded-md text-xs text-text-primary focus:outline-none transition w-full"
                  placeholder="e.g. Production"
                />
              </div>

              {/* Git-safe Secrets Separation Banner */}
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-bg-primary/50 border border-border-primary rounded-md text-[11px] text-text-secondary flex-shrink-0">
                <ShieldCheck size={13} className="text-text-accent flex-shrink-0" />
                <span>
                  Mark private variables with <Lock size={11} className="inline text-amber-400 mx-0.5" /> to save them in <code className="text-amber-300 font-mono text-[10px]">.boltt.secrets.json</code> (excluded from Git).
                </span>
              </div>

              {/* Variable Grid */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
                    Variables
                  </span>
                  <button
                    type="button"
                    onClick={handleAddVariableRow}
                    className="text-[10px] font-semibold text-text-accent hover:text-blue-300 flex items-center space-x-1 transition cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add Variable</span>
                  </button>
                </div>
                <div className="flex-1 border border-border-primary rounded bg-bg-primary/30 overflow-hidden flex flex-col min-h-0">
                  {/* Variable Headers */}
                  <div className="flex items-center border-b border-border-primary bg-bg-primary text-[10px] font-bold text-text-secondary uppercase py-1 px-2 flex-shrink-0">
                    <div className="w-8 flex justify-center">Active</div>
                    <div className="flex-1 px-2">Key</div>
                    <div className="flex-1 px-2">Value</div>
                    <div className="w-12 flex justify-center" title="Toggle Secret status (stored in .boltt.secrets.json)">Secret</div>
                    <div className="w-12 flex justify-center">Actions</div>
                  </div>

                  {/* Variable Rows */}
                  <div className="flex-1 overflow-y-auto divide-y divide-border-primary min-h-0">
                    {selectedEnv.variables.map((variable, index) => {
                      const isSecret = !!variable.is_secret;
                      const hasExplicitToggle = `${selectedEnv.id}-${index}` in visibleValues;
                      const isValueVisible = hasExplicitToggle
                        ? visibleValues[`${selectedEnv.id}-${index}`]
                        : !isSecret;

                      return (
                        <div key={index} className="group flex items-center py-1 px-2 hover:bg-bg-tertiary/30">
                          {/* Checkbox */}
                          <label className="w-8 h-full min-h-[28px] flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={variable.enabled}
                              aria-label={
                                variable.enabled
                                  ? `Disable variable ${variable.key || `row ${index + 1}`}`
                                  : `Enable variable ${variable.key || `row ${index + 1}`}`
                              }
                              onChange={(e) => handleVariableChange(index, "enabled", e.target.checked)}
                            />
                          </label>
                          
                          {/* Key */}
                          <div className="flex-1 px-2 min-w-0">
                            <input
                              type="text"
                              value={variable.key}
                              onChange={(e) => handleVariableChange(index, "key", e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none text-xs font-mono text-text-primary placeholder-text-secondary/40"
                              placeholder="KEY"
                            />
                          </div>

                          {/* Value */}
                          <div className="flex-1 px-2 min-w-0 flex items-center space-x-1">
                            <input
                              type={isValueVisible ? "text" : "password"}
                              value={variable.value}
                              onChange={(e) => handleVariableChange(index, "value", e.target.value)}
                              className={`flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none text-xs font-mono placeholder-text-secondary/40 ${
                                isSecret ? "text-amber-300" : "text-green-300"
                              }`}
                              placeholder={isSecret ? "secret value" : "value"}
                            />
                            {variable.value.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleValueVisibility(index, isValueVisible)}
                                className="text-text-secondary hover:text-text-primary transition p-0.5 cursor-pointer flex-shrink-0"
                                title={isValueVisible ? "Mask value" : "Show value"}
                              >
                                {isValueVisible ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                            )}
                          </div>

                          {/* Secret Toggle */}
                          <div className="w-12 flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleVariableChange(index, "is_secret", !isSecret)}
                              className={`p-1 rounded transition cursor-pointer flex items-center justify-center ${
                                isSecret
                                  ? "bg-amber-400/10 text-amber-400 border border-amber-400/30 hover:bg-amber-400/20"
                                  : "text-text-secondary/50 hover:text-text-primary hover:bg-bg-hover"
                              }`}
                              title={
                                isSecret
                                  ? "Secret Variable: Stored in .boltt.secrets.json (Git-ignored). Click to make public."
                                  : "Public Variable: Stored in environments.json (Git-tracked). Click to make secret."
                              }
                            >
                              {isSecret ? <Lock size={12} /> : <Unlock size={12} />}
                            </button>
                          </div>

                          {/* Actions */}
                          <div className="w-12 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleDeleteVariable(index)}
                              className="text-text-secondary hover:text-red-400 p-1 cursor-pointer flex items-center justify-center"
                              title="Delete Variable"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-text-secondary">
              <Key size={28} className="opacity-30 mb-3 text-text-accent" />
              <p className="text-xs font-semibold text-text-primary mb-1 capitalize">No {targetGroup} Environments</p>
              <p className="text-[11px] text-text-secondary mb-4 max-w-xs">
                Create an environment to define variables like base URLs, tokens, and secrets for your {targetGroup} workspace.
              </p>
              <button
                type="button"
                onClick={handleAddEnvironment}
                className="px-3.5 py-1.5 bg-text-accent hover:bg-blue-300 text-[#00325a] rounded text-xs font-bold transition cursor-pointer flex items-center space-x-1.5"
              >
                <Plus size={13} />
                <span>Add {targetGroup} Environment</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Footer */}
      <div className={`h-12 border-t border-border-primary bg-bg-tertiary flex items-center justify-between px-4 flex-shrink-0 ${
        !isEnvWindow ? "rounded-b-xl" : ""
      }`}>
        <div className="flex items-center space-x-2">
          {isSavedRecently && (
            <span className="flex items-center space-x-1.5 text-xs text-green-400 font-medium animate-fade-in">
              <ShieldCheck size={14} />
              <span>Changes saved successfully</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1.5 border border-border-primary hover:bg-bg-hover rounded-md text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer"
          >
            {isSavedRecently ? "Done" : "Cancel"}
          </button>
          
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="px-4 py-1.5 bg-text-accent hover:opacity-90 rounded-md text-xs font-semibold text-bg-primary flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
          >
            <Save size={13} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (isEnvWindow) {
    return content;
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      {content}
    </div>
  );
};
