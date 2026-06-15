import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileDown, X, ShieldAlert, CheckCircle } from "lucide-react";

interface ExportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  folderId: string;
  folderName: string;
  requestsCount: number;
}

export const ExportPDFModal: React.FC<ExportPDFModalProps> = ({
  isOpen,
  onClose,
  projectId,
  folderId,
  folderName,
  requestsCount,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successPath, setSuccessPath] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccessPath(null);

    const generatedDate = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Defer invoke slightly so React has time to render the loading state
    // and the browser repaints the viewport before the blocking save dialog opens
    setTimeout(async () => {
      try {
        const resultPath = await invoke<string | null>("export_folder_pdf", {
          projectId,
          folderId,
          generatedDate,
        });

        if (resultPath) {
          setSuccessPath(resultPath);
          // Automatically close modal after a brief delay so the user sees the success state
          setTimeout(() => {
            onClose();
            setSuccessPath(null);
          }, 1800);
        } else {
          // User cancelled save dialog
          setIsExporting(false);
        }
      } catch (err) {
        console.error("PDF Export failed:", err);
        setError(String(err));
        setIsExporting(false);
      }
    }, 50);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 font-sans select-none">
      <div className="w-[440px] bg-[#161B22] border border-[#30363D] rounded-lg shadow-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="h-12 border-b border-[#30363D] bg-[#1c2025] flex items-center justify-between px-4 flex-shrink-0 rounded-t-lg">
          <div className="flex items-center space-x-2">
            <FileDown size={15} className="text-[#a1c9ff]" />
            <span className="font-semibold text-xs uppercase tracking-wider text-[#e0e2ea]">
              Export Collection as PDF
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#8b919d] hover:text-[#e0e2ea] transition cursor-pointer focus:outline-none outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-left">
          {successPath ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-3 text-center">
              <CheckCircle size={36} className="text-green-400 animate-bounce" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#e0e2ea]">Export Successful!</p>
                <p className="text-xs text-[#8b919d] max-w-[320px] truncate" title={successPath}>
                  Saved to: <span className="font-mono text-[#a1c9ff]">{successPath.split(/[/\\]/).pop()}</span>
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Folder Details */}
              <div className="bg-[#101419] border border-[#30363D] p-4 rounded-sm space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#8b919d]">Target Folder:</span>
                  <span className="font-semibold text-[#e0e2ea]">{folderName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#8b919d]">Total Requests:</span>
                  <span className="font-bold text-[#a1c9ff] bg-[#a1c9ff]/10 px-2 py-0.5 rounded-full border border-[#a1c9ff]/20">
                    {requestsCount} {requestsCount === 1 ? "request" : "requests"}
                  </span>
                </div>
              </div>

              {/* Security Warning Callout */}
              <div className="flex items-start space-x-2.5 p-3 border border-amber-500/20 bg-amber-500/5 rounded text-[11px] text-amber-200/90 leading-normal">
                <ShieldAlert size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Security Notice</p>
                  <p>
                    For your privacy, environment variable values (such as <code className="bg-[#101419] px-1 py-0.2 rounded border border-[#30363D] text-[#a1c9ff] font-mono">{"{{api_key}}"}</code>) are <strong>not</strong> resolved into plain text in the exported document. Unmatched patterns remain intact.
                  </p>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-3 border border-red-500/20 bg-red-500/5 rounded text-xs text-red-400 flex items-start space-x-1.5">
                  <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
                  <span>Failed to export PDF: {error}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#30363D]/30">
                <button
                  type="button"
                  onClick={() => {
                    if (!isExporting) {
                      onClose();
                    }
                  }}
                  className={`px-3.5 py-2 border border-[#30363D] rounded text-xs text-[#c0c7d3] hover:bg-[#272a30] cursor-pointer font-medium focus:outline-none outline-none ${
                    isExporting ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isExporting && requestsCount > 0) {
                      handleExport();
                    }
                  }}
                  className={`px-5 py-2 bg-[#a1c9ff] hover:bg-blue-300 text-[#00325a] rounded text-xs cursor-pointer font-bold flex items-center space-x-1.5 focus:outline-none outline-none ${
                    (isExporting || requestsCount === 0) ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
                  }`}
                >
                  {isExporting ? (
                    <div className="w-3 h-3 border-2 border-[#00325a] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <FileDown size={12} className="flex-shrink-0" />
                  )}
                  <span>{isExporting ? "Exporting..." : "Export PDF"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
