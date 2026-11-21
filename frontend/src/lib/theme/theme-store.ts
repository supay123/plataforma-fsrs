// Estado del tema en el navegador (localStorage). Sin React: se usa también antes de pintar.
//
//   instId     código de la institución (llega en la URL de las invitaciones o del login, o del perfil)
//   themeMode  "light" | "dark": la elección del usuario con el interruptor; sobrevive al logout
//   instTheme  colores que devolvió GET /public/theme, con el instId al que pertenecen
//
// Sin colores guardados (o sin almacenamiento) se usan los de DEFAULT_PALETTES: nunca es un error.
import { applyPalette, DEFAULT_PALETTES, PALETTE_KEYS, type BasePalette, type ThemeMode } from "./palette";

export type InstTheme = { light: BasePalette | null; dark: BasePalette | null };

const INST_KEY = "instId";
const MODE_KEY = "themeMode";
const THEME_KEY = "instTheme";

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* sin almacenamiento */ }
}

export const readInstId = () => read(INST_KEY)?.trim() || null;
export const saveInstId = (instId: string | null) => write(INST_KEY, instId);

export function readMode(): ThemeMode {
  const stored = read(MODE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  const prefersLight = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}
export const saveMode = (mode: ThemeMode) => write(MODE_KEY, mode);

const isHex = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
function toPalette(value: unknown): BasePalette | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  if (!PALETTE_KEYS.every((key) => isHex(source[key]))) return null;
  return Object.fromEntries(PALETTE_KEYS.map((key) => [key, (source[key] as string).toLowerCase()])) as BasePalette;
}
/** Valida lo que llega del endpoint o del almacenamiento: lo que no sea una paleta válida cuenta como "sin colores". */
export function toInstTheme(value: unknown): InstTheme | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const theme = { light: toPalette(source.light), dark: toPalette(source.dark) };
  return theme.light || theme.dark ? theme : null;
}

export function readCachedTheme(instId: string | null): InstTheme | null {
  if (!instId) return null;
  try {
    const stored = JSON.parse(read(THEME_KEY) ?? "null") as { inst?: unknown; theme?: unknown } | null;
    return stored?.inst === instId ? toInstTheme(stored.theme) : null;
  } catch { return null; }
}
export function saveCachedTheme(instId: string, theme: InstTheme | null) {
  write(THEME_KEY, theme ? JSON.stringify({ inst: instId, theme }) : null);
}

export const resolvePalette = (mode: ThemeMode, theme: InstTheme | null): BasePalette => theme?.[mode] ?? DEFAULT_PALETTES[mode];

/** Pone los colores en <html>, de donde los heredan toasts y modales. */
export function applyDocumentTheme(mode: ThemeMode, theme: InstTheme | null) {
  applyPalette(document.documentElement, resolvePalette(mode, theme));
}

/**
 * Antes de pintar: toma el instId de la URL (`?instId=`, enlaces de invitaciones y correos) y aplica
 * el tema guardado, para que no haya un destello con los colores por defecto.
 */
export function bootstrapTheme() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("instId")?.trim();
    if (fromUrl) saveInstId(fromUrl.slice(0, 100));
  } catch { /* URL no disponible */ }
  applyDocumentTheme(readMode(), readCachedTheme(readInstId()));
}
