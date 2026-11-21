import { requireProfile } from "../_shared/auth.ts";
import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { sessionGrade, starsForGrade } from "../_shared/medals.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import type { CalculateMedalBody } from "./interfaces.ts";
import { loadMedalRules } from "./settings.ts";

/**
 * Aplica al estudiante las estrellas de una sesión de práctica terminada.
 * Recibe solo el id de la sesión: la nota sale de las respuestas guardadas,
 * nunca de lo que diga el navegador. Es idempotente: repetir la llamada
 * devuelve el mismo resultado sin sumar de nuevo.
 */
export async function calculateMedal(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"], true);
  const body = await readJson<CalculateMedalBody>(request);
  const sessionId = uuid(body.session_id, "session_id");
  if (!student.college_id) {
    throw new AppError(409, "college_required", "The student has no college.");
  }

  const { data: session, error: sessionError } = await context.supabaseAdmin
    .from(TABLES.assessmentSessions)
    .select("id,student_id,status,total_questions,correct_count")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError || !session || session.student_id !== student.id) {
    throw new AppError(404, "session_not_found", "Session not found.");
  }
  if (session.status !== "completed") {
    throw new AppError(
      409,
      "session_not_completed",
      "Only completed sessions can earn stars.",
    );
  }

  const { rules } = await loadMedalRules(context, student.college_id);
  if (!rules.enabled) return json({ enabled: false });

  const grade = sessionGrade(session.correct_count, session.total_questions);
  const { data: award, error } = await context.supabaseAdmin.rpc(
    RPCS.applySessionMedal,
    {
      p_student_id: student.id,
      p_session_id: sessionId,
      p_grade: grade,
      p_stars_for_grade: starsForGrade(grade, rules.grade_range_ends),
    },
  );
  if (error || !award) {
    throw new AppError(
      500,
      "medal_calculation_failed",
      error?.message ?? "Unable to calculate the medal.",
    );
  }
  return json(award);
}
