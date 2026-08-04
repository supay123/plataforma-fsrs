import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { generateCredential } from "../_shared/password.ts";
import { verifySecurityAnswer } from "../_shared/security-answer.ts";
import { requiredString } from "../_shared/validation.ts";
import type { AppRole } from "../_shared/types.ts";
import type { RecoverPasswordBody } from "./interfaces.ts";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function role(value: unknown): AppRole {
  const parsed = requiredString(value, "expected_role", 20);
  if (parsed !== "admin" && parsed !== "teacher" && parsed !== "student") {
    throw new AppError(400, "validation_error", "Invalid role.");
  }
  return parsed;
}

export default {
  fetch: withAppSupabase(
    { auth: "publishable" },
    (request, context) =>
      handle(async () => {
        const body = await readJson<RecoverPasswordBody>(request);
        const action = requiredString(body.action, "action", 30);
        const code = requiredString(body.code, "code", 100);
        const expectedRole = role(body.expected_role);
        const { data: candidates, error: lookupError } = await context
          .supabaseAdmin
          .rpc(RPCS.findProfileByCode, { p_code: code });
        const candidate = candidates?.[0];
        if (lookupError || !candidate) {
          throw new AppError(
            404,
            "recovery_unavailable",
            "Recovery is not available for this account.",
          );
        }
        const { data: profile, error } = await context.supabaseAdmin.from(
          TABLES.profiles,
        )
          .select(
            "id,role,user_code,is_active,security_question,security_answer_hash,security_failed_attempts,security_locked_until",
          )
          .eq("id", candidate.id).maybeSingle();
        const unavailable = () =>
          new AppError(
            404,
            "recovery_unavailable",
            "Recovery is not available for this account.",
          );
        if (
          error || !profile || !profile.is_active ||
          profile.role !== expectedRole || !profile.security_question ||
          !profile.security_answer_hash
        ) throw unavailable();

        if (action === "get_question") {
          return json({ security_question: profile.security_question });
        }
        if (action !== "reset_password") {
          throw new AppError(400, "validation_error", "Unknown action.");
        }

        const now = new Date();
        if (
          profile.security_locked_until &&
          new Date(profile.security_locked_until) > now
        ) {
          throw new AppError(
            429,
            "recovery_locked",
            "Too many attempts. Try again later.",
          );
        }
        const answer = requiredString(body.answer, "answer", 200);
        if (!await verifySecurityAnswer(answer, profile.security_answer_hash)) {
          const attempts = profile.security_failed_attempts + 1;
          const lockedUntil = attempts >= MAX_ATTEMPTS
            ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString()
            : null;
          await context.supabaseAdmin.from(TABLES.profiles).update({
            security_failed_attempts: attempts >= MAX_ATTEMPTS ? 0 : attempts,
            security_locked_until: lockedUntil,
          }).eq("id", profile.id);
          throw new AppError(
            401,
            "invalid_recovery_answer",
            "The answer is incorrect.",
          );
        }

        const password = generateCredential(profile.role);
        const { error: authError } = await context.supabaseAdmin.auth.admin
          .updateUserById(profile.id, { password });
        if (authError) {
          throw new AppError(400, "credential_reset_failed", authError.message);
        }
        await context.supabaseAdmin.from(TABLES.profiles).update({
          security_failed_attempts: 0,
          security_locked_until: null,
        }).eq("id", profile.id);
        return json({
          credentials: {
            user_code: profile.user_code,
            temporary_password: password,
          },
        });
      }),
  ),
};
