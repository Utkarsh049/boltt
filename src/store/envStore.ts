import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

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

interface EnvStore {
  environments: Environment[];
  activeId: string | null;
  isModalOpen: boolean;
  loadEnvironments: () => Promise<void>;
  setActiveId: (id: string | null) => Promise<void>;
  saveEnvironment: (env: Environment) => Promise<void>;
  deleteEnvironment: (id: string) => Promise<void>;
  setModalOpen: (isOpen: boolean) => void;
  getFlatActiveVariables: () => Record<string, string>;
}

export const useEnvStore = create<EnvStore>((set, get) => ({
  environments: [],
  activeId: null,
  isModalOpen: false,

  loadEnvironments: async () => {
    try {
      const data = await invoke<EnvironmentsFile>("load_environments");
      set({
        environments: data.environments || [],
        activeId: data.activeId || null,
      });
    } catch (err) {
      console.error("Failed to load environments from backend:", err);
    }
  },

  setActiveId: async (id: string | null) => {
    set({ activeId: id });
    const { environments } = get();
    try {
      await invoke("save_environments", {
        data: { environments, activeId: id },
      });
    } catch (err) {
      console.error("Failed to save active environment ID to backend:", err);
    }
  },

  saveEnvironment: async (env: Environment) => {
    const { environments, activeId } = get();
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
      await invoke("save_environments", {
        data: { environments: updated, activeId },
      });
    } catch (err) {
      console.error("Failed to save environment to backend:", err);
    }
  },

  deleteEnvironment: async (id: string) => {
    const { environments, activeId } = get();
    const updated = environments.filter((e) => e.id !== id);
    const newActiveId = activeId === id ? null : activeId;
    set({ environments: updated, activeId: newActiveId });
    try {
      await invoke("save_environments", {
        data: { environments: updated, activeId: newActiveId },
      });
    } catch (err) {
      console.error("Failed to delete environment from backend:", err);
    }
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
