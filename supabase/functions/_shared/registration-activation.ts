import { RPCS, TABLES } from "./database.constants.ts";
import { AppError } from "./errors.ts";
import { userCodeBaseFromEmail, userCodeCandidates } from "./registration.ts";
import { type SubscriptionPeriod, subscriptionPeriod } from "./subscription.ts";
import type { EdgeContext } from "./types.ts";
import { limaDate } from "./validation.ts";

const CODE_ATTEMPTS = 3;

export interface ActivatedStudent {
  user_id: string;
  user_code: string;
  access_valid_from: string;
  period: SubscriptionPeriod;
}

/**
 * Elige un código libre derivado del correo. Los estudiantes con correo inician
 * sesión con él; el código solo los identifica dentro de la aplicación.
 */
export async function freeUserCode(
  supabaseAdmin: EdgeContext["supabaseAdmin"],
  email: string,
): Promise<string> {
  const candidates = userCodeCandidates(userCodeBaseFromEmail(email), 10);
  const { data, error } = await supabaseAdmin.rpc(RPCS.takenUserCodes, {
    p_codes: candidates,
  });
  if (error) {
    throw new AppError(500, "user_code_lookup_failed", error.message);
  }
  const taken = new Set((data ?? []).map((code) => code.toLowerCase()));
  return candidates.find((code) => !taken.has(code.toLowerCase())) ??
    `est-${crypto.randomUUID().slice(0, 12)}`;
}

/**
 * Crea la cuenta y el perfil de un registro con el correo ya verificado. Se
 * llama cuando se confirma el primer pago: el acceso empieza ese mismo día.
 */
export async function activateStudentRegistration(
  supabaseAdmin: EdgeContext["supabaseAdmin"],
  registrationId: string,
  paidAt = new Date(),
): Promise<ActivatedStudent> {
  const { data: registration, error } = await supabaseAdmin
    .from(TABLES.studentRegistrations)
    .select("id,email,password_hash,email_verified_at")
    .eq("id", registrationId)
    .maybeSingle();
  if (error) {
    throw new AppError(500, "registration_lookup_failed", error.message);
  }
  if (!registration) {
    throw new AppError(
      404,
      "registration_not_found",
      "Registration not found.",
    );
  }
  if (!registration.email_verified_at) {
    throw new AppError(
      409,
      "email_not_verified",
      "The registration email is not verified.",
    );
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin
    .createUser({
      email: registration.email,
      password_hash: registration.password_hash,
      email_confirm: true,
      app_metadata: { role: "student" },
    });
  if (createError || !created.user) {
    throw new AppError(
      400,
      "auth_user_creation_failed",
      createError?.message ?? "Unable to create user.",
    );
  }

  const accessValidFrom = limaDate(paidAt);
  const period = subscriptionPeriod(accessValidFrom, { autoRenew: true });
  let lastError: { message: string; code?: string } | null = null;
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const userCode = await freeUserCode(supabaseAdmin, registration.email);
    const { error: activationError } = await supabaseAdmin.rpc(
      RPCS.activateStudentRegistration,
      {
        p_registration_id: registration.id,
        p_user_id: created.user.id,
        p_user_code: userCode,
        p_access_valid_from: accessValidFrom,
        p_access_valid_until: period.access_valid_until,
      },
    );
    if (!activationError) {
      return {
        user_id: created.user.id,
        user_code: userCode,
        access_valid_from: accessValidFrom,
        period,
      };
    }
    lastError = activationError;
    // Solo se reintenta si otra activación tomó el mismo código a la vez.
    if (activationError.code !== "23505") break;
  }

  await supabaseAdmin.auth.admin.deleteUser(created.user.id);
  throw new AppError(
    400,
    "registration_activation_failed",
    lastError?.message ?? "Unable to activate the registration.",
  );
}
