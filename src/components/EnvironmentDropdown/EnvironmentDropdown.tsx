import React, { useState, useRef, useEffect } from "react";
import { useEnvStore, getGroupFromId, openEnvironmentWindow } from "../../store/envStore";
import { Globe, Settings, Check, ChevronDown } from "lucide-react";

export const EnvironmentDropdown: React.FC = () => {
  const { environments, activeGroup, groupActiveIds, setActiveIdForGroup } = useEnvStore();
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
        className="flex items-center space-x-2 px-3 py-1.5 bg-[#1c2025]/50 border border-[#30363D] hover:bg-[#272a30] hover:border-[#8b919d]/40 rounded text-xs text-[#c0c7d3] hover:text-[#e0e2ea] transition cursor-pointer select-none"
      >
        <Globe size={13} className={activeId ? "text-green-400" : "text-[#8b919d]"} />
        <span className="font-mono max-w-[120px] truncate capitalize">
          {activeEnv ? `${activeGroup}: ${activeEnv.name}` : `No Env (${activeGroup})`}
        </span>
        <ChevronDown size={12} className="text-[#8b919d]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-56 bg-[#161B22] border border-[#30363D] rounded shadow-xl z-50 overflow-hidden py-1">
          <div className="px-3 py-1 text-[10px] font-bold text-[#8b919d] uppercase tracking-wider border-b border-[#30363D] mb-1">
            {activeGroup} Environments
          </div>
          
          <button
            onClick={() => handleSelectEnv(null)}
            className="w-full text-left px-3 py-1.5 text-xs text-[#c0c7d3] hover:bg-[#1c2025] hover:text-[#e0e2ea] flex items-center justify-between transition cursor-pointer"
          >
            <span className="truncate">No Environment</span>
            {!activeId && <Check size={12} className="text-[#a1c9ff]" />}
          </button>

          {currentGroupEnvs.map((env) => (
            <button
              key={env.id}
              onClick={() => handleSelectEnv(env.id)}
              className="w-full text-left px-3 py-1.5 text-xs text-[#c0c7d3] hover:bg-[#1c2025] hover:text-[#e0e2ea] flex items-center justify-between transition cursor-pointer"
            >
              <span className="truncate">{env.name}</span>
              {activeId === env.id && <Check size={12} className="text-[#a1c9ff]" />}
            </button>
          ))}

          <div className="border-t border-[#30363D] mt-1 pt-1">
            <button
              onClick={handleManageClick}
              className="w-full text-left px-3 py-1.5 text-xs text-[#a1c9ff] hover:bg-[#1c2025] flex items-center space-x-2 transition cursor-pointer font-semibold"
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
