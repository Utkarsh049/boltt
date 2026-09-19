import React, { useEffect } from "react";
import { useUpdateStore } from "../../store/updateStore";
import { X, RotateCcw, Sparkles } from "lucide-react";

export const ReleaseNotesModal: React.FC = () => {
  const {
    isNotesModalOpen,
    setNotesModalOpen,
    availableVersion,
    releaseDate,
    releaseNotes,
    status,
    relaunchApp,
  } = useUpdateStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isNotesModalOpen) {
        setNotesModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNotesModalOpen, setNotesModalOpen]);

  if (!isNotesModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in select-none font-sans p-4"
      onClick={() => setNotesModalOpen(false)}
    >
      <div
        className="w-[500px] max-w-[92vw] max-h-[85vh] bg-bg-secondary border border-border-primary rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="h-12 border-b border-border-primary bg-bg-tertiary flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Sparkles size={16} className="text-text-accent" />
            <span className="font-semibold text-sm text-text-primary">
              What's New in Boltt v{availableVersion || "Latest"}
            </span>
          </div>
          <button
            onClick={() => setNotesModalOpen(false)}
            className="text-text-secondary hover:text-text-primary p-1 rounded hover:bg-bg-hover transition cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col space-y-4 overflow-y-auto flex-1">
          {releaseDate && (
            <div className="text-xs text-text-secondary">
              Released on {new Date(releaseDate).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          )}

          <div className="flex flex-col space-y-2">
            <span className="text-[11px] uppercase tracking-wider font-bold text-text-secondary">
              Changelog & Improvements
            </span>
            <div className="p-4 rounded-lg bg-bg-primary border border-border-primary text-xs text-text-primary font-mono whitespace-pre-wrap leading-relaxed max-h-[320px] overflow-y-auto">
              {releaseNotes || "No detailed release notes provided for this build."}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-12 border-t border-border-primary bg-bg-tertiary flex items-center justify-between px-4 flex-shrink-0">
          <button
            onClick={() => setNotesModalOpen(false)}
            className="px-3.5 py-1.5 border border-border-primary hover:bg-bg-hover rounded text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer"
          >
            Close
          </button>

          {status === "ready" && (
            <button
              onClick={() => relaunchApp()}
              className="px-4 py-1.5 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
            >
              <RotateCcw size={13} />
              <span>Restart & Apply Update</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
