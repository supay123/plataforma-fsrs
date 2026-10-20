import { RPCS } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";

/**
 * GET /public/teachers
 * Grupos (profesores) que puede elegir quien se registra: solo id y nombre de
 * los profesores activos que tienen al menos un curso vigente.
 */
export async function listTeachers(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const { data, error } = await context.supabaseAdmin.rpc(
    RPCS.registrationTeachers,
  );
  if (error) {
    throw new AppError(500, "teachers_lookup_failed", error.message);
  }
  return json({
    teachers: (data ?? []).map((teacher) => ({
      id: teacher.teacher_id,
      name: teacher.teacher_name,
    })),
  });
}
