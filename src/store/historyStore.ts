import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface HistoryEntry {
  id: string;
  method: string;
  url: string;
  status: number;
  timeMs: number;
  sentAt: number;
}

const RECENT_HISTORY_COLLAPSED_KEY = "boltt-recent-history-collapsed";

interface HistoryStore {
  entries: HistoryEntry[];
  isRecentCollapsed: boolean;
  setIsRecentCollapsed: (collapsed: boolean) => void;
  toggleRecentCollapsed: () => void;
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  addLocalEntry: (entry: HistoryEntry) => void;
}

const getInitialRecentCollapsed = (): boolean => {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(RECENT_HISTORY_COLLAPSED_KEY) === "true";
  }
  return false;
};

export const useHistoryStore = create<HistoryStore>((set) => ({
  entries: [],
  isRecentCollapsed: getInitialRecentCollapsed(),
  setIsRecentCollapsed: (collapsed: boolean) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(RECENT_HISTORY_COLLAPSED_KEY, String(collapsed));
    }
    set({ isRecentCollapsed: collapsed });
  },
  toggleRecentCollapsed: () => {
    set((state) => {
      const next = !state.isRecentCollapsed;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(RECENT_HISTORY_COLLAPSED_KEY, String(next));
      }
      return { isRecentCollapsed: next };
    });
  },
  loadHistory: async () => {
    try {
      const entries = await invoke<HistoryEntry[]>("load_history");
      set({ entries });
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  },
  clearHistory: async () => {
    try {
      await invoke("clear_history");
      set({ entries: [] });
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  },
  addLocalEntry: (entry: HistoryEntry) => {
    set((state) => {
      const updated = [entry, ...state.entries];
      if (updated.length > 100) {
        updated.length = 100;
      }
      return { entries: updated };
    });
  },
}));
