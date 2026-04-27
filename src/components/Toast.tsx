import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

let toastId = 0;
const listeners: Array<(toasts: ToastItem[]) => void> = [];
let currentToasts: ToastItem[] = [];

function notify(type: ToastType, title: string, message?: string) {
  const item: ToastItem = { id: ++toastId, type, title, message };
  currentToasts = [...currentToasts, item];
  listeners.forEach(l => l(currentToasts));
  setTimeout(() => {
    currentToasts = currentToasts.filter(t => t.id !== item.id);
    listeners.forEach(l => l(currentToasts));
  }, 3500);
}

export const toast = {
  success: (title: string, message?: string) => notify("success", title, message),
  error:   (title: string, message?: string) => notify("error",   title, message),
  warning: (title: string, message?: string) => notify("warning", title, message),
  info:    (title: string, message?: string) => notify("info",    title, message),
};

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertCircle,
  info:    Info,
};

const STYLES = {
  success: { bg: "bg-[#0d2010] border-green-500/40",  icon: "text-green-400",  title: "text-green-300" },
  error:   { bg: "bg-[#200d0d] border-red-500/40",    icon: "text-red-400",    title: "text-red-300"   },
  warning: { bg: "bg-[#1a1500] border-amber-500/40",  icon: "text-amber-400",  title: "text-amber-300" },
  info:    { bg: "bg-[#0d1020] border-blue-500/40",   icon: "text-blue-400",   title: "text-blue-300"  },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const l = (t: ToastItem[]) => setToasts([...t]);
    listeners.push(l);
    return () => { const i = listeners.indexOf(l); if (i > -1) listeners.splice(i, 1); };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map(t => {
        const Icon = ICONS[t.type];
        const s = STYLES[t.type];
        return (
          <div key={t.id}
            className={`${s.bg} border rounded-2xl px-4 py-3 flex items-start gap-3 shadow-2xl backdrop-blur-sm animate-in slide-in-from-top duration-300`}>
            <Icon className={`w-5 h-5 ${s.icon} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm ${s.title}`}>{t.title}</p>
              {t.message && <p className="text-xs text-slate-400 mt-0.5">{t.message}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
