import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { parseStudentProfile } from "../_shared/registration.ts";
import type { EdgeContext } from "../_shared/types.ts";
import type { UpdateProfileBody } from "./interfaces.ts";
import { loadStudentProfile } from "../_shared/student-profile.ts";

/**
 * PUT /account/profile
 * Reemplaza los datos editables del perfil: nombres, apellidos, celular y
 * documento. El correo se cambia con /account/email-change y la institución
 * solo la cambia el administrador.
 */
export async function updateProfile(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(context, ["student"]);
  const body = await readJson<UpdateProfileBody>(request);
  const input = parseStudentProfile(body as Record<string, unknown>);

  // El trigger de profiles vuelve a componer full_name con nombres y apellidos.
  const { error } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .update(input)
    .eq("id", profile.id);
  if (error) throw new AppError(500, "profile_update_failed", error.message);

  await writeAudit(
    context,
    profile,
    "user.profile_updated",
    "profile",
    profile.id,
    {
      fields: Object.keys(input),
    },
  );
  return json({ profile: await loadStudentProfile(context, profile.id) });
}
