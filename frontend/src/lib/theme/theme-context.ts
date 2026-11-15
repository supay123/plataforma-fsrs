import { createContext, useContext } from "react";
import type { ThemeMode } from "./palette";

export interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  /** Código de la institución cuyos colores se usan (null: colores por defecto). */
  instId: string | null;
  setInstId: (instId: string | null) => void;
  /** Vuelve a pedir los colores de la institución actual (por ejemplo, después de que el admin los guarda). */
  reloadTheme: () => void;
}

// Sin proveedor (pruebas de componentes sueltos) se comporta como el tema oscuro por defecto.
export const ThemeContext = createContext<ThemeState>({ mode: "dark", setMode: () => {}, toggleMode: () => {}, instId: null, setInstId: () => {}, reloadTheme: () => {} });

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
