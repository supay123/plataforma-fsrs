import { requireProfile } from "../_shared/auth.ts";
import { json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { loadStudentProfile } from "../_shared/student-profile.ts";

/**
 * GET /account/profile
 * Datos del perfil del estudiante. Los que aún no completó llegan en null (por
 * ejemplo, en cuentas creadas por el administrador).
 */
export async function getProfile(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const profile = await requireProfile(context, ["student"]);
  return json({ profile: await loadStudentProfile(context, profile.id) });
}
