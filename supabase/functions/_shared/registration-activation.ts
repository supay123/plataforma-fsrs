import { RPCS, TABLES } from "./database.constants.ts";
import { AppError } from "./errors.ts";
import { userCodeBaseFromEmail, userCodeCandidates } from "./registration.ts";
import { planId, type PlanPeriod, planPeriod } from "./plans.ts";
import type { EdgeContext } from "./types.ts";
import { limaDate } from "./validation.ts";

const CODE_ATTEMPTS = 3;

export interface ActivatedStudent {
  user_id: string;
  user_code: string;
  access_valid_from: string;
  period: PlanPeriod;
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
 * Crea la cuenta y el perfil del registro que pagó. Se llama cuando Kuti
 * confirma el pago: el acceso empieza el día del pago y dura los meses del
 * plan pagado. El pago queda aplicado en la misma transacción que el perfil.
 */
export async function activateStudentRegistration(
  supabaseAdmin: EdgeContext["supabaseAdmin"],
  paymentId: string,
): Promise<ActivatedStudent> {
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from(TABLES.planPayments)
    .select("id,plan,paid_at,registration_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError) {
    throw new AppError(500, "payment_lookup_failed", paymentError.message);
  }
  if (!payment?.paid_at || !payment.registration_id) {
    throw new AppError(
      409,
      "payment_not_applicable",
      "The payment is not paid or has no pending registration.",
    );
  }

  const { data: registration, error } = await supabaseAdmin
    .from(TABLES.studentRegistrations)
    .select("id,email,password_hash,email_verified_at")
    .eq("id", payment.registration_id)
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

  const accessValidFrom = limaDate(new Date(payment.paid_at));
  const period = planPeriod(accessValidFrom, planId(payment.plan));
  let lastError: { message: string; code?: string } | null = null;
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const userCode = await freeUserCode(supabaseAdmin, registration.email);
    const { error: activationError } = await supabaseAdmin.rpc(
      RPCS.activateStudentRegistration,
      {
        p_payment_id: payment.id,
        p_user_id: created.user.id,
        p_user_code: userCode,
        p_access_valid_from: accessValidFrom,
        p_access_valid_until: period.period_end,
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
