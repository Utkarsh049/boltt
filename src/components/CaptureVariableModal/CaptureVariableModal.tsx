import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRequestStore, ExtractorSource, ResponseExtractor } from "../../store/requestStore";
import { useEnvStore, getGroupFromId } from "../../store/envStore";
import { useToastStore } from "../../store/toastStore";
import { extractValueFromResponse } from "../../utils/responseExtractor";
import {
  X,
  Sparkles,
  Link2,
  FileCode,
  List,
  Hash,
  Check,
  AlertCircle,
  Globe,
} from "lucide-react";

export interface CaptureVariableModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSource?: ExtractorSource;
  initialProperty?: string;
  initialTargetVariable?: string;
}

export const CaptureVariableModal: React.FC<CaptureVariableModalProps> = ({
  isOpen,
  onClose,
  initialSource = "body",
  initialProperty = "",
  initialTargetVariable = "",
}) => {
  const { response, activeRequest, setExtractors } = useRequestStore();
  const { environments, activeGroup, groupActiveIds, setVariableInActiveEnvironment } = useEnvStore();
  const { showToast } = useToastStore();

  const [source, setSource] = useState<ExtractorSource>(initialSource);
  const [property, setProperty] = useState<string>(initialProperty);
  const [targetVariable, setTargetVariable] = useState<string>(initialTargetVariable);
  const [addToExtractors, setAddToExtractors] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setSource(initialSource);
      setProperty(initialProperty);
      setTargetVariable(
        initialTargetVariable ||
          (initialProperty ? initialProperty.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() : "")
      );
      setAddToExtractors(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialSource, initialProperty, initialTargetVariable]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Identify active environment name
  const activeEnvName = useMemo(() => {
    const activeId = groupActiveIds[activeGroup];
    const env = environments.find((e) => e.id === activeId) ||
      environments.find((e) => getGroupFromId(e.id) === activeGroup);
    if (env) return `${env.name} (${activeGroup})`;
    return environments.length > 0
      ? `${environments[0].name} (${getGroupFromId(environments[0].id)})`
      : `Default (${activeGroup})`;
  }, [environments, activeGroup, groupActiveIds]);

  // Evaluate preview value
  const evaluatedValue = useMemo(() => {
    if (!response) return null;
    const dummyExtractor: ResponseExtractor = {
      id: "preview",
      source,
      property: source === "status" ? "" : property,
      targetVariable: targetVariable || "temp",
      enabled: true,
    };
    return extractValueFromResponse(response, dummyExtractor);
  }, [response, source, property, targetVariable]);

  // Available headers for datalist autocomplete
  const availableHeaders = useMemo(() => {
    if (!response?.headers) return [];
    return response.headers.map((h) => h.key);
  }, [response?.headers]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanVar = targetVariable.trim().replace(/^\{\{|\}\}$/g, "");
    if (!cleanVar) {
      showToast("Please provide a variable name", "error");
      return;
    }

    if (evaluatedValue === null || evaluatedValue === undefined) {
      showToast("No valid value could be extracted from response", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Save directly into active environment
      await setVariableInActiveEnvironment(cleanVar, evaluatedValue);

      // 2. Optionally append to active request's extractors
      if (addToExtractors) {
        const currentExtractors = activeRequest.extractors || [];
        const existingIdx = currentExtractors.findIndex(
          (ext) => ext.targetVariable.trim().toLowerCase() === cleanVar.toLowerCase()
        );

        const newExtractor: ResponseExtractor = {
          id: existingIdx >= 0 ? currentExtractors[existingIdx].id : crypto.randomUUID(),
          source,
          property: source === "status" ? "" : property.trim(),
          targetVariable: cleanVar,
          enabled: true,
        };

        let updatedExtractors: ResponseExtractor[];
        if (existingIdx >= 0) {
          updatedExtractors = [...currentExtractors];
          updatedExtractors[existingIdx] = newExtractor;
        } else {
          updatedExtractors = [...currentExtractors, newExtractor];
        }

        setExtractors(updatedExtractors);
      }

      showToast(`Captured {{${cleanVar}}} = "${evaluatedValue.slice(0, 32)}${evaluatedValue.length > 32 ? "..." : ""}"`, "success");
      onClose();
    } catch (err) {
      console.error("Failed to capture variable:", err);
      showToast("Failed to capture variable", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4 font-sans select-none">
      <div
        ref={modalRef}
        className="w-[460px] bg-bg-secondary border border-border-primary rounded-lg shadow-2xl flex flex-col animate-slide-up overflow-hidden"
      >
        {/* Header */}
        <div className="h-12 border-b border-border-primary bg-bg-tertiary flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Link2 size={15} className="text-text-accent" />
            <span className="font-semibold text-xs uppercase tracking-wider text-text-primary">
              Capture Variable
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition cursor-pointer"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Source Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              Extraction Source
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-bg-primary p-1 rounded border border-border-primary">
              <button
                type="button"
                onClick={() => setSource("body")}
                className={`flex items-center justify-center space-x-1.5 py-1.5 rounded transition cursor-pointer text-xs ${
                  source === "body"
                    ? "bg-bg-tertiary text-text-primary font-semibold shadow-sm border border-border-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <FileCode size={12} />
                <span>JSON Body</span>
              </button>
              <button
                type="button"
                onClick={() => setSource("header")}
                className={`flex items-center justify-center space-x-1.5 py-1.5 rounded transition cursor-pointer text-xs ${
                  source === "header"
                    ? "bg-bg-tertiary text-text-primary font-semibold shadow-sm border border-border-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <List size={12} />
                <span>Header</span>
              </button>
              <button
                type="button"
                onClick={() => setSource("status")}
                className={`flex items-center justify-center space-x-1.5 py-1.5 rounded transition cursor-pointer text-xs ${
                  source === "status"
                    ? "bg-bg-tertiary text-text-primary font-semibold shadow-sm border border-border-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Hash size={12} />
                <span>Status</span>
              </button>
            </div>
          </div>

          {/* Property / Key input */}
          {source !== "status" && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center justify-between">
                <span>{source === "body" ? "JSONPath / Property" : "Header Name"}</span>
                {source === "body" && (
                  <span className="text-[10px] text-text-secondary/70 font-normal lowercase">
                    e.g. data.token or token
                  </span>
                )}
              </label>
              {source === "body" ? (
                <input
                  type="text"
                  value={property}
                  onChange={(e) => {
                    setProperty(e.target.value);
                    if (!targetVariable) {
                      setTargetVariable(e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase());
                    }
                  }}
                  placeholder="data.token or token or items[0].id"
                  className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 font-mono text-text-primary focus:outline-none focus:border-text-accent"
                />
              ) : (
                <>
                  <input
                    type="text"
                    list="capture-header-options"
                    value={property}
                    onChange={(e) => {
                      setProperty(e.target.value);
                      if (!targetVariable) {
                        setTargetVariable(e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase());
                      }
                    }}
                    placeholder="Authorization, x-request-id, etc."
                    className="w-full bg-bg-primary border border-border-primary rounded px-3 py-1.5 font-mono text-text-primary focus:outline-none focus:border-text-accent"
                  />
                  <datalist id="capture-header-options">
                    {availableHeaders.map((hdr) => (
                      <option key={hdr} value={hdr} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
          )}

          {/* Target Variable Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center justify-between">
              <span>Target Variable Name</span>
              {targetVariable && (
                <span className="text-[10px] font-mono text-text-accent">
                  {"{{" + targetVariable.trim().replace(/^\{\{|\}\}$/g, "") + "}}"}
                </span>
              )}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-text-secondary font-mono text-xs select-none">
                {"{{"}
              </span>
              <input
                ref={inputRef}
                type="text"
                required
                value={targetVariable}
                onChange={(e) => setTargetVariable(e.target.value.replace(/^\{\{|\}\}$/g, ""))}
                placeholder="auth_token"
                className="w-full bg-bg-primary border border-border-primary rounded pl-7 pr-7 py-1.5 font-mono text-text-primary focus:outline-none focus:border-text-accent"
              />
              <span className="absolute right-2.5 text-text-secondary font-mono text-xs select-none">
                {"}}"}
              </span>
            </div>
          </div>

          {/* Live Preview of Extracted Value */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
              Live Preview
            </label>
            <div className="p-2 bg-bg-primary/80 border border-border-primary rounded min-h-[38px] flex items-center">
              {evaluatedValue !== null ? (
                <div className="flex items-center space-x-1.5 text-green-400 font-mono text-xs truncate">
                  <Check size={12} className="flex-shrink-0" />
                  <span className="truncate">{evaluatedValue}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-amber-400/80 text-[11px]">
                  <AlertCircle size={12} className="flex-shrink-0" />
                  <span>No matching value found in current response</span>
                </div>
              )}
            </div>
          </div>

          {/* Active Environment target and chaining options */}
          <div className="pt-2 border-t border-border-primary/60 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-text-secondary">
              <span className="flex items-center space-x-1">
                <Globe size={11} className="text-text-accent" />
                <span>Target Environment:</span>
              </span>
              <span className="font-mono text-text-primary font-medium">{activeEnvName}</span>
            </div>

            <label className="flex items-start space-x-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={addToExtractors}
                onChange={(e) => setAddToExtractors(e.target.checked)}
                className="mt-0.5 rounded border-border-primary text-text-accent focus:ring-0 focus:outline-none bg-bg-primary cursor-pointer"
              />
              <div className="text-[11px] text-text-secondary leading-tight">
                <span className="text-text-primary font-medium">Chain to Request Extractors</span>
                <p className="text-[10px] text-text-secondary/80 mt-0.5">
                  Automatically re-extract and update this variable on every future successful response.
                </p>
              </div>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition cursor-pointer border border-border-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || evaluatedValue === null || !targetVariable.trim()}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-text-accent text-bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <Sparkles size={12} />
              <span>{isSubmitting ? "Capturing..." : "Capture Variable"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

