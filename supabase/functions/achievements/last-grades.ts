import { requireProfile } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import { sessionGrade } from "../_shared/medals.ts";
import type { EdgeContext } from "../_shared/types.ts";

/**
 * Nota (0 a 20) de la última sesión completada del modo normal. El promedio
 * general no se calcula aquí: sale del progreso por curso, igual que en "Mi
 * aprendizaje". `last_route_lesson` queda en null hasta que exista Modo Ruta.
 */
export async function getLastGrades(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"], true);
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.assessmentSessions)
    .select("id,completed_at,total_questions,correct_count,topics(name)")
    .eq("student_id", student.id)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError(500, "last_grades_failed", error.message);

  const topic = Array.isArray(data?.topics) ? data.topics[0] : data?.topics;
  return json({
    last_session: data
      ? {
        session_id: data.id,
        completed_at: data.completed_at,
        topic_name: topic?.name ?? null,
        grade: sessionGrade(data.correct_count, data.total_questions),
      }
      : null,
    last_route_lesson: null,
  });
}
