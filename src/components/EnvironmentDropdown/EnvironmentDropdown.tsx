import React, { useState, useRef, useEffect } from "react";
import { useEnvStore, getGroupFromId, openEnvironmentWindow } from "../../store/envStore";
import { Globe, Settings, Check, ChevronDown } from "lucide-react";

export const EnvironmentDropdown: React.FC = () => {
  const environments = useEnvStore((state) => state.environments);
  const activeGroup = useEnvStore((state) => state.activeGroup);
  const groupActiveIds = useEnvStore((state) => state.groupActiveIds);
  const setActiveIdForGroup = useEnvStore((state) => state.setActiveIdForGroup);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeId = groupActiveIds[activeGroup] || null;
  const currentGroupEnvs = environments.filter((e) => getGroupFromId(e.id) === activeGroup);
  const activeEnv = currentGroupEnvs.find((e) => e.id === activeId);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectEnv = (id: string | null) => {
    setActiveIdForGroup(activeGroup, id);
    setIsOpen(false);
  };

  const handleManageClick = () => {
    openEnvironmentWindow(activeGroup);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-2.5 py-1.5 bg-bg-tertiary/50 border border-border-primary hover:bg-bg-hover hover:border-text-secondary/40 rounded-md text-xs text-text-secondary hover:text-text-primary transition cursor-pointer select-none"
      >
        <Globe size={13} className={activeId ? "text-green-400 flex-shrink-0" : "text-text-secondary flex-shrink-0"} />
        <span className="px-1.5 py-0.5 bg-bg-primary text-text-accent text-[10px] font-mono rounded font-semibold uppercase tracking-wide border border-border-primary/50 flex-shrink-0">
          {activeGroup}
        </span>
        <span className="font-sans max-w-[150px] truncate text-text-primary">
          {activeEnv ? activeEnv.name : "No Environment"}
        </span>
        <ChevronDown size={12} className="text-text-secondary flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-60 bg-bg-secondary border border-border-primary rounded-md shadow-2xl z-50 overflow-hidden py-1">
          <div className="px-3 py-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-primary mb-1 flex items-center justify-between">
            <span>{activeGroup} Environments</span>
            <span className="text-[10px] text-text-secondary/60 lowercase font-normal">{currentGroupEnvs.length} available</span>
          </div>
          
          <button
            onClick={() => handleSelectEnv(null)}
            className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary flex items-center justify-between transition cursor-pointer"
          >
            <span className="truncate">No Environment</span>
            {!activeId && <Check size={12} className="text-text-accent" />}
          </button>

          {currentGroupEnvs.map((env) => (
            <button
              key={env.id}
              onClick={() => handleSelectEnv(env.id)}
              className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary flex items-center justify-between transition cursor-pointer"
            >
              <span className="truncate">{env.name}</span>
              {activeId === env.id && <Check size={12} className="text-text-accent" />}
            </button>
          ))}

          <div className="border-t border-border-primary mt-1 pt-1">
            <button
              onClick={handleManageClick}
              className="w-full text-left px-3 py-1.5 text-xs text-text-accent hover:bg-bg-tertiary flex items-center space-x-2 transition cursor-pointer font-semibold"
            >
              <Settings size={12} />
              <span>Manage Environments...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
