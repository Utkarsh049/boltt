import React from "react";
import { useUpdateStore } from "../../store/updateStore";
import {
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCcw,
  Info,
} from "lucide-react";

export const UpdateToast: React.FC = () => {
  const {
    isToastVisible,
    setToastVisible,
    status,
    currentVersion,
    availableVersion,
    releaseNotes,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    errorMessage,
    checkForUpdates,
    downloadAndApplyUpdate,
    relaunchApp,
    setNotesModalOpen,
  } = useUpdateStore();

  if (!isToastVisible) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div
      style={{
        animation: "toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
      className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] bg-bg-secondary border border-border-primary rounded-xl shadow-2xl overflow-hidden font-sans select-none flex flex-col text-xs"
    >
      {/* Toast Top Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-bg-tertiary border-b border-border-primary">
        <div className="flex items-center space-x-2">
          <Download size={14} className="text-text-accent" />
          <span className="font-semibold text-text-primary tracking-wide">
            Boltt Update
          </span>
        </div>
        <button
          onClick={() => setToastVisible(false)}
          className="text-text-secondary hover:text-text-primary p-0.5 rounded hover:bg-bg-hover transition cursor-pointer"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Toast Body */}
      <div className="p-4 flex flex-col space-y-3">
        {/* State: Checking */}
        {status === "checking" && (
          <div className="py-2 flex items-center space-x-3 text-text-secondary">
            <RefreshCw size={18} className="animate-spin text-text-accent flex-shrink-0" />
            <span>Checking for software updates...</span>
          </div>
        )}

        {/* State: Available (Ask user: Yes / No) */}
        {status === "available" && (
          <div className="flex flex-col space-y-3">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-text-primary text-sm">
                  Update Available
                </span>
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-text-accent/15 text-text-accent border border-text-accent/30">
                  v{availableVersion}
                </span>
              </div>
              <p className="text-text-secondary text-[11px] leading-relaxed">
                A new version of Boltt is available. Would you like to download and install it now?
              </p>
            </div>

            {/* Actions: Yes or No */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={() => downloadAndApplyUpdate()}
                className="flex-1 py-1.5 px-3 rounded bg-text-accent hover:opacity-90 text-[#00325a] font-bold text-xs tracking-wide transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Download size={13} />
                <span>Yes, Download</span>
              </button>
              <button
                onClick={() => setToastVisible(false)}
                className="py-1.5 px-3 rounded bg-bg-tertiary hover:bg-bg-hover border border-border-primary text-text-secondary hover:text-text-primary text-xs font-medium transition cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
        )}

        {/* State: Downloading with progress bar */}
        {status === "downloading" && (
          <div className="flex flex-col space-y-2.5">
            <div className="flex items-center justify-between font-medium">
              <span className="text-text-primary">Downloading update...</span>
              <span className="font-mono text-text-accent font-bold">
                {downloadProgress}%
              </span>
            </div>

            {/* Progress Track */}
            <div className="w-full h-1.5 rounded-full bg-bg-tertiary overflow-hidden border border-border-primary/60">
              <div
                className="h-full bg-text-accent transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-text-secondary font-mono">
              <span>{formatBytes(downloadedBytes)}</span>
              <span>{totalBytes > 0 ? formatBytes(totalBytes) : "Calculating..."}</span>
            </div>
          </div>
        )}

        {/* State: Ready (Download Complete, Option to view notes or restart) */}
        {status === "ready" && (
          <div className="flex flex-col space-y-3">
            <div className="flex items-start space-x-2.5">
              <CheckCircle2 size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-col space-y-0.5">
                <span className="font-bold text-text-primary text-xs">
                  Download Complete!
                </span>
                <p className="text-text-secondary text-[11px] leading-relaxed">
                  Boltt v{availableVersion} is ready. Restart to apply the update.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={() => relaunchApp()}
                className="flex-1 py-1.5 px-3 rounded bg-[#4ade80] hover:bg-[#22c55e] text-black font-bold text-xs tracking-wide transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <RotateCcw size={13} />
                <span>Restart Now</span>
              </button>
              {releaseNotes && (
                <button
                  onClick={() => setNotesModalOpen(true)}
                  className="py-1.5 px-3 rounded bg-bg-tertiary hover:bg-bg-hover border border-border-primary text-text-accent hover:text-text-primary text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                  title="View what changed in this version"
                >
                  <FileText size={13} />
                  <span>Release Notes</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* State: Up to date */}
        {status === "up-to-date" && (
          <div className="flex items-center space-x-2.5 py-1">
            <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold text-text-primary text-xs">
                You're up to date
              </span>
              <span className="text-[11px] text-text-secondary">
                Boltt v{currentVersion} is currently the latest version.
              </span>
            </div>
          </div>
        )}

        {/* State: Error */}
        {status === "error" && (
          <div className="flex flex-col space-y-2.5">
            <div className="flex items-start space-x-2 text-red-400">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div className="flex flex-col space-y-0.5 min-w-0">
                <span className="font-semibold text-xs">Update Failed</span>
                <span className="text-[11px] text-red-300/80 font-mono truncate">
                  {errorMessage || "Unable to reach update servers."}
                </span>
              </div>
            </div>
            <button
              onClick={() => checkForUpdates(false)}
              className="py-1 px-3 rounded bg-bg-tertiary hover:bg-bg-hover border border-border-primary text-text-primary text-xs font-medium transition cursor-pointer self-end"
            >
              Retry
            </button>
          </div>
        )}

        {/* State: Idle / Dev Notice */}
        {status === "idle" && errorMessage && (
          <div className="flex items-start space-x-2 text-amber-300">
            <Info size={15} className="flex-shrink-0 mt-0.5 text-amber-400" />
            <span className="text-[11px] leading-relaxed">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Dev Mode State Simulator: stripped in production */}
      {import.meta.env.DEV && (
        <div className="px-3 py-2 bg-bg-tertiary border-t border-border-primary flex flex-col space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold">
              Dev State Simulator
            </span>
            <span className="text-[8px] text-amber-400 font-mono">dev only</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                { label: "Prompt (Yes/No)", s: "available" },
                { label: "Downloading", s: "downloading" },
                { label: "Ready (Notes)", s: "ready" },
                { label: "Up to date", s: "up-to-date" },
                { label: "Error", s: "error" },
              ] as const
            ).map((item) => (
              <button
                key={item.s}
                onClick={() => {
                  useUpdateStore.setState({
                    status: item.s,
                    isToastVisible: true,
                    availableVersion: item.s === "available" || item.s === "ready" ? "1.2.0" : null,
                    releaseDate: new Date().toISOString(),
                    releaseNotes:
                      "• Added instant in-app update toast popups\n• Improved theme synchronization and contrast\n• Optimized offline cache and memory footprint\n• Bug fixes for window drag controls",
                    downloadProgress: item.s === "downloading" ? 68 : 100,
                    downloadedBytes: item.s === "downloading" ? 14800000 : 21500000,
                    totalBytes: 21500000,
                    errorMessage: item.s === "error" ? "Network timeout reaching GitHub Release" : null,
                  });
                }}
                className={`px-1.5 py-0.5 text-[9px] rounded border transition cursor-pointer ${
                  status === item.s
                    ? "bg-text-accent text-[#00325a] border-text-accent font-bold"
                    : "bg-bg-primary text-text-secondary border-border-primary hover:text-text-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
