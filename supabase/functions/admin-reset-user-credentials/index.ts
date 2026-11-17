import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { assertCredential, generateCredential } from "../_shared/password.ts";
import { optionalString, requiredString, uuid } from "../_shared/validation.ts";
import type { ResetUserCredentialsBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const admin = await requireProfile(context, ["admin"]);
        const body = await readJson<ResetUserCredentialsBody>(request);
        const userId = uuid(body.user_id, "user_id");
        const newCode = optionalString(body.user_code, "user_code", 100);
        const { data: current, error: currentError } = await context
          .supabaseAdmin
          .from(TABLES.profiles)
          .select("id,user_code,role")
          .eq("id", userId)
          .in("role", ["teacher", "student"])
          .maybeSingle();
        if (currentError || !current || current.role === "admin") {
          throw new AppError(404, "user_not_found", "User not found.");
        }
        const generatedPassword = body.password === undefined;
        const password = generatedPassword
          ? generateCredential(current.role)
          : requiredString(body.password, "password", 200);
        try {
          assertCredential(current.role, password);
        } catch (error) {
          throw new AppError(
            400,
            "weak_password",
            error instanceof Error ? error.message : "Weak password.",
          );
        }

        if (newCode) {
          const { error } = await context.supabaseAdmin
            .from(TABLES.profiles)
            .update({ user_code: newCode })
            .eq("id", userId);
          if (error) {
            throw new AppError(400, "code_update_failed", error.message);
          }
        }

        const { error: authError } = await context.supabaseAdmin.auth.admin
          .updateUserById(userId, { password });
        if (authError) {
          if (newCode) {
            await context.supabaseAdmin
              .from(TABLES.profiles)
              .update({ user_code: current.user_code })
              .eq("id", userId);
          }
          throw new AppError(400, "credential_reset_failed", authError.message);
        }

        await writeAudit(
          context,
          admin,
          "user.credentials_reset",
          "profile",
          userId,
          { code_changed: Boolean(newCode) },
        );
        return json({
          user_id: userId,
          credentials: {
            user_code: newCode ?? current.user_code,
            ...(generatedPassword ? { temporary_password: password } : {}),
          },
        });
      }),
  ),
};
