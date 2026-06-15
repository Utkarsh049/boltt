import React from "react";
import { useToastStore, ToastMessage } from "../../store/toastStore";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export const ToastList: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-2 max-w-sm pointer-events-none select-none font-sans">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = ({
  toast,
  onRemove,
}) => {
  const getTheme = (type: string) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-[#1c2025]/90 border-green-500/20 shadow-green-950/20",
          icon: <CheckCircle size={15} className="text-green-400 flex-shrink-0" />,
        };
      case "error":
        return {
          bg: "bg-[#1c2025]/90 border-red-500/20 shadow-red-950/20",
          icon: <AlertCircle size={15} className="text-red-400 flex-shrink-0" />,
        };
      default: // info
        return {
          bg: "bg-[#1c2025]/90 border-[#30363D]/80 shadow-black/40",
          icon: <Info size={15} className="text-[#a1c9ff] flex-shrink-0" />,
        };
    }
  };

  const theme = getTheme(toast.type);

  return (
    <div
      style={{
        animation: "toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
      className={`pointer-events-auto flex items-center justify-between px-3.5 py-2.5 rounded border shadow-2xl backdrop-blur-md text-xs transition-all ${theme.bg}`}
    >
      <div className="flex items-center space-x-2.5 min-w-0">
        {theme.icon}
        <span className="font-semibold text-[#e0e2ea] truncate leading-normal">
          {toast.message}
        </span>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-3 text-[#8b919d] hover:text-[#e0e2ea] transition cursor-pointer focus:outline-none outline-none"
      >
        <X size={13} />
      </button>
    </div>
  );
};
