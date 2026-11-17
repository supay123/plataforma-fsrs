import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { isDemoCollegeCode } from "../_shared/free-mode.ts";
import { uuid } from "../_shared/validation.ts";
import type { DeleteCollegeBody } from "./interfaces.ts";

const PAGE_SIZE = 500;

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const admin = await requireProfile(context, ["admin"]);
        const body = await readJson<DeleteCollegeBody>(request);
        const collegeId = uuid(body.college_id, "college_id");

        const { data: college, error: collegeError } = await context
          .supabaseAdmin
          .from(TABLES.colleges)
          .select("id,code,name")
          .eq("id", collegeId)
          .maybeSingle();
        if (collegeError) {
          throw new AppError(
            400,
            "college_lookup_failed",
            collegeError.message,
          );
        }
        if (!college) {
          throw new AppError(404, "college_not_found", "College not found.");
        }

        // Antes de borrar usuarios: la base también lo impide, pero para entonces
        // ya se habrían eliminado sus cuentas.
        if (isDemoCollegeCode(college.code)) {
          throw new AppError(
            409,
            "demo_college_protected",
            "The demo college feeds the free mode and cannot be deleted.",
          );
        }

        const userIds: string[] = [];
        for (let offset = 0;; offset += PAGE_SIZE) {
          const { data, error } = await context.supabaseAdmin
            .from(TABLES.profiles)
            .select("id")
            .eq("college_id", collegeId)
            .order("id")
            .range(offset, offset + PAGE_SIZE - 1);
          if (error) {
            throw new AppError(
              400,
              "college_users_lookup_failed",
              error.message,
            );
          }
          userIds.push(...data.map((profile) => profile.id));
          if (data.length < PAGE_SIZE) break;
        }

        for (const userId of userIds) {
          const { error } = await context.supabaseAdmin.auth.admin.deleteUser(
            userId,
            false,
          );
          if (error) {
            throw new AppError(
              400,
              "college_user_delete_failed",
              `Unable to delete user ${userId}: ${error.message}`,
            );
          }
        }

        const { error: deleteError } = await context.supabaseAdmin
          .from(TABLES.colleges)
          .delete()
          .eq("id", collegeId);
        if (deleteError) {
          throw new AppError(400, "college_delete_failed", deleteError.message);
        }

        await writeAudit(
          context,
          admin,
          "college.deleted",
          "college",
          collegeId,
          {
            code: college.code,
            name: college.name,
            deleted_users: userIds.length,
          },
        );
        return json({ college_id: collegeId, deleted_users: userIds.length });
      }),
  ),
};
