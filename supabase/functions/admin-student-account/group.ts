import { writeAudit } from "../_shared/auth.ts";
import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import type { UpdateStudentGroupBody } from "./interfaces.ts";
import { requireStudent } from "./student.ts";

/** Profesores de los cursos activos del estudiante: su grupo actual. */
export async function loadGroupTeacherIds(
  context: EdgeContext,
  studentId: string,
): Promise<string[]> {
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.courseEnrollments)
    .select("course:courses!inner(teacher_id)")
    .eq("student_id", studentId)
    .eq("status", "active");
  if (error) throw new AppError(500, "group_lookup_failed", error.message);
  return [...new Set(data.map((row) => row.course.teacher_id))];
}

/**
 * PUT /admin-student-account/group
 * Mueve al estudiante al grupo de otro profesor: deja los cursos de su grupo
 * anterior (su progreso en ellos se borra a los 7 días, salvo que vuelva),
 * queda inscrito en los cursos del nuevo profesor y su institución pasa a ser
 * la de él.
 */
export async function updateStudentGroup(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<UpdateStudentGroupBody>(request);
  const { admin, studentId } = await requireStudent(context, body.user_id);
  const teacherId = uuid(body.teacher_id, "teacher_id");

  const { data: collegeId, error } = await context.supabaseAdmin.rpc(
    RPCS.changeStudentGroup,
    { p_student_id: studentId, p_teacher_id: teacherId, p_actor_id: admin.id },
  );
  if (error) {
    if (error.message.includes("invalid_teacher")) {
      throw new AppError(
        400,
        "invalid_teacher",
        "Select an active teacher with courses.",
        { field: "teacher_id" },
      );
    }
    if (error.message.includes("user_not_found")) {
      throw new AppError(404, "user_not_found", "User not found.");
    }
    throw new AppError(500, "group_change_failed", error.message);
  }

  await writeAudit(context, admin, "user.group_changed", "profile", studentId, {
    teacher_id: teacherId,
    college_id: collegeId,
  });
  return json({ teacher_id: teacherId, college_id: collegeId });
}
