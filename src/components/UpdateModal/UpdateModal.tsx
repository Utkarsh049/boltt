import React, { useEffect } from "react";
import { useUpdateStore } from "../../store/updateStore";
import {
  X,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Info,
} from "lucide-react";

export const UpdateModal: React.FC = () => {
  const {
    isModalOpen,
    setModalOpen,
    status,
    currentVersion,
    availableVersion,
    releaseDate,
    releaseNotes,
    downloadProgress,
    downloadedBytes,
    totalBytes,
    errorMessage,
    checkForUpdates,
    downloadAndApplyUpdate,
  } = useUpdateStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen && status !== "downloading") {
        setModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, status, setModalOpen]);

  if (!isModalOpen) return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in select-none"
      onClick={() => {
        if (status !== "downloading") setModalOpen(false);
      }}
    >
      <div
        className="w-[460px] max-w-[90vw] bg-bg-secondary border border-border-primary rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary bg-bg-tertiary">
          <div className="flex items-center space-x-2">
            <ShieldCheck size={18} className="text-text-accent" />
            <h2 className="text-sm font-semibold tracking-wide text-text-primary">
              Software Updates
            </h2>
          </div>
          {status !== "downloading" && (
            <button
              onClick={() => setModalOpen(false)}
              className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-bg-hover transition cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col space-y-5">
          {/* Status: Checking */}
          {status === "checking" && (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <RefreshCw size={28} className="animate-spin text-text-accent" />
              <p className="text-xs text-text-secondary">Checking for new updates...</p>
            </div>
          )}

          {/* Status: Available */}
          {status === "available" && (
            <div className="flex flex-col space-y-4">
              <div className="p-3.5 rounded-lg bg-bg-tertiary border border-border-primary flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-wider text-text-secondary font-semibold">
                    Current Version
                  </span>
                  <span className="text-xs text-text-primary font-mono mt-0.5">
                    v{currentVersion}
                  </span>
                </div>
                <ArrowRight size={16} className="text-text-accent" />
                <div className="flex flex-col text-right">
                  <span className="text-[11px] uppercase tracking-wider text-text-accent font-semibold">
                    New Version
                  </span>
                  <span className="text-xs text-text-accent font-mono font-bold mt-0.5">
                    v{availableVersion}
                  </span>
                </div>
              </div>

              {releaseDate && (
                <div className="text-[11px] text-text-secondary">
                  Released on: {new Date(releaseDate).toLocaleDateString()}
                </div>
              )}

              {releaseNotes && (
                <div className="flex flex-col space-y-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-text-secondary font-semibold">
                    Release Notes
                  </span>
                  <div className="p-3 bg-bg-primary border border-border-primary rounded-lg text-xs text-text-secondary max-h-36 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                    {releaseNotes}
                  </div>
                </div>
              )}

              <button
                onClick={() => downloadAndApplyUpdate()}
                className="w-full py-2.5 px-4 rounded-lg bg-text-accent hover:opacity-90 text-bg-primary font-semibold text-xs tracking-wide transition flex items-center justify-center space-x-2 cursor-pointer shadow-md"
              >
                <Download size={15} />
                <span>Download & Install Update</span>
              </button>
            </div>
          )}

          {/* Status: Downloading */}
          {status === "downloading" && (
            <div className="py-4 flex flex-col space-y-4">
              <div className="flex items-center justify-between text-xs text-text-primary font-medium">
                <span>Downloading update package...</span>
                <span className="font-mono text-text-accent font-bold">
                  {downloadProgress}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-2 rounded-full bg-bg-tertiary overflow-hidden border border-border-primary">
                <div
                  className="h-full bg-text-accent transition-all duration-300 ease-out"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-text-secondary font-mono">
                <span>{formatBytes(downloadedBytes)}</span>
                <span>{totalBytes > 0 ? formatBytes(totalBytes) : "Calculating..."}</span>
              </div>

              <p className="text-[11px] text-text-secondary leading-normal">
                Boltt will verify signatures, apply the update, and relaunch automatically.
              </p>
            </div>
          )}

          {/* Status: Ready to restart */}
          {status === "ready" && (
            <div className="py-6 flex flex-col items-center justify-center space-y-3 text-center">
              <CheckCircle2 size={32} className="text-green-400" />
              <div className="flex flex-col space-y-1">
                <h3 className="text-sm font-semibold text-text-primary">
                  Update Installed!
                </h3>
                <p className="text-xs text-text-secondary">
                  Relaunching Boltt now to apply changes...
                </p>
              </div>
            </div>
          )}

          {/* Status: Up to date */}
          {status === "up-to-date" && (
            <div className="py-6 flex flex-col items-center justify-center space-y-3 text-center">
              <CheckCircle2 size={32} className="text-green-400" />
              <div className="flex flex-col space-y-1">
                <h3 className="text-sm font-semibold text-text-primary">
                  You are up to date!
                </h3>
                <p className="text-xs text-text-secondary">
                  Boltt v{currentVersion} is currently the latest version.
                </p>
              </div>
              <button
                onClick={() => checkForUpdates(false)}
                className="mt-2 py-1.5 px-3 rounded bg-bg-tertiary hover:bg-bg-hover border border-border-primary text-text-primary text-xs font-medium transition cursor-pointer flex items-center space-x-1.5"
              >
                <RefreshCw size={13} />
                <span>Check Again</span>
              </button>
            </div>
          )}

          {/* Status: Idle or Notice */}
          {status === "idle" && (
            <div className="py-4 flex flex-col space-y-4">
              <div className="p-3 rounded-lg bg-bg-tertiary border border-border-primary flex items-center justify-between text-xs">
                <span className="text-text-secondary">Installed Version</span>
                <span className="font-mono text-text-primary font-semibold">
                  v{currentVersion}
                </span>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start space-x-2 text-xs text-amber-300">
                  <Info size={15} className="flex-shrink-0 mt-0.5 text-amber-400" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              <button
                onClick={() => checkForUpdates(false)}
                className="w-full py-2.5 px-4 rounded-lg bg-bg-tertiary hover:bg-bg-hover border border-border-primary text-text-primary font-medium text-xs tracking-wide transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Check for Updates Now</span>
              </button>
            </div>
          )}

          {/* Status: Error */}
          {status === "error" && (
            <div className="py-4 flex flex-col space-y-4">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start space-x-2 text-xs text-red-300">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-red-400" />
                <div className="flex flex-col space-y-1">
                  <span className="font-semibold text-red-400">Update Check Failed</span>
                  <span className="leading-relaxed text-[11px] text-red-300/90 font-mono">
                    {errorMessage || "Unable to reach update servers. Please check your internet connection."}
                  </span>
                </div>
              </div>

              <button
                onClick={() => checkForUpdates(false)}
                className="w-full py-2 px-4 rounded-lg bg-bg-tertiary hover:bg-bg-hover border border-border-primary text-text-primary font-medium text-xs tracking-wide transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
