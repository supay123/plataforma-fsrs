import { TABLES } from "./database.constants.ts";
import type { EdgeContext } from "./types.ts";

/**
 * Código del colegio (el `instId` del frontend). Va en los links de correo para
 * que el navegador cargue los colores de la institución antes de iniciar sesión.
 * Es opcional: si no se encuentra, el link funciona igual con los colores por defecto.
 */
export async function collegeCodeById(
  context: EdgeContext,
  collegeId: string | null | undefined,
): Promise<string | null> {
  if (!collegeId) return null;
  const { data } = await context.supabaseAdmin
    .from(TABLES.colleges)
    .select("code")
    .eq("id", collegeId)
    .maybeSingle();
  return data?.code ?? null;
}

export async function collegeCodeOfUser(
  context: EdgeContext,
  userId: string,
): Promise<string | null> {
  const { data } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .select("college_id")
    .eq("id", userId)
    .maybeSingle();
  return collegeCodeById(context, data?.college_id);
}
