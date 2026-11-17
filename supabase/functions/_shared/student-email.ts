import { RPCS, TABLES } from "./database.constants.ts";
import { AppError } from "./errors.ts";
import type { EdgeContext } from "./types.ts";

const emailTaken = () =>
  new AppError(409, "email_taken", "The email already has an account.", {
    field: "email",
  });

/**
 * Deja newEmail como correo del estudiante, también para iniciar sesión.
 * profiles.email (búsqueda del login) y auth.users.email deben coincidir: si
 * falla el segundo, se revierte el primero. Lanza 409 email_taken si otra
 * cuenta ya lo usa.
 */
export async function applyStudentEmail(
  context: EdgeContext,
  userId: string,
  newEmail: string,
): Promise<void> {
  const { data: inUse, error: inUseError } = await context.supabaseAdmin.rpc(
    RPCS.emailInUse,
    { p_email: newEmail, p_except_user_id: userId },
  );
  if (inUseError) {
    throw new AppError(500, "email_lookup_failed", inUseError.message);
  }
  if (inUse) throw emailTaken();

  const { data: previous, error: previousError } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .select("email")
    .eq("id", userId)
    .single();
  if (previousError) {
    throw new AppError(500, "email_change_failed", previousError.message);
  }
  const { error: profileError } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .update({ email: newEmail })
    .eq("id", userId);
  if (profileError) {
    if (profileError.code === "23505") throw emailTaken();
    throw new AppError(500, "email_change_failed", profileError.message);
  }
  const { error: authError } = await context.supabaseAdmin.auth.admin
    .updateUserById(userId, { email: newEmail, email_confirm: true });
  if (authError) {
    await context.supabaseAdmin
      .from(TABLES.profiles)
      .update({ email: previous.email })
      .eq("id", userId);
    if (authError.code === "email_exists") throw emailTaken();
    throw new AppError(500, "email_change_failed", authError.message);
  }
}
