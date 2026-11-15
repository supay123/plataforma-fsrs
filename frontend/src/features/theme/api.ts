import { invokeFunction } from "../../lib/api/functions";
import { type BasePalette, type ThemeMode } from "../../lib/theme/palette";
import { supabase } from "../../lib/supabase/client";

/** Colores públicos de una institución (sin sesión). `theme: null` = sin colores configurados. */
export async function fetchInstTheme(instId: string): Promise<unknown> {
  const { theme } = await invokeFunction<{ theme: unknown }, Record<string, never>>(`public/theme?inst=${encodeURIComponent(instId)}`, {}, { method: "GET" });
  return theme ?? null;
}

/** Código del colegio (el `instId`) de un colegio, para quien ya inició sesión. */
export async function fetchCollegeCode(collegeId: string): Promise<string | null> {
  const { data, error } = await supabase.from("colleges").select("code").eq("id", collegeId).maybeSingle();
  if (error) throw error;
  return data?.code ?? null;
}

export type CollegeThemes = Record<ThemeMode, BasePalette | null>;

// ── Admin: edición de los colores de una institución ─────────────────────────────────────
export async function getCollegeThemes(collegeId: string): Promise<CollegeThemes> {
  const { data, error } = await supabase.from("college_themes").select("mode,primary_color,secondary_color,base_color,blocks_color").eq("college_id", collegeId);
  if (error) throw error;
  const themes: CollegeThemes = { light: null, dark: null };
  for (const row of data ?? []) {
    if (row.mode === "light" || row.mode === "dark") themes[row.mode] = { primary: row.primary_color, secondary: row.secondary_color, base: row.base_color, blocks: row.blocks_color };
  }
  return themes;
}

/** Guarda los dos modos a la vez. */
export async function saveCollegeThemes(collegeId: string, themes: Record<ThemeMode, BasePalette>): Promise<void> {
  const rows = (["light", "dark"] as const).map((mode) => ({
    college_id: collegeId, mode,
    primary_color: themes[mode].primary, secondary_color: themes[mode].secondary, base_color: themes[mode].base, blocks_color: themes[mode].blocks,
  }));
  const { error } = await supabase.from("college_themes").upsert(rows, { onConflict: "college_id,mode" });
  if (error) throw error;
}

/** Vuelve a los colores por defecto: sin filas, la institución usa los de la plataforma. */
export async function resetCollegeThemes(collegeId: string): Promise<void> {
  const { error } = await supabase.from("college_themes").delete().eq("college_id", collegeId);
  if (error) throw error;
}

/** Normaliza lo que escribe el admin ("#FFF", "ffffff", "#FFFFFF") a "#rrggbb"; null si no es un color. */
export function parseHex(input: string): string | null {
  const value = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(value)) return `#${value.split("").map((c) => c + c).join("")}`;
  return /^[0-9a-f]{6}$/.test(value) ? `#${value}` : null;
}
