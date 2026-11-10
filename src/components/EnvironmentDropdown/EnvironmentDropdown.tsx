import React, { useState, useRef, useEffect } from "react";
import { useEnvStore, getGroupFromId, openEnvironmentWindow } from "../../store/envStore";
import { Globe, Settings, Check, ChevronDown, ChevronRight, Layers } from "lucide-react";

export const EnvironmentDropdown: React.FC = () => {
  const environments = useEnvStore((state) => state.environments);
  const activeGroup = useEnvStore((state) => state.activeGroup);
  const setActiveGroup = useEnvStore((state) => state.setActiveGroup);
  const groupActiveIds = useEnvStore((state) => state.groupActiveIds);
  const setActiveIdForGroup = useEnvStore((state) => state.setActiveIdForGroup);
  const [isOpen, setIsOpen] = useState(false);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [hoveredSubGroup, setHoveredSubGroup] = useState<"production" | "staging" | "local" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const groupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subGroupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeId = groupActiveIds[activeGroup] || null;
  const currentGroupEnvs = environments.filter((e) => getGroupFromId(e.id) === activeGroup);
  const activeEnv = currentGroupEnvs.find((e) => e.id === activeId);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (groupTimerRef.current) clearTimeout(groupTimerRef.current);
      if (subGroupTimerRef.current) clearTimeout(subGroupTimerRef.current);
    };
  }, []);

  const closeAllMenus = () => {
    if (groupTimerRef.current) clearTimeout(groupTimerRef.current);
    if (subGroupTimerRef.current) clearTimeout(subGroupTimerRef.current);
    setIsOpen(false);
    setIsGroupMenuOpen(false);
    setHoveredSubGroup(null);
  };

  const handleGroupMouseEnter = () => {
    if (groupTimerRef.current) {
      clearTimeout(groupTimerRef.current);
      groupTimerRef.current = null;
    }
    setIsGroupMenuOpen(true);
  };

  const handleGroupMouseLeave = () => {
    if (groupTimerRef.current) clearTimeout(groupTimerRef.current);
    groupTimerRef.current = setTimeout(() => {
      setIsGroupMenuOpen(false);
      setHoveredSubGroup(null);
    }, 220);
  };

  const handleSubGroupMouseEnter = (group: "production" | "staging" | "local") => {
    if (groupTimerRef.current) {
      clearTimeout(groupTimerRef.current);
      groupTimerRef.current = null;
    }
    if (subGroupTimerRef.current) {
      clearTimeout(subGroupTimerRef.current);
      subGroupTimerRef.current = null;
    }
    setHoveredSubGroup(group);
  };

  const handleSubGroupMouseLeave = () => {
    if (subGroupTimerRef.current) clearTimeout(subGroupTimerRef.current);
    subGroupTimerRef.current = setTimeout(() => {
      setHoveredSubGroup(null);
    }, 220);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeAllMenus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectEnv = (id: string | null) => {
    setActiveIdForGroup(activeGroup, id);
    closeAllMenus();
  };

  const handleManageClick = () => {
    openEnvironmentWindow(activeGroup);
    closeAllMenus();
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setIsGroupMenuOpen(false);
          setHoveredSubGroup(null);
        }}
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
        <div className="absolute right-0 mt-1.5 w-64 bg-bg-secondary border border-border-primary rounded-md shadow-2xl z-50 overflow-visible py-1 font-sans animate-fade-in select-none">
          {/* Windows-style Flyout: Switch Environment Group */}
          <div
            className="relative"
            onMouseEnter={handleGroupMouseEnter}
            onMouseLeave={handleGroupMouseLeave}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-tertiary flex items-center justify-between transition cursor-pointer"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <Layers size={13} className="text-text-accent flex-shrink-0" />
                <span className="truncate">Environment Group</span>
              </div>
              <div className="flex items-center space-x-1.5 text-text-secondary flex-shrink-0 ml-2">
                <span className="px-1.5 py-0.5 bg-bg-primary text-text-accent text-[10px] font-mono rounded font-semibold uppercase tracking-wide border border-border-primary/50">
                  {activeGroup}
                </span>
                <ChevronRight size={12} className="text-text-secondary" />
              </div>
            </button>

            {/* Level 1 Flyout Submenu: Groups (Production, Staging, Local) */}
            {isGroupMenuOpen && (
              <div
                onMouseEnter={handleGroupMouseEnter}
                onMouseLeave={handleGroupMouseLeave}
                className="absolute right-full top-0 mr-1 w-56 bg-bg-secondary border border-border-primary rounded-md shadow-2xl z-50 py-1 overflow-visible animate-fade-in font-sans after:absolute after:top-0 after:bottom-0 after:-right-2 after:w-3"
              >
                <div className="px-3 py-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-primary mb-1">
                  Environment Groups
                </div>
                {(["production", "staging", "local"] as const).map((group) => {
                  const isCurrentActiveGroup = activeGroup === group;
                  const groupEnvs = environments.filter((e) => getGroupFromId(e.id) === group);
                  const activeEnvIdForGroup = groupActiveIds[group];
                  const activeEnvForGroup = groupEnvs.find((e) => e.id === activeEnvIdForGroup);

                  return (
                    <div
                      key={group}
                      className="relative"
                      onMouseEnter={() => handleSubGroupMouseEnter(group)}
                      onMouseLeave={handleSubGroupMouseLeave}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveGroup(group);
                          closeAllMenus();
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition cursor-pointer hover:bg-bg-tertiary ${
                          isCurrentActiveGroup ? "text-text-accent font-semibold bg-bg-tertiary/60" : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="capitalize font-medium text-text-primary">{group}</span>
                            {isCurrentActiveGroup && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] text-text-secondary/70 font-mono truncate mt-0.5">
                            {activeEnvForGroup ? activeEnvForGroup.name : "No Environment"}
                          </span>
                        </div>
                        <ChevronRight size={12} className="text-text-secondary flex-shrink-0" />
                      </button>

                      {/* Level 2 Flyout Submenu: Environments in this Group */}
                      {hoveredSubGroup === group && (
                        <div
                          onMouseEnter={() => {
                            handleGroupMouseEnter();
                            handleSubGroupMouseEnter(group);
                          }}
                          onMouseLeave={() => {
                            handleSubGroupMouseLeave();
                            handleGroupMouseLeave();
                          }}
                          className="absolute right-full top-0 mr-1 w-52 bg-bg-secondary border border-border-primary rounded-md shadow-2xl z-50 py-1 overflow-hidden animate-fade-in font-sans after:absolute after:top-0 after:bottom-0 after:-right-2 after:w-3"
                        >
                          <div className="px-3 py-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-primary mb-1 flex items-center justify-between">
                            <span className="capitalize">{group} Envs</span>
                            <span className="text-[10px] text-text-secondary/60 lowercase font-normal">
                              {groupEnvs.length} envs
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveGroup(group);
                              setActiveIdForGroup(group, null);
                              closeAllMenus();
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary flex items-center justify-between transition cursor-pointer"
                          >
                            <span className="truncate">No Environment</span>
                            {!activeEnvIdForGroup && isCurrentActiveGroup && <Check size={12} className="text-text-accent" />}
                          </button>

                          {groupEnvs.map((env) => (
                            <button
                              key={env.id}
                              type="button"
                              onClick={() => {
                                setActiveGroup(group);
                                setActiveIdForGroup(group, env.id);
                                closeAllMenus();
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary flex items-center justify-between transition cursor-pointer"
                            >
                              <span className="truncate">{env.name}</span>
                              {activeEnvIdForGroup === env.id && isCurrentActiveGroup && <Check size={12} className="text-text-accent" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border-primary my-1" />

          {/* Current Group Environments Section */}
          <div className="px-3 py-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-primary mb-1 flex items-center justify-between">
            <span className="capitalize">{activeGroup} Environments</span>
            <span className="text-[10px] text-text-secondary/60 lowercase font-normal">{currentGroupEnvs.length} available</span>
          </div>
          
          <button
            type="button"
            onClick={() => handleSelectEnv(null)}
            className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary flex items-center justify-between transition cursor-pointer"
          >
            <span className="truncate">No Environment</span>
            {!activeId && <Check size={12} className="text-text-accent" />}
          </button>

          {currentGroupEnvs.map((env) => (
            <button
              key={env.id}
              type="button"
              onClick={() => handleSelectEnv(env.id)}
              className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary flex items-center justify-between transition cursor-pointer"
            >
              <span className="truncate">{env.name}</span>
              {activeId === env.id && <Check size={12} className="text-text-accent" />}
            </button>
          ))}

          <div className="border-t border-border-primary mt-1 pt-1">
            <button
              type="button"
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
