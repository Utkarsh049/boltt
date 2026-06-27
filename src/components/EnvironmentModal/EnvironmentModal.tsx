import React, { useState, useEffect } from "react";
import { useEnvStore, Environment, Variable, getGroupFromId } from "../../store/envStore";
import { X, Plus, Trash2, Eye, EyeOff, Save, Key } from "lucide-react";

export const EnvironmentModal: React.FC = () => {
  const {
    environments,
    isModalOpen,
    setModalOpen,
    saveEnvironment,
    deleteEnvironment,
    setActiveIdForGroup,
    activeGroup,
    groupActiveIds,
  } = useEnvStore();

  // Local state for buffering changes before clicking Save
  const [localEnvs, setLocalEnvs] = useState<Environment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  
  // Track visibility toggles for each row in the selected environment
  // Format: "envId-rowIdx": boolean
  const [visibleValues, setVisibleValues] = useState<Record<string, boolean>>({});

  // When modal opens, copy store environments to local state
  useEffect(() => {
    if (isModalOpen) {
      const activeGroupEnvs = environments.filter((e) => getGroupFromId(e.id) === activeGroup);
      const clonedEnvs: Environment[] = JSON.parse(JSON.stringify(activeGroupEnvs));
      
      // For each environment, make sure there is at least one blank row if the last row is not empty
      clonedEnvs.forEach((env) => {
        if (env.variables.length === 0) {
          env.variables.push({ key: "", value: "", enabled: true });
        } else {
          const last = env.variables[env.variables.length - 1];
          if (last.key || last.value) {
            env.variables.push({ key: "", value: "", enabled: true });
          }
        }
      });
      setLocalEnvs(clonedEnvs);

      // Auto-select the active environment for this group, or the first one, or null
      const groupActiveId = groupActiveIds[activeGroup];
      if (groupActiveId && clonedEnvs.some((e) => e.id === groupActiveId)) {
        setSelectedEnvId(groupActiveId);
      } else if (clonedEnvs.length > 0) {
        setSelectedEnvId(clonedEnvs[0].id);
      } else {
        setSelectedEnvId(null);
      }
    }
  }, [isModalOpen, environments, activeGroup, groupActiveIds]);

  if (!isModalOpen) return null;

  const selectedEnv = localEnvs.find((e) => e.id === selectedEnvId);

  const handleAddEnvironment = () => {
    const newEnv: Environment = {
      id: `${activeGroup}:${crypto.randomUUID()}`,
      name: `New Env ${localEnvs.length + 1}`,
      variables: [
        { key: "", value: "", enabled: true } // start with one ghost-like row
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
      updatedVars.push({ key: "", value: "", enabled: true });
    }

    setLocalEnvs(
      localEnvs.map((env) =>
        env.id === selectedEnvId ? { ...env, variables: updatedVars } : env
      )
    );
  };

  const handleAddVariableRow = () => {
    if (!selectedEnvId || !selectedEnv) return;
    const updatedVars = [...selectedEnv.variables, { key: "", value: "", enabled: true }];
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
      updatedVars = [{ key: "", value: "", enabled: true }];
    }

    setLocalEnvs(
      localEnvs.map((env) =>
        env.id === selectedEnvId ? { ...env, variables: updatedVars } : env
      )
    );
  };

  // Toggle mask state for a specific row
  const toggleValueVisibility = (rowIdx: number) => {
    if (!selectedEnvId) return;
    const key = `${selectedEnvId}-${rowIdx}`;
    setVisibleValues({
      ...visibleValues,
      [key]: !visibleValues[key],
    });
  };

  const handleSave = async () => {
    // 1. Commit deletions/additions to the store
    // Find removed environments of the current active group
    const currentGroupEnvs = environments.filter((e) => getGroupFromId(e.id) === activeGroup);
    const currentIds = localEnvs.map((e) => e.id);
    for (const env of currentGroupEnvs) {
      if (!currentIds.includes(env.id)) {
        await deleteEnvironment(env.id);
      }
    }

    // Save/Update environments from local state
    for (const env of localEnvs) {
      // Clean up variables: remove blank trailing rows
      const cleanedVars = env.variables.filter((v) => v.key.trim() || v.value.trim());
      await saveEnvironment({
        ...env,
        variables: cleanedVars,
      });
    }

    // 2. Adjust active environment for the current group
    if (selectedEnvId && localEnvs.some((e) => e.id === selectedEnvId)) {
      await setActiveIdForGroup(activeGroup, selectedEnvId);
    } else {
      await setActiveIdForGroup(activeGroup, null);
    }

    setModalOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="w-[780px] h-[520px] bg-[#161B22] border border-[#30363D] rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="h-12 border-b border-[#30363D] bg-[#1c2025] flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Key size={16} className="text-[#a1c9ff]" />
            <span className="font-semibold text-sm text-[#e0e2ea]">
              Manage Environments
            </span>
          </div>
          <button
            onClick={() => setModalOpen(false)}
            className="text-[#8b919d] hover:text-[#e0e2ea] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Panel: Environment List */}
          <div className="w-1/3 bg-[#101419]/50 flex flex-col border-r border-[#30363D]">
            <div className="flex-1 p-3 overflow-y-auto space-y-1.5 min-h-0">
              <div className="text-[10px] font-bold text-[#8b919d] uppercase tracking-wider mb-2 px-1">
                Environments
              </div>
              {localEnvs.map((env) => (
                <div
                  key={env.id}
                  onClick={() => setSelectedEnvId(env.id)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-sm text-xs font-medium cursor-pointer transition ${
                    selectedEnvId === env.id
                      ? "bg-[#1c2025] text-[#a1c9ff] border-l-2 border-l-[#a1c9ff]"
                      : "text-[#8b919d] hover:bg-[#1c2025]/40 hover:text-[#e0e2ea]"
                  }`}
                >
                  <span className="truncate max-w-[150px]">{env.name}</span>
                  <button
                    onClick={(e) => handleDeleteEnvironment(env.id, e)}
                    className="text-[#8b919d] hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-0.5 cursor-pointer"
                    title="Delete Environment"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="p-3 border-t border-[#30363D] bg-[#101419]/80 flex-shrink-0">
              <button
                onClick={handleAddEnvironment}
                className="w-full py-1.5 border border-dashed border-[#30363D] hover:border-[#a1c9ff]/50 rounded text-xs text-[#c0c7d3] hover:text-[#a1c9ff] flex items-center justify-center space-x-1.5 transition cursor-pointer bg-[#1c2025]/30 hover:bg-[#1c2025]/60"
              >
                <Plus size={13} />
                <span>Add Environment</span>
              </button>
            </div>
          </div>

          {/* Right Panel: Variable Editor */}
          <div className="w-2/3 flex flex-col bg-[#161B22]">
            {selectedEnv ? (
              <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
                {/* Environment Name Input */}
                <div className="flex flex-col space-y-1.5 flex-shrink-0">
                  <label className="text-[10px] font-semibold text-[#8b919d] uppercase tracking-wider">
                    Environment Name
                  </label>
                  <input
                    type="text"
                    value={selectedEnv.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="bg-[#101419] border border-[#30363D] hover:border-[#8b919d]/40 focus:border-[#a1c9ff] px-3 py-1.5 rounded text-xs text-[#e0e2ea] focus:outline-none transition w-full"
                    placeholder="e.g. Production"
                  />
                </div>

                {/* Variable Grid */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <span className="text-[10px] font-semibold text-[#8b919d] uppercase tracking-wider">
                      Variables
                    </span>
                    <button
                      type="button"
                      onClick={handleAddVariableRow}
                      className="text-[10px] font-semibold text-[#a1c9ff] hover:text-blue-300 flex items-center space-x-1 transition cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add Variable</span>
                    </button>
                  </div>
                  <div className="flex-1 border border-[#30363D] rounded bg-[#101419]/30 overflow-hidden flex flex-col min-h-0">
                    {/* Variable Headers */}
                    <div className="flex items-center border-b border-[#30363D] bg-[#101419] text-[10px] font-bold text-[#8b919d] uppercase py-1 px-2 flex-shrink-0">
                      <div className="w-8 flex justify-center">Active</div>
                      <div className="flex-1 px-2">Key</div>
                      <div className="flex-1 px-2">Value</div>
                      <div className="w-16 flex justify-center">Actions</div>
                    </div>

                    {/* Variable Rows */}
                    <div className="flex-1 overflow-y-auto divide-y divide-[#30363D] min-h-0">
                      {selectedEnv.variables.map((variable, index) => {
                        const isValueVisible = visibleValues[`${selectedEnv.id}-${index}`];
                        return (
                          <div key={index} className="group flex items-center py-1 px-2 hover:bg-[#1c2025]/30">
                            {/* Checkbox */}
                            <div className="w-8 flex justify-center">
                              <input
                                type="checkbox"
                                checked={variable.enabled}
                                onChange={(e) => handleVariableChange(index, "enabled", e.target.checked)}
                                className="w-3.5 h-3.5 rounded bg-[#101419] border-[#30363D] text-[#a1c9ff] focus:ring-0 cursor-pointer"
                              />
                            </div>
                            
                            {/* Key */}
                            <div className="flex-1 px-2 min-w-0">
                              <input
                                type="text"
                                value={variable.key}
                                onChange={(e) => handleVariableChange(index, "key", e.target.value)}
                                className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none text-xs font-mono text-[#e0e2ea] placeholder-[#8b919d]/40"
                                placeholder="KEY"
                              />
                            </div>

                            {/* Value */}
                            <div className="flex-1 px-2 min-w-0 flex items-center space-x-1">
                              <input
                                type={isValueVisible ? "text" : "password"}
                                value={variable.value}
                                onChange={(e) => handleVariableChange(index, "value", e.target.value)}
                                className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none text-xs font-mono text-green-300 placeholder-[#8b919d]/40"
                                placeholder="value"
                              />
                              {(variable.value.length > 0) && (
                                <button
                                  onClick={() => toggleValueVisibility(index)}
                                  className="text-[#8b919d] hover:text-[#e0e2ea] transition p-0.5 cursor-pointer flex-shrink-0"
                                  title={isValueVisible ? "Hide value" : "Show value"}
                                >
                                  {isValueVisible ? <EyeOff size={11} /> : <Eye size={11} />}
                                </button>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="w-16 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleDeleteVariable(index)}
                                className="text-[#8b919d] hover:text-red-400 p-1 cursor-pointer flex items-center justify-center"
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
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#8b919d]">
                <Key size={24} className="opacity-20 mb-2" />
                <span className="text-xs">Create or select an environment to manage its variables.</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-12 border-t border-[#30363D] bg-[#1c2025] flex items-center justify-end px-4 space-x-3 flex-shrink-0">
          <button
            onClick={() => setModalOpen(false)}
            className="px-4 py-1.5 border border-[#30363D] hover:bg-[#272a30] rounded text-xs font-medium text-[#c0c7d3] hover:text-[#e0e2ea] transition cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[#a1c9ff] hover:bg-blue-300 rounded text-xs font-bold text-[#00325a] flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Save size={13} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
