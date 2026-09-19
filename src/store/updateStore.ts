import { create } from "zustand";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import packageInfo from "../../package.json";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "ready"
  | "error";

interface UpdateStore {
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  status: UpdateStatus;
  updateObj: Update | null;
  currentVersion: string;
  availableVersion: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  downloadProgress: number; // 0 - 100
  downloadedBytes: number;
  totalBytes: number;
  errorMessage: string | null;

  checkForUpdates: (silent?: boolean) => Promise<void>;
  downloadAndApplyUpdate: () => Promise<void>;
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  isModalOpen: false,
  setModalOpen: (open) => set({ isModalOpen: open }),
  status: "idle",
  updateObj: null,
  currentVersion: packageInfo.version,
  availableVersion: null,
  releaseDate: null,
  releaseNotes: null,
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  errorMessage: null,

  checkForUpdates: async (silent = false) => {
    if (import.meta.env.DEV) {
      if (!silent) {
        set({
          status: "idle",
          errorMessage: "In-app updates are active in production releases. Auto-updates are disabled during development mode.",
        });
      }
      return;
    }

    try {
      set({ status: "checking", errorMessage: null });
      const update = await check();

      if (update && update.available) {
        set({
          status: "available",
          updateObj: update,
          availableVersion: update.version,
          releaseDate: update.date || null,
          releaseNotes: update.body || null,
        });
      } else {
        set({
          status: "up-to-date",
          updateObj: null,
          availableVersion: null,
          releaseDate: null,
          releaseNotes: null,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("Update check encountered an issue:", msg);
      if (!silent) {
        set({
          status: "error",
          errorMessage: msg,
        });
      } else {
        set({ status: "idle" });
      }
    }
  },

  downloadAndApplyUpdate: async () => {
    const { updateObj } = get();
    if (!updateObj) return;

    try {
      set({
        status: "downloading",
        downloadProgress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        errorMessage: null,
      });

      let downloaded = 0;
      let total = 0;

      await updateObj.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength || 0;
            set({ totalBytes: total });
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            set({
              downloadedBytes: downloaded,
              downloadProgress: total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0,
            });
            break;
          case "Finished":
            set({ downloadProgress: 100 });
            break;
        }
      });

      set({ status: "ready" });
      await relaunch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to download or apply update:", msg);
      set({
        status: "error",
        errorMessage: msg,
      });
    }
  },
}));
