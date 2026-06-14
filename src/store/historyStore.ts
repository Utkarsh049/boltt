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

interface HistoryStore {
  entries: HistoryEntry[];
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  addLocalEntry: (entry: HistoryEntry) => void;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  entries: [],
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
