import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

export interface Variable {
  key: string;
  value: string;
  enabled: boolean;
  is_secret?: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: Variable[];
}

export interface EnvironmentsFile {
  environments: Environment[];
  activeId: string | null;
}

export const getGroupFromId = (id: string): "production" | "staging" | "local" => {
  if (id.startsWith("staging:")) return "staging";
  if (id.startsWith("local:")) return "local";
  return "production";
};

const safeGetStorage = (key: string): string | null => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
};

const safeSetStorage = (key: string, value: string): void => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
};

const triggerSync = async () => {
  try {
    await emit("environments-updated");
  } catch (e) {
    console.warn("Could not emit environments-updated event:", e);
  }
};

export const openEnvironmentWindow = async (group: "production" | "staging" | "local" = "production") => {
  useEnvStore.getState().setActiveGroup(group);

  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const label = `env-${group}`;
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }
    const win = new WebviewWindow(label, {
      url: "index.html",
      title: `Manage Environments — ${group.charAt(0).toUpperCase() + group.slice(1)}`,
      width: 920,
      height: 560,
      minWidth: 760,
      minHeight: 460,
      resizable: true,
      decorations: false,
      transparent: true,
    });

    win.once("tauri://error", (e) => {
      console.warn("Failed to create standalone window, falling back to modal:", e);
      useEnvStore.getState().setModalOpen(true);
    });
  } catch (e) {
    console.warn("Tauri WebviewWindow unavailable, falling back to modal:", e);
    useEnvStore.getState().setModalOpen(true);
  }
};

interface EnvStore {
  environments: Environment[];
  activeGroup: "production" | "staging" | "local";
  groupActiveIds: Record<string, string | null>;
  activeId: string | null;
  isModalOpen: boolean;
  loadEnvironments: () => Promise<void>;
  setActiveGroup: (group: "production" | "staging" | "local") => void;
  setActiveId: (id: string | null) => Promise<void>;
  setActiveIdForGroup: (group: "production" | "staging" | "local", id: string | null) => Promise<void>;
  saveEnvironment: (env: Environment) => Promise<void>;
  deleteEnvironment: (id: string) => Promise<void>;
  setModalOpen: (isOpen: boolean) => void;
  getFlatActiveVariables: () => Record<string, string>;
  getSecretKeys: () => Set<string>;
  setVariableInActiveEnvironment: (key: string, value: string) => Promise<boolean>;
}

