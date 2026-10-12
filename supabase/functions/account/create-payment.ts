import { requireProfile } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { peruvianPhone } from "../_shared/kuti.ts";
import {
  createPlanPayment,
  paymentResponse,
  splitFullName,
} from "../_shared/plan-payments.ts";
import { planId } from "../_shared/plans.ts";
import type { EdgeContext } from "../_shared/types.ts";
import type { CreatePaymentBody } from "./interfaces.ts";

/**
 * POST /account/payment
 * Crea el cobro para renovar el plan del estudiante, vigente o vencido. Al
 * pagarse, los meses se suman al final del plan vigente o, si ya venció,
 * empiezan el día del pago.
 */
export async function createPayment(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"]);
  const body = await readJson<CreatePaymentBody>(request);
  const plan = planId(body.plan);

  const { data, error } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .select("full_name,given_names,family_names,email,phone")
    .eq("id", student.id)
    .single();
  if (error) throw new AppError(500, "profile_lookup_failed", error.message);

  const names = data.given_names && data.family_names
    ? { first_name: data.given_names, last_name: data.family_names }
    : splitFullName(data.full_name);
  const payment = await createPlanPayment(context.supabaseAdmin, {
    owner: { column: "profile_id", id: student.id },
    plan,
    email: data.email,
    customer: {
      ...names,
      email: data.email ?? undefined,
      phone: data.phone ? peruvianPhone(data.phone) : undefined,
    },
  });
  return json(paymentResponse(payment), 201);
}
