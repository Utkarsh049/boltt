import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

export interface Variable {
  key: string;
  value: string;
  enabled: boolean;
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

const triggerSync = async () => {
  try {
    await emit("environments-updated");
  } catch (e) {
    console.warn("Could not emit environments-updated event:", e);
  }
};

export const openEnvironmentWindow = async (group: "production" | "staging" | "local") => {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const label = `env-${group}`;
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.setFocus();
      return;
    }
    new WebviewWindow(label, {
      url: "index.html",
      title: `Manage Environments — ${group.charAt(0).toUpperCase() + group.slice(1)}`,
      width: 800,
      height: 550,
      minWidth: 700,
      minHeight: 450,
      resizable: true,
      decorations: false,
      transparent: true,
    });
  } catch (e) {
    console.error("Failed to open environment window:", e);
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
      
      const savedGroup = (localStorage.getItem("boltt_active_group") as "production" | "staging" | "local") || "local";
      let savedGroupActiveIds: Record<string, string | null> = {
        production: null,
        staging: null,
        local: null,
      };

      try {
        const stored = localStorage.getItem("boltt_group_active_ids");
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
    localStorage.setItem("boltt_active_group", group);
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
    localStorage.setItem("boltt_group_active_ids", JSON.stringify(updatedActiveIds));

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
      localStorage.setItem("boltt_group_active_ids", JSON.stringify(updatedActiveIds));
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
}));