export const useEnvStore = create<EnvStore>((set, get) => ({
  environments: [],
  activeGroup: "local",
  groupActiveIds: {
    production: null,
    staging: null,
    local: null,
  },
  activeId: null,
  isModalOpen: false,

  loadEnvironments: async () => {
    try {
      const data = await invoke<EnvironmentsFile>("load_environments");
      
      const savedGroup = (safeGetStorage("boltt_active_group") as "production" | "staging" | "local") || "local";
      let savedGroupActiveIds: Record<string, string | null> = {
        production: null,
        staging: null,
        local: null,
      };

      try {
        const stored = safeGetStorage("boltt_group_active_ids");
        if (stored) {
          savedGroupActiveIds = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Failed to parse group active IDs:", e);
      }

      // Fallback for production activeId if not set in groupActiveIds but exists in backend
      if (!savedGroupActiveIds.production && data.activeId && getGroupFromId(data.activeId) === "production") {
        savedGroupActiveIds.production = data.activeId;
      }
      // Fallback for local activeId if not set in groupActiveIds but exists in backend
      if (!savedGroupActiveIds.local && data.activeId && getGroupFromId(data.activeId) === "local") {
        savedGroupActiveIds.local = data.activeId;
      }
      // Fallback for staging activeId if not set in groupActiveIds but exists in backend
      if (!savedGroupActiveIds.staging && data.activeId && getGroupFromId(data.activeId) === "staging") {
        savedGroupActiveIds.staging = data.activeId;
      }

      set({
        environments: data.environments || [],
        activeGroup: savedGroup,
        groupActiveIds: savedGroupActiveIds,
        activeId: savedGroupActiveIds[savedGroup] || null,
      });
    } catch (err) {
      console.error("Failed to load environments from backend:", err);
    }
  },

  setActiveGroup: (group: "production" | "staging" | "local") => {
    safeSetStorage("boltt_active_group", group);
    const { groupActiveIds } = get();
    set({
      activeGroup: group,
      activeId: groupActiveIds[group] || null,
    });
  },

  setActiveId: async (id: string | null) => {
    const { activeGroup } = get();
    await get().setActiveIdForGroup(activeGroup, id);
  },

  setActiveIdForGroup: async (group: "production" | "staging" | "local", id: string | null) => {
    const { groupActiveIds, environments } = get();
    const updatedActiveIds = {
      ...groupActiveIds,
      [group]: id,
    };
    safeSetStorage("boltt_group_active_ids", JSON.stringify(updatedActiveIds));

    const { activeGroup } = get();
    const isCurrentGroup = group === activeGroup;

    set({
      groupActiveIds: updatedActiveIds,
      ...(isCurrentGroup ? { activeId: id } : {}),
    });

    try {
      const currentActiveId = isCurrentGroup ? id : updatedActiveIds[activeGroup];
      await invoke("save_environments", {
        data: { environments, activeId: currentActiveId },
      });
    } catch (err) {
      console.error("Failed to save active environment ID to backend:", err);
    }
    await triggerSync();
  },

  saveEnvironment: async (env: Environment) => {
    const { environments, activeGroup, groupActiveIds } = get();
    const index = environments.findIndex((e) => e.id === env.id);
    let updated: Environment[];
    if (index >= 0) {
      updated = [...environments];
      updated[index] = env;
    } else {
      updated = [...environments, env];
    }
    set({ environments: updated });
    try {
      const activeId = groupActiveIds[activeGroup];
      await invoke("save_environments", {
        data: { environments: updated, activeId },
      });
    } catch (err) {
      console.error("Failed to save environment to backend:", err);
    }
    await triggerSync();
  },

  deleteEnvironment: async (id: string) => {
    const { environments, activeGroup, groupActiveIds } = get();
    const updated = environments.filter((e) => e.id !== id);

    const updatedActiveIds = { ...groupActiveIds };
    let activeIdsChanged = false;
    for (const group of ["production", "staging", "local"] as const) {
      if (updatedActiveIds[group] === id) {
        updatedActiveIds[group] = null;
        activeIdsChanged = true;
      }
    }

    if (activeIdsChanged) {
      safeSetStorage("boltt_group_active_ids", JSON.stringify(updatedActiveIds));
    }

    const newActiveId = updatedActiveIds[activeGroup];
    set({
      environments: updated,
      groupActiveIds: updatedActiveIds,
      activeId: newActiveId,
    });

    try {
      await invoke("save_environments", {
        data: { environments: updated, activeId: newActiveId },
      });
    } catch (err) {
      console.error("Failed to delete environment from backend:", err);
    }
    await triggerSync();
  },

  setModalOpen: (isOpen: boolean) => {
    set({ isModalOpen: isOpen });
  },

  getFlatActiveVariables: () => {
    const { environments, activeId } = get();
    const flatVars: Record<string, string> = {};
    if (!activeId) return flatVars;
    const activeEnv = environments.find((e) => e.id === activeId);
    if (!activeEnv) return flatVars;
    for (const v of activeEnv.variables) {
      if (v.enabled && v.key.trim()) {
        flatVars[v.key.trim()] = v.value;
      }
    }
    return flatVars;
  },

  getSecretKeys: () => {
    const { environments, activeId } = get();
    const secretKeys = new Set<string>();
    if (!activeId) return secretKeys;
    const activeEnv = environments.find((e) => e.id === activeId);
    if (!activeEnv) return secretKeys;
    for (const v of activeEnv.variables) {
      if (v.is_secret && v.key.trim()) {
        secretKeys.add(v.key.trim());
      }
    }
    return secretKeys;
  },

  setVariableInActiveEnvironment: async (key: string, value: string): Promise<boolean> => {
    const { environments, activeId, activeGroup, groupActiveIds, saveEnvironment } = get();
    const cleanKey = key.trim().replace(/^\{\{|\}\}$/g, "");
    if (!cleanKey) return false;

    if (environments.length === 0) {
      const defaultId = activeGroup === "production" ? "default" : `${activeGroup}:default`;
      const newEnv: Environment = {
        id: defaultId,
        name: "Default",
        variables: [{ key: cleanKey, value, enabled: true }],
      };
      await saveEnvironment(newEnv);
      await get().setActiveIdForGroup(activeGroup, newEnv.id);
      return true;
    }

    // Resolve target environment
    let targetEnv = environments.find((e) => e.id === activeId);
    if (!targetEnv) {
      const groupActiveId = groupActiveIds[activeGroup];
      targetEnv = environments.find((e) => e.id === groupActiveId);
    }
    if (!targetEnv) {
      targetEnv = environments.find((e) => getGroupFromId(e.id) === activeGroup) || environments[0];
    }
    if (!targetEnv) return false;

    const existingVarIndex = targetEnv.variables.findIndex(
      (v) => v.key.trim().toLowerCase() === cleanKey.toLowerCase()
    );

    const updatedVariables = [...targetEnv.variables];
    if (existingVarIndex >= 0) {
      updatedVariables[existingVarIndex] = {
        ...updatedVariables[existingVarIndex],
        key: cleanKey,
        value,
        enabled: true,
      };
    } else {
      updatedVariables.push({
        key: cleanKey,
        value,
        enabled: true,
      });
    }

    const updatedEnv: Environment = {
      ...targetEnv,
      variables: updatedVariables,
    };

    await saveEnvironment(updatedEnv);
    return true;
  },
}));

