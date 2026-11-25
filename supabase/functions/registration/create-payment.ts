import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import {
  createPlanPayment,
  deviceSessionId,
  paymentResponse,
  yapePayer,
  yapePhone,
  yapeToken,
} from "../_shared/plan-payments.ts";
import { planId } from "../_shared/plans.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import type { CreatePaymentBody } from "./interfaces.ts";

/**
 * POST /registration/payment
 * Cobra con Yape el plan elegido para un registro con el correo verificado.
 * El monto sale del plan, nunca del navegador. Si el pago se aprueba, la
 * cuenta se activa en el acto.
 */
export async function createPayment(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<CreatePaymentBody>(request);
  const registrationId = uuid(body.registration_id, "registration_id");
  const plan = planId(body.plan);
  const token = yapeToken(body.token);
  const phone = yapePhone(body.phone);
  const payer = yapePayer(body.payer);

  const { data: registration, error } = await context.supabaseAdmin
    .from(TABLES.studentRegistrations)
    .select("id,email,email_verified_at,expires_at")
    .eq("id", registrationId)
    .maybeSingle();
  if (error) {
    throw new AppError(500, "registration_lookup_failed", error.message);
  }
  if (!registration || new Date(registration.expires_at) <= new Date()) {
    throw new AppError(
      404,
      "registration_expired",
      "The registration expired. Start again.",
    );
  }
  if (!registration.email_verified_at) {
    throw new AppError(
      409,
      "email_not_verified",
      "Verify the email before paying.",
    );
  }

  const payment = await createPlanPayment(context.supabaseAdmin, {
    owner: { column: "registration_id", id: registrationId },
    plan,
    email: registration.email,
    token,
    phone,
    payer,
    deviceSessionId: deviceSessionId(body.device_session_id),
  });
  return json(paymentResponse(payment), 201);
}
