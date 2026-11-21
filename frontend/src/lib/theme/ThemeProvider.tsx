import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchInstTheme } from "../../features/theme/api";
import type { ThemeMode } from "./palette";
import { ThemeContext } from "./theme-context";
import { applyDocumentTheme, readCachedTheme, readInstId, readMode, saveCachedTheme, saveInstId, saveMode, toInstTheme, type InstTheme } from "./theme-store";

/**
 * Modo claro/oscuro (elegido por el usuario) y colores de la institución. Al conocer el `instId`
 * pide los colores al endpoint público y los guarda; si no hay colores (null) o la llamada falla,
 * se siguen usando los guardados o los de por defecto, sin mostrar ningún error.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [instId, setInstIdState] = useState<string | null>(readInstId);
  const [reloadCount, setReloadCount] = useState(0);
  // Colores que respondió el endpoint en esta sesión; mientras no llegan, valen los guardados.
  const [fetched, setFetched] = useState<{ inst: string; theme: InstTheme | null } | null>(null);
  const theme = useMemo(() => (fetched && fetched.inst === instId ? fetched.theme : readCachedTheme(instId)), [fetched, instId]);

  useEffect(() => { applyDocumentTheme(mode, theme); }, [mode, theme]);

  useEffect(() => {
    if (!instId) return;
    let cancelled = false;
    fetchInstTheme(instId)
      .then((value) => {
        if (cancelled) return;
        const next = toInstTheme(value);
        saveCachedTheme(instId, next);
        setFetched({ inst: instId, theme: next });
      })
      .catch(() => { /* sin red o sin respuesta: se queda lo guardado */ });
    return () => { cancelled = true; };
  }, [instId, reloadCount]);

  const setMode = useCallback((next: ThemeMode) => { saveMode(next); setModeState(next); }, []);
  const toggleMode = useCallback(() => setMode(mode === "dark" ? "light" : "dark"), [mode, setMode]);
  const setInstId = useCallback((next: string | null) => { saveInstId(next); setInstIdState(next); }, []);
  const reloadTheme = useCallback(() => setReloadCount((count) => count + 1), []);
  const value = useMemo(() => ({ mode, setMode, toggleMode, instId, setInstId, reloadTheme }), [mode, setMode, toggleMode, instId, setInstId, reloadTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
