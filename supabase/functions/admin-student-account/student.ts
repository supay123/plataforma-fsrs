import { requireProfile } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError } from "../_shared/errors.ts";
import type { AppProfile, EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";

/**
 * Verifica que quien llama sea administrador y que userId sea un estudiante.
 * Devuelve el administrador (para la auditoría) y el id validado.
 */
export async function requireStudent(
  context: EdgeContext,
  userId: unknown,
): Promise<{ admin: AppProfile; studentId: string; fullName: string }> {
  const admin = await requireProfile(context, ["admin"]);
  const studentId = uuid(userId, "user_id");
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .select("id,full_name")
    .eq("id", studentId)
    .eq("role", "student")
    .maybeSingle();
  if (error) throw new AppError(500, "profile_lookup_failed", error.message);
  if (!data) throw new AppError(404, "user_not_found", "User not found.");
  return { admin, studentId, fullName: data.full_name };
}
