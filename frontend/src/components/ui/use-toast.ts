import { createContext, useContext } from "react";

export type ToastTone = "success" | "error";
export interface ToastApi {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Muestra notificaciones flotantes; requiere ToastProvider en un nivel superior. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast debe usarse dentro de ToastProvider.");
  return api;
}
