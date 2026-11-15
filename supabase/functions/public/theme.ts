import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";

export type ThemeColors = {
  primary: string;
  secondary: string;
  base: string;
  blocks: string;
};

/**
 * GET /public/theme?inst=<código del colegio>
 * Colores de una institución para pintar el login antes de iniciar sesión.
 * Responde `{ theme: null }` (200, no es un error) si el colegio no existe o aún
 * no configuró colores: el navegador usa entonces los colores por defecto. Si
 * configuró solo un modo, el otro llega en null.
 */
export async function getTheme(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const code = new URL(request.url).searchParams.get("inst")?.trim();
  if (!code || code.length > 100) return json({ theme: null });

  // El código es único sin importar mayúsculas ni espacios (colleges_code_unique_ci).
  const { data: college, error: collegeError } = await context.supabaseAdmin
    .from(TABLES.colleges)
    .select("id")
    .ilike("code", code.replace(/[\\%_]/g, "\\$&"))
    .limit(1)
    .maybeSingle();
  if (collegeError) {
    throw new AppError(500, "theme_lookup_failed", collegeError.message);
  }
  if (!college) return json({ theme: null });

  const { data: rows, error } = await context.supabaseAdmin
    .from(TABLES.collegeThemes)
    .select("mode,primary_color,secondary_color,base_color,blocks_color")
    .eq("college_id", college.id);
  if (error) throw new AppError(500, "theme_lookup_failed", error.message);
  if (!rows?.length) return json({ theme: null });

  const pick = (mode: string): ThemeColors | null => {
    const row = rows.find((item) => item.mode === mode);
    return row
      ? {
        primary: row.primary_color,
        secondary: row.secondary_color,
        base: row.base_color,
        blocks: row.blocks_color,
      }
      : null;
  };
  return json({ theme: { light: pick("light"), dark: pick("dark") } });
}
