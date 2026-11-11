import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile } from "../_shared/auth.ts";
import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import {
  rowsFromWorkbook,
  validateQuestionRows,
} from "../_shared/questions.ts";
import { requiredString, uuid } from "../_shared/validation.ts";
import type { ImportQuestionsBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const profile = await requireProfile(context, ["admin", "teacher"]);
        const body = await readJson<ImportQuestionsBody>(request);
        const action = requiredString(body.action, "action", 20);
        if (action !== "validate" && action !== "confirm") {
          throw new AppError(
            400,
            "validation_error",
            "action must be validate or confirm.",
          );
        }
        const topicId = uuid(body.topic_id, "topic_id");
        const filename = requiredString(body.filename, "filename", 255);

        const { data: topic, error: topicError } = await context.supabaseAdmin
          .from(TABLES.topics)
          .select("id,courses!inner(id,teacher_id)")
          .eq("id", topicId)
          .maybeSingle();
        if (topicError || !topic) {
          throw new AppError(404, "topic_not_found", "Topic not found.");
        }
        const course = Array.isArray(topic.courses)
          ? topic.courses[0]
          : topic.courses;
        if (profile.role === "teacher" && course?.teacher_id !== profile.id) {
          throw new AppError(
            403,
            "forbidden",
            "The teacher does not own this topic.",
          );
        }

        let sourceRows: unknown[];
        if (Array.isArray(body.rows)) {
          sourceRows = body.rows;
        } else if (typeof body.file_base64 === "string") {
          sourceRows = await rowsFromWorkbook(body.file_base64);
        } else {
          throw new AppError(
            400,
            "validation_error",
            "Provide rows or an XLSX file_base64 value.",
          );
        }

        const { data: existing, error: questionError } = await context
          .supabaseAdmin
          .from(TABLES.questions)
          .select("statement")
          .eq("topic_id", topicId)
          .neq("status", "archived");
        if (questionError) {
          throw new AppError(
            500,
            "question_lookup_failed",
            questionError.message,
          );
        }

        const validation = validateQuestionRows(
          sourceRows,
          (existing ?? []).map((question) => question.statement),
          existing?.length ?? 0,
        );
        const report = {
          total: validation.total,
          accepted: validation.accepted.length,
          rejected: validation.rejected,
          duplicates: validation.duplicates,
          issues: validation.issues,
        };

        if (action === "validate") {
          return json({ report, accepted_rows: validation.accepted });
        }
        if (validation.accepted.length === 0) {
          throw new AppError(
            400,
            "no_valid_questions",
            "The import has no valid rows to confirm.",
            report,
          );
        }

        const { data: batchId, error: importError } = await context
          .supabaseAdmin
          .rpc(RPCS.importQuestions, {
            p_actor_id: profile.id,
            p_topic_id: topicId,
            p_filename: filename,
            p_rows: validation.accepted,
            p_total_rows: validation.total,
            p_report: validation.issues,
          });
        if (importError) {
          throw new AppError(
            400,
            "question_import_failed",
            importError.message,
          );
        }
        return json({ batch_id: batchId, report }, 201);
      }),
  ),
};
