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
  isToastVisible: boolean;
  setToastVisible: (visible: boolean) => void;
  isNotesModalOpen: boolean;
  setNotesModalOpen: (open: boolean) => void;
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
  relaunchApp: () => Promise<void>;
}

let activeCheckId = 0;

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  isToastVisible: false,
  setToastVisible: (visible) => set({ isToastVisible: visible }),
  isNotesModalOpen: false,
  setNotesModalOpen: (open) => set({ isNotesModalOpen: open }),
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
    // If a check is already running and this is a silent check, ignore duplicate
    if (silent && get().status === "checking") {
      return;
    }

    if (!silent) {
      set({ isToastVisible: true, status: "checking", errorMessage: null });
    }

    const checkId = ++activeCheckId;

    if (import.meta.env.DEV) {
      if (!silent) {
        set({
          status: "idle",
          isToastVisible: get().isToastVisible,
          errorMessage: "In-app updates are active in production releases. Auto-updates are disabled during development mode.",
        });
      }
      return;
    }

    try {
      if (silent) {
        set({ status: "checking", errorMessage: null });
      }

      const update = await check();

      // Discard stale response if a newer check superseded this one
      if (checkId !== activeCheckId) return;

      if (update && update.available) {
        set({
          status: "available",
          isToastVisible: true,
          updateObj: update,
          availableVersion: update.version,
          releaseDate: update.date || null,
          releaseNotes: update.body || null,
        });
      } else {
        // If the user dismissed the toast while checking, keep it dismissed unless update is available
        set({
          status: "up-to-date",
          isToastVisible: !silent && get().isToastVisible,
          updateObj: null,
          availableVersion: null,
          releaseDate: null,
          releaseNotes: null,
        });
      }
    } catch (err: unknown) {
      if (checkId !== activeCheckId) return;

      const msg = err instanceof Error ? err.message : String(err);
      console.warn("Update check encountered an issue:", msg);
      if (!silent) {
        set({
          status: "error",
          isToastVisible: get().isToastVisible,
          errorMessage: msg,
        });
      } else {
        // When a silent check fails while the toast is visible, avoid leaving an empty panel
        if (get().isToastVisible) {
          set({ status: "idle", isToastVisible: false });
        } else {
          set({ status: "idle" });
        }
      }
    }
  },

  downloadAndApplyUpdate: async () => {
    const { updateObj } = get();
    if (!updateObj) {
      if (import.meta.env.DEV) {
        // Allow exercising download flow in Dev State Simulator
        set({
          status: "downloading",
          isToastVisible: true,
          downloadProgress: 0,
          downloadedBytes: 0,
          totalBytes: 24500000,
          errorMessage: null,
        });
        let downloaded = 0;
        const total = 24500000;
        const step = 2450000;
        const interval = setInterval(() => {
          downloaded = Math.min(total, downloaded + step);
          const progress = Math.min(100, Math.round((downloaded / total) * 100));
          set({
            downloadedBytes: downloaded,
            downloadProgress: progress,
          });
          if (downloaded >= total) {
            clearInterval(interval);
            set({ status: "ready", isToastVisible: true });
          }
        }, 150);
      }
      return;
    }

    try {
      set({
        status: "downloading",
        isToastVisible: true,
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

      set({ status: "ready", isToastVisible: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to download or apply update:", msg);
      set({
        status: "error",
        isToastVisible: true,
        errorMessage: msg,
      });
    }
  },

  relaunchApp: async () => {
    try {
      await relaunch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to relaunch application:", msg);
      set({
        status: "error",
        isToastVisible: true,
        errorMessage: `Failed to relaunch: ${msg}`,
      });
    }
  },
}));
