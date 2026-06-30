import React, { useState } from "react";
import { useRequestStore } from "../../store/requestStore";
import { X, Plus } from "lucide-react";

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, openTab, reorderTabs } = useRequestStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    reorderTabs(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="flex items-center w-full h-9 bg-[#161B22] select-none flex-shrink-0">
      {/* Scrollable Tabs Container */}
      <div className="flex items-center overflow-x-auto overflow-y-hidden h-full max-w-[calc(100%-40px)] scrollbar-none">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const method = tab.request.method;
          const name = tab.request.name || "New Request";
          const isDragging = draggedIndex === index;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  // Middle click closes tab
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`group flex items-center space-x-2 px-3 h-full border-r border-[#30363D] cursor-grab active:cursor-grabbing transition select-none text-[11px] font-semibold min-w-[120px] max-w-[160px] ${isDragging ? "opacity-30 bg-[#272a30]/50" : ""
                } ${isActive && !isDragging
                  ? "bg-[#101419] text-[#a1c9ff] border-b border-b-transparent"
                  : "bg-[#161B22]/50 text-[#8b919d] hover:bg-[#161B22]/80 hover:text-[#e0e2ea] border-b border-b-[#30363D]"
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
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={`absolute flex items-center justify-center w-3.5 h-3.5 rounded-sm hover:bg-[#272a30] text-[#8b919d] hover:text-[#e0e2ea] transition-all cursor-pointer ${tab.isDirty
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
          className="flex items-center justify-center w-9 h-full text-[#8b919d] hover:text-[#e0e2ea] hover:bg-[#272a30]/30 transition cursor-pointer border-b border-b-[#30363D] flex-shrink-0"
          title="Open new tab (Ctrl+T)"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Spacer filling remaining tabs bar width */}
      <div className="flex-1 h-full border-b border-b-[#30363D] bg-[#161B22]/30" />
    </div>
  );
};
