import { createContext, useContext, useEffect, type ReactNode } from "react";

/** Advertencia que el menú muestra antes de navegar o cerrar sesión. */
export interface LeaveWarning {
  title: string;
  body: ReactNode;
  /** Texto del botón que confirma la salida; por defecto "Confirmar". */
  confirmLabel?: string;
}

export interface PortalModeApi {
  setFocus: (value: boolean) => void;
  setLeaveWarning: (warning: LeaveWarning | null) => void;
}

export const PortalModeContext = createContext<PortalModeApi | null>(null);

/**
 * Reduce el menú del portal a iconos mientras la página está montada, sin
 * cambiar la preferencia guardada del usuario. Fuera de PortalLayout no hace nada.
 */
export function usePortalFocus(): void {
  const api = useContext(PortalModeContext);
  useEffect(() => {
    if (!api) return;
    api.setFocus(true);
    return () => api.setFocus(false);
  }, [api]);
}

/**
 * Mientras `warning` no sea null, los enlaces del menú y "Salir" piden
 * confirmación con un modal de advertencia. Pasa un objeto estable (constante
 * del módulo) para no reinstalarlo en cada render.
 */
export function useLeaveWarning(warning: LeaveWarning | null): void {
  const api = useContext(PortalModeContext);
  useEffect(() => {
    if (!api) return;
    api.setLeaveWarning(warning);
    return () => api.setLeaveWarning(null);
  }, [api, warning]);
}
