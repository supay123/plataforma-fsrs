import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { uuid } from "../_shared/validation.ts";
import type { DeleteUserBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const admin = await requireProfile(context, ["admin"]);
        const body = await readJson<DeleteUserBody>(request);
        const userId = uuid(body.user_id, "user_id");

        const { data: target, error: targetError } = await context.supabaseAdmin
          .from(TABLES.profiles)
          .select("id,college_id,role,user_code,full_name")
          .eq("id", userId)
          .in("role", ["teacher", "student"])
          .maybeSingle();
        if (targetError) {
          throw new AppError(400, "user_lookup_failed", targetError.message);
        }
        if (!target) {
          throw new AppError(404, "user_not_found", "User not found.");
        }

        const { error: deleteError } = await context.supabaseAdmin.auth.admin
          .deleteUser(userId, false);
        if (deleteError) {
          throw new AppError(400, "user_delete_failed", deleteError.message);
        }

        await writeAudit(context, admin, "user.deleted", "profile", userId, {
          role: target.role,
          college_id: target.college_id,
          user_code: target.user_code,
          full_name: target.full_name,
        });
        return json({ user_id: userId });
      }),
  ),
};
