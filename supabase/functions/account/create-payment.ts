import { requireProfile } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import {
  createPlanPayment,
  paymentResponse,
  yapePhone,
  yapeToken,
} from "../_shared/plan-payments.ts";
import { planId } from "../_shared/plans.ts";
import type { EdgeContext } from "../_shared/types.ts";
import type { CreatePaymentBody } from "./interfaces.ts";

/**
 * POST /account/payment
 * Cobra con Yape la renovación del plan del estudiante, vigente o vencido. Al
 * aprobarse, los meses se suman al final del plan vigente o, si ya venció,
 * empiezan el día del pago.
 */
export async function createPayment(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"]);
  const body = await readJson<CreatePaymentBody>(request);
  const plan = planId(body.plan);
  const token = yapeToken(body.token);
  const phone = yapePhone(body.phone);

  const { data, error } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .select("email")
    .eq("id", student.id)
    .single();
  if (error) throw new AppError(500, "profile_lookup_failed", error.message);

  const payment = await createPlanPayment(context.supabaseAdmin, {
    owner: { column: "profile_id", id: student.id },
    plan,
    email: data.email,
    token,
    phone,
  });
  return json(paymentResponse(payment), 201);
}
