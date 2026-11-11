import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { assertDateOrder, boolean, date, uuid } from "../_shared/validation.ts";
import type { RenewAccessBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const admin = await requireProfile(context, ["admin"]);
        const body = await readJson<RenewAccessBody>(request);
        const userId = uuid(body.user_id, "user_id");
        const validFrom = date(body.access_valid_from, "access_valid_from");
        const validUntil = date(body.access_valid_until, "access_valid_until");
        assertDateOrder(validFrom, validUntil);
        const reactivate = body.reactivate === undefined
          ? true
          : boolean(body.reactivate, "reactivate");

        const { data, error } = await context.supabaseAdmin
          .from(TABLES.profiles)
          .update({
            access_valid_from: validFrom,
            access_valid_until: validUntil,
            ...(reactivate ? { is_active: true } : {}),
          })
          .eq("id", userId)
          .eq("role", "student")
          .select(
            "id,user_code,full_name,is_active,access_valid_from,access_valid_until",
          )
          .maybeSingle();
        if (error) {
          throw new AppError(400, "access_renewal_failed", error.message);
        }
        if (!data) {
          throw new AppError(404, "student_not_found", "Student not found.");
        }

        await writeAudit(
          context,
          admin,
          "student.access_renewed",
          "profile",
          userId,
          {
            access_valid_from: validFrom,
            access_valid_until: validUntil,
            reactivated: reactivate,
          },
        );
        return json({ student: data });
      }),
  ),
};
