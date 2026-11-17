import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { toCsv } from "../_shared/csv.ts";
import { VIEWS } from "../_shared/database.constants.ts";
import { AppError, handle, readJson } from "../_shared/errors.ts";
import { uuid } from "../_shared/validation.ts";
import type { ExportDataBody } from "./interfaces.ts";

function optionalUuid(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : uuid(value, field);
}

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const profile = await requireProfile(context, ["admin", "teacher"]);
        const body = await readJson<ExportDataBody>(request);
        const filters = {
          college_id: optionalUuid(body.college_id, "college_id"),
          teacher_id: optionalUuid(body.teacher_id, "teacher_id"),
          course_id: optionalUuid(body.course_id, "course_id"),
          student_id: optionalUuid(body.student_id, "student_id"),
          topic_id: optionalUuid(body.topic_id, "topic_id"),
        };

        if (
          profile.role === "teacher" &&
          filters.teacher_id !== undefined &&
          filters.teacher_id !== profile.id
        ) {
          throw new AppError(
            403,
            "forbidden",
            "Teachers can export only their data.",
          );
        }

        const rows: Record<string, unknown>[] = [];
        const pageSize = 1000;
        for (let offset = 0;; offset += pageSize) {
          let query = context.supabaseAdmin
            .from(VIEWS.exportAllData)
            .select("*")
            .range(offset, offset + pageSize - 1)
            .order("started_at", { ascending: true })
            .order("position", { ascending: true });

          query = query.eq(
            "teacher_id",
            profile.role === "teacher" ? profile.id : filters.teacher_id ??
              profile.id,
          );
          if (profile.role === "admin" && filters.teacher_id === undefined) {
            query = context.supabaseAdmin
              .from(VIEWS.exportAllData)
              .select("*")
              .range(offset, offset + pageSize - 1)
              .order("started_at", { ascending: true })
              .order("position", { ascending: true });
          }
          if (filters.college_id) {
            query = query.eq("college_id", filters.college_id);
          }
          if (filters.course_id) {
            query = query.eq("course_id", filters.course_id);
          }
          if (filters.student_id) {
            query = query.eq("student_id", filters.student_id);
          }
          if (filters.topic_id) {
            query = query.eq("topic_id", filters.topic_id);
          }

          const { data, error } = await query;
          if (error) {
            throw new AppError(500, "export_failed", error.message);
          }
          rows.push(...((data ?? []) as Record<string, unknown>[]));
          if ((data?.length ?? 0) < pageSize) {
            break;
          }
        }

        await writeAudit(context, profile, "data.exported", "export", null, {
          filters,
          rows: rows.length,
        });
        const filename = `fsrs-export-${
          new Date().toISOString().slice(0, 10)
        }.csv`;
        return new Response(toCsv(rows), {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
          },
        });
      }),
  ),
};
