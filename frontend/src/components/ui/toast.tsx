import clsx from "clsx";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastContext, type ToastApi, type ToastTone } from "./use-toast";

interface Toast { id: number; tone: ToastTone; message: string; duration: number }

const DEFAULT_DURATION_MS = 3500;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);
  const [paused, setPaused] = useState(false);

  // El tiempo se detiene mientras el mouse o el foco están sobre el aviso.
  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, onDismiss, toast.id]);

  const Icon = toast.tone === "success" ? CircleCheck : CircleAlert;
  const isSuccess = toast.tone === "success";
  return <div
    role={toast.tone === "error" ? "alert" : "status"}
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)}
    onBlur={() => setPaused(false)}
    className={clsx(
      "pointer-events-auto relative flex items-stretch gap-3 overflow-hidden rounded-xl border p-4 text-sm shadow-lg portal:rounded-none portal:shadow-[0_0_30px_-16px_black]",
      isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-100 portal:border-success/50 portal:bg-surface-deep portal:text-success-light" : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-400/30 dark:bg-rose-950 dark:text-rose-100 portal:border-danger/50 portal:bg-surface-deep portal:text-fg",
    )}
  >
    <Icon size={20} aria-hidden="true" className={clsx("mt-0.5 shrink-0", isSuccess ? "text-emerald-600 dark:text-emerald-400 portal:text-success-light" : "text-rose-600 dark:text-rose-400 portal:text-danger-light")} />
    <p className="flex-1 leading-5">{toast.message}</p>
    <div className={clsx("flex items-center border-l pl-3", isSuccess ? "border-emerald-200 dark:border-emerald-400/20" : "border-rose-200 dark:border-rose-400/20")}>
      <button type="button" aria-label="Cerrar notificación" className="rounded-lg portal:rounded-none p-1 opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10" onClick={() => onDismiss(toast.id)}>
        <X size={16} />
      </button>
    </div>
    {/* Misma duración que el temporizador y se pausa con él: llena = el aviso se cierra. */}
    <span
      aria-hidden="true"
      className={clsx("absolute inset-x-0 bottom-0 h-1 origin-left", isSuccess ? "bg-emerald-400 portal:bg-success" : "bg-rose-400 portal:bg-danger")}
      style={{ animation: `toast-progress ${toast.duration}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }}
    />
  </div>;
}

/** Notificaciones flotantes que desaparecen solas o con su botón de cerrar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const show = useCallback((tone: ToastTone, message: string, duration = DEFAULT_DURATION_MS) => {
    setToasts((current) => {
      // Un mismo aviso repetido (por ejemplo, un reintento que vuelve a fallar) no se apila.
      if (current.some((toast) => toast.tone === tone && toast.message === message)) return current;
      return [...current, { id: ++nextId.current, tone, message, duration }];
    });
  }, []);
  const api = useMemo<ToastApi>(() => ({
    success: (message, duration) => show("success", message, duration),
    error: (message, duration) => show("error", message, duration),
    dismiss,
  }), [show, dismiss]);

  return <ToastContext.Provider value={api}>
    {children}
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-96">
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)}
    </div>
  </ToastContext.Provider>;
}
