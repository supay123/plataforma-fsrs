import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile } from "../_shared/auth.ts";
import { TABLES, VIEWS } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { uuid } from "../_shared/validation.ts";
import type { GetSessionReviewBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const profile = await requireProfile(
          context,
          ["admin", "teacher", "student"],
          true,
        );
        const body = await readJson<GetSessionReviewBody>(request);
        const sessionId = uuid(body.session_id, "session_id");

        const { data: session, error: sessionError } = await context
          .supabaseAdmin
          .from(TABLES.assessmentSessions)
          .select("id,student_id,course_id,status,courses!inner(teacher_id)")
          .eq("id", sessionId)
          .maybeSingle();
        if (sessionError || !session) {
          throw new AppError(404, "session_not_found", "Session not found.");
        }
        if (session.status !== "completed") {
          throw new AppError(
            409,
            "session_not_completed",
            "Review is available only after session completion.",
          );
        }
        const course = Array.isArray(session.courses)
          ? session.courses[0]
          : session.courses;
        const authorized = profile.role === "admin" ||
          (profile.role === "student" && session.student_id === profile.id) ||
          (profile.role === "teacher" && course?.teacher_id === profile.id);
        if (!authorized) {
          throw new AppError(404, "session_not_found", "Session not found.");
        }

        const [{ data: summary, error: summaryError }, {
          data: questions,
          error: reviewError,
        }] = await Promise.all([
          context.supabaseAdmin
            .from(VIEWS.sessionResults)
            .select("*")
            .eq("session_id", sessionId)
            .single(),
          context.supabaseAdmin
            .from(VIEWS.completedSessionReview)
            .select("*")
            .eq("session_id", sessionId)
            .order("position"),
        ]);
        if (summaryError) {
          throw new AppError(
            500,
            "session_summary_failed",
            summaryError.message,
          );
        }
        if (reviewError) {
          throw new AppError(500, "session_review_failed", reviewError.message);
        }
        return json({ session: summary, questions: questions ?? [] });
      }),
  ),
};
