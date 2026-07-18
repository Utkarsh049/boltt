import React, { useState, useEffect } from "react";
import { useRequestStore } from "../../store/requestStore";
import { X, Plus } from "lucide-react";

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, openTab, reorderTabs } = useRequestStore();

  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [startX, setStartX] = useState<number>(0);
  const [currentX, setCurrentX] = useState<number>(0);
  const [tabWidth, setTabWidth] = useState<number>(140);

  // Listen to mousemove and mouseup events globally
  useEffect(() => {
    if (activeDragIndex === null) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      setCurrentX(e.clientX);

      const deltaX = e.clientX - startX;
      
      // Determine if we crossed to the right
      if (deltaX > tabWidth && activeDragIndex < tabs.length - 1) {
        reorderTabs(activeDragIndex, activeDragIndex + 1);
        setActiveDragIndex(activeDragIndex + 1);
        setStartX((prev) => prev + tabWidth);
      } 
      // Determine if we crossed to the left
      else if (deltaX < -tabWidth && activeDragIndex > 0) {
        reorderTabs(activeDragIndex, activeDragIndex - 1);
        setActiveDragIndex(activeDragIndex - 1);
        setStartX((prev) => prev - tabWidth);
      }
    };

    const handleGlobalMouseUp = () => {
      setActiveDragIndex(null);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [activeDragIndex, startX, tabWidth, tabs.length, reorderTabs]);

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "text-[#4ade80]";
      case "POST":
        return "text-[#fb923c]";
      case "PUT":
        return "text-[#60a5fa]";
      case "PATCH":
        return "text-[#c084fc]";
      case "DELETE":
        return "text-[#f87171]";
      default:
        return "text-[#8b919d]";
    }
  };

  const handleMouseDown = (e: React.MouseEvent, index: number, element: HTMLDivElement, tabId: string) => {
    if (e.button !== 0) return; // Only left click
    setActiveTab(tabId);
    setActiveDragIndex(index);
    setStartX(e.clientX);
    setCurrentX(e.clientX);
    
    const rect = element.getBoundingClientRect();
    setTabWidth(rect.width);
  };

  return (
    <div className="flex items-center w-full h-9 bg-bg-secondary select-none flex-shrink-0">
      {/* Scrollable Tabs Container */}
      <div className="flex items-center overflow-x-auto overflow-y-hidden h-full max-w-[calc(100%-40px)] scrollbar-none">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const method = tab.request.method;
          const name = tab.request.name || "New Request";
          const isDragged = activeDragIndex === index;

          const deltaX = isDragged ? currentX - startX : 0;
          const style = deltaX !== 0 
            ? { transform: `translateX(${deltaX}px)`, zIndex: 50, transition: "none" } 
            : undefined;

          return (
            <div
              key={tab.id}
              onMouseDown={(e) => handleMouseDown(e, index, e.currentTarget, tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              style={style}
              className={`group flex items-center space-x-2 px-3 h-full border-r border-border-primary select-none text-[11px] font-semibold min-w-[120px] max-w-[160px] ${
                activeDragIndex !== null
                  ? isDragged
                    ? "cursor-grabbing bg-bg-primary text-text-accent"
                    : "cursor-default opacity-60 border-b border-b-border-primary"
                  : isActive
                  ? "bg-bg-primary text-text-accent border-b border-b-transparent cursor-grab"
                  : "bg-bg-secondary/50 text-text-secondary hover:bg-bg-secondary/80 hover:text-text-primary border-b border-b-border-primary cursor-grab"
              }`}
            >
              {/* Colored Method Tag */}
              <span className={`text-[9px] font-extrabold flex-shrink-0 ${getMethodColor(method)}`}>
                {method}
              </span>

              {/* Truncated Name */}
              <span className="truncate flex-1 text-left font-medium text-[11px]">
                {name}
              </span>

              {/* Unsaved indicator or close icon */}
              <div className="flex items-center justify-center w-4 h-4 flex-shrink-0 relative">
                {tab.isDirty && (
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full group-hover:opacity-0 transition-opacity duration-100" />
                )}
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()} // Prevent drag start when clicking close
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={`absolute flex items-center justify-center w-3.5 h-3.5 rounded-sm hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer ${
                    tab.isDirty
                      ? "opacity-0 group-hover:opacity-100"
                      : "opacity-40 group-hover:opacity-100"
                  }`}
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add Tab Button */}
        <button
          type="button"
          onClick={() => openTab()}
          className="flex items-center justify-center w-9 h-full text-text-secondary hover:text-text-primary hover:bg-bg-hover/30 transition cursor-pointer border-b border-b-border-primary flex-shrink-0"
          title="Open new tab (Ctrl+T)"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Spacer filling remaining tabs bar width */}
      <div className="flex-1 h-full border-b border-b-border-primary bg-bg-secondary/30" />
    </div>
  );
};
