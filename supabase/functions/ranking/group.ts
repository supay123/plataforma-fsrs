import { TABLES } from "../_shared/database.constants.ts";
import { AppError } from "../_shared/errors.ts";
import type { AppProfile, EdgeContext } from "../_shared/types.ts";

const PAGE_ROWS = 1000;
const IDS_PER_FILTER = 100;

function failure(error: { message: string }): AppError {
  return new AppError(500, "ranking_group_failed", error.message);
}

/** Lee todas las filas de una consulta paginando de a 1000 (límite de PostgREST). */
export async function fetchAllRows<Row>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0;; from += PAGE_ROWS) {
    const { data, error } = await buildQuery(from, from + PAGE_ROWS - 1);
    if (error) throw failure(error);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_ROWS) return rows;
  }
}

/** Evita URLs enormes: aplica la consulta a lotes de ids y junta los resultados. */
export async function queryByIds<Row>(
  ids: string[],
  runQuery: (batch: string[]) => Promise<Row[]>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let start = 0; start < ids.length; start += IDS_PER_FILTER) {
    rows.push(...await runQuery(ids.slice(start, start + IDS_PER_FILTER)));
  }
  return rows;
}

/**
 * Estudiantes del grupo del usuario: los matriculados (activos) en los cursos
 * de su profesor, de su misma institución. Un estudiante con varios profesores
 * compite con los alumnos de todos ellos; un profesor ve a sus alumnos.
 */
export async function loadGroupStudentIds(
  context: EdgeContext,
  user: AppProfile,
): Promise<string[]> {
  const collegeId = user.college_id;
  if (!collegeId) {
    throw new AppError(409, "college_required", "The user has no college.");
  }
  const admin = context.supabaseAdmin;

  let teacherIds: string[];
  if (user.role === "teacher") {
    teacherIds = [user.id];
  } else {
    const ownEnrollments = await fetchAllRows((from, to) =>
      admin.from(TABLES.courseEnrollments).select("course_id")
        .eq("student_id", user.id)
        .eq("status", "active")
        .range(from, to)
    );
    const ownCourses = await queryByIds(
      ownEnrollments.map((row) => row.course_id),
      async (batch) => {
        const { data, error } = await admin.from(TABLES.courses)
          .select("teacher_id").in("id", batch).eq("college_id", collegeId);
        if (error) throw failure(error);
        return data;
      },
    );
    teacherIds = [...new Set(ownCourses.map((row) => row.teacher_id))];
  }
  if (!teacherIds.length) return user.role === "student" ? [user.id] : [];

  const groupCourses = await queryByIds(teacherIds, async (batch) => {
    const { data, error } = await admin.from(TABLES.courses).select("id")
      .in("teacher_id", batch).eq("college_id", collegeId);
    if (error) throw failure(error);
    return data;
  });
  const groupEnrollments = await queryByIds(
    groupCourses.map((row) => row.id),
    (batch) =>
      fetchAllRows((from, to) =>
        admin.from(TABLES.courseEnrollments).select("student_id")
          .in("course_id", batch).eq("status", "active").range(from, to)
      ),
  );
  const enrolledIds = new Set(groupEnrollments.map((row) => row.student_id));
  if (user.role === "student") enrolledIds.add(user.id);
  return [...enrolledIds];
}
