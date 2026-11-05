import React, { useRef, useEffect } from "react";
import { TimingWaterfall } from "../../store/requestStore";
import { Activity, X } from "lucide-react";

export interface TimingWaterfallPopoverProps {
  timing: TimingWaterfall;
  isOpen: boolean;
  onClose: () => void;
}

export const TimingWaterfallPopover: React.FC<TimingWaterfallPopoverProps> = ({
  timing,
  isOpen,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const total = Math.max(timing.total_ms, 1);

  const phases = [
    {
      name: "DNS Lookup",
      ms: timing.dns_ms,
      color: "bg-sky-400",
      textColor: "text-sky-400",
      description: "Domain name resolution time",
    },
    {
      name: "TCP Connect",
      ms: timing.connect_ms,
      color: "bg-blue-400",
      textColor: "text-blue-400",
      description: "TCP socket connection handshake",
    },
    {
      name: "TLS Handshake",
      ms: timing.tls_ms,
      color: "bg-purple-400",
      textColor: "text-purple-400",
      description: "SSL/TLS cryptographic negotiation",
    },
    {
      name: "Server Wait (TTFB)",
      ms: timing.ttfb_ms,
      color: "bg-amber-400",
      textColor: "text-amber-400",
      description: "Time to first response byte from server",
    },
    {
      name: "Content Download",
      ms: timing.transfer_ms,
      color: "bg-emerald-400",
      textColor: "text-emerald-400",
      description: "Streaming response payload bytes",
    },
  ];

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-72 bg-bg-secondary border border-border-primary rounded-md shadow-2xl z-50 p-3.5 text-xs font-sans animate-fade-in select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-primary pb-2 mb-2.5">
        <div className="flex items-center space-x-1.5 text-text-primary font-semibold text-xs">
          <Activity size={13} className="text-text-accent" />
          <span>Network Timing Waterfall</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-secondary hover:text-text-primary p-0.5 rounded transition cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      {/* Visual Stacked Bar */}
      <div className="h-2 w-full bg-bg-tertiary rounded-full overflow-hidden flex mb-3 border border-border-primary/50">
        {phases.map((phase, idx) => {
          const pct = Math.max((phase.ms / total) * 100, phase.ms > 0 ? 2 : 0);
          if (phase.ms === 0) return null;
          return (
            <div
              key={idx}
              style={{ width: `${pct}%` }}
              className={`h-full ${phase.color} transition-all duration-300`}
              title={`${phase.name}: ${phase.ms} ms (${Math.round((phase.ms / total) * 100)}%)`}
            />
          );
        })}
      </div>

      {/* Phase List */}
      <div className="space-y-1.5 text-[11px] font-mono">
        {phases.map((phase, idx) => {
          const pct = Math.round((phase.ms / total) * 100);
          return (
            <div key={idx} className="flex items-center justify-between py-0.5 group">
              <div className="flex items-center space-x-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${phase.color} flex-shrink-0`} />
                <span className="text-text-secondary font-sans truncate" title={phase.description}>
                  {phase.name}
                </span>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                <span className="text-text-primary font-semibold">{phase.ms} ms</span>
                <span className="text-text-secondary/60 text-[10px] w-8 text-right font-sans">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Total */}
      <div className="mt-3 pt-2 border-t border-border-primary/60 flex items-center justify-between font-mono text-xs">
        <span className="text-text-secondary font-sans font-semibold">Total Latency</span>
        <span className="text-text-accent font-bold">{timing.total_ms} ms</span>
      </div>
    </div>
  );
};

