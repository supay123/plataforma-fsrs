import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { generateCredential } from "../_shared/password.ts";
import { hashSecurityAnswer } from "../_shared/security-answer.ts";
import { requiredString } from "../_shared/validation.ts";
import type { AccountSecurityBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const profile = await requireProfile(context);
        const body = await readJson<AccountSecurityBody>(request);
        const action = requiredString(body.action, "action", 40);

        if (action === "save_recovery") {
          const question = requiredString(
            body.security_question,
            "security_question",
            200,
          );
          const answer = requiredString(
            body.security_answer,
            "security_answer",
            200,
          );
          if (question.length < 5 || answer.length < 2) {
            throw new AppError(
              400,
              "validation_error",
              "Question or answer is too short.",
            );
          }
          const answerHash = await hashSecurityAnswer(answer);
          const { error } = await context.supabaseAdmin.from(TABLES.profiles)
            .update({
              security_question: question,
              security_answer_hash: answerHash,
              security_failed_attempts: 0,
              security_locked_until: null,
            }).eq("id", profile.id);
          if (error) {
            throw new AppError(400, "security_update_failed", error.message);
          }
          await writeAudit(
            context,
            profile,
            "user.recovery_updated",
            "profile",
            profile.id,
          );
          return json({ security_question: question });
        }

        if (action === "reset_credentials") {
          const password = generateCredential(profile.role);
          const { error } = await context.supabaseAdmin.auth.admin
            .updateUserById(profile.id, { password });
          if (error) {
            throw new AppError(400, "credential_reset_failed", error.message);
          }
          await writeAudit(
            context,
            profile,
            "user.credentials_reset_self",
            "profile",
            profile.id,
          );
          return json({
            credentials: {
              user_code: profile.user_code,
              temporary_password: password,
            },
          });
        }

        throw new AppError(400, "validation_error", "Unknown action.");
      }),
  ),
};
