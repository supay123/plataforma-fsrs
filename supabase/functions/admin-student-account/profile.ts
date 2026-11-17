import { writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { parseStudentProfile } from "../_shared/registration.ts";
import { loadStudentProfile } from "../_shared/student-profile.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { loadGroupTeacherIds } from "./group.ts";
import type { UpdateStudentProfileBody } from "./interfaces.ts";
import { requireStudent } from "./student.ts";

/**
 * GET /admin-student-account/profile?user_id=...
 * Datos del perfil del estudiante, los mismos que ve él en su perfil, más los
 * profesores de su grupo actual (group_teacher_ids).
 */
export async function getStudentProfile(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const userId = new URL(request.url).searchParams.get("user_id");
  const { studentId } = await requireStudent(context, userId);
  const [profile, groupTeacherIds] = await Promise.all([
    loadStudentProfile(context, studentId),
    loadGroupTeacherIds(context, studentId),
  ]);
  return json({ profile: { ...profile, group_teacher_ids: groupTeacherIds } });
}

/**
 * PUT /admin-student-account/profile
 * Reemplaza los datos editables del perfil con las mismas reglas que usa el
 * estudiante. El correo no se cambia aquí: lo verifica el propio estudiante.
 */
export async function updateStudentProfile(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<UpdateStudentProfileBody>(request);
  const { admin, studentId } = await requireStudent(context, body.user_id);
  const input = parseStudentProfile(body as Record<string, unknown>);

  // El trigger de profiles vuelve a componer full_name con nombres y apellidos.
  const { error } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .update(input)
    .eq("id", studentId);
  if (error) throw new AppError(500, "profile_update_failed", error.message);

  await writeAudit(
    context,
    admin,
    "user.profile_updated",
    "profile",
    studentId,
    {
      fields: Object.keys(input),
    },
  );
  return json({ profile: await loadStudentProfile(context, studentId) });
}
