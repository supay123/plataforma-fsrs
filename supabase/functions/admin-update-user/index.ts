import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import type { TablesUpdate } from "../_shared/database.types.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { boolean, optionalString, uuid } from "../_shared/validation.ts";
import type { UpdateUserBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const admin = await requireProfile(context, ["admin"]);
        const body = await readJson<UpdateUserBody>(request);
        const userId = uuid(body.user_id, "user_id");
        const updates: TablesUpdate<"profiles"> = {};
        const userCode = optionalString(body.user_code, "user_code", 100);
        const fullName = optionalString(body.full_name, "full_name", 200);
        if (userCode !== undefined) updates.user_code = userCode;
        if (fullName !== undefined) updates.full_name = fullName;
        if (body.college_id !== undefined) {
          updates.college_id = uuid(body.college_id, "college_id");
        }
        if (body.is_active !== undefined) {
          updates.is_active = boolean(body.is_active, "is_active");
        }
        if (Object.keys(updates).length === 0) {
          throw new AppError(
            400,
            "validation_error",
            "No changes were provided.",
          );
        }

        const { data, error } = await context.supabaseAdmin
          .from(TABLES.profiles)
          .update(updates)
          .eq("id", userId)
          .in("role", ["teacher", "student"])
          .select(
            "id,college_id,role,user_code,full_name,is_active,access_valid_from,access_valid_until",
          )
          .maybeSingle();
        if (error) throw new AppError(400, "user_update_failed", error.message);
        if (!data) throw new AppError(404, "user_not_found", "User not found.");

        await writeAudit(context, admin, "user.updated", "profile", userId, {
          fields: Object.keys(updates),
        });
        return json({ user: data });
      }),
  ),
};
