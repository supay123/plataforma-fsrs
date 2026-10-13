import { requireProfile } from "../_shared/auth.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import {
  findPayment,
  simulatedMethod,
  simulateTestPayment,
  statusResponse,
} from "../_shared/plan-payments.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import type { SimulatePaymentBody } from "./interfaces.ts";

/**
 * POST /account/payment/simulate
 * Solo modo prueba: da por pagada la renovación del propio estudiante y
 * extiende su plan, para probar el flujo sin dinero real.
 */
export async function simulateRenewalPayment(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"]);
  const body = await readJson<SimulatePaymentBody>(request);
  const paymentId = uuid(body.payment_id, "payment_id");
  const payment = await findPayment(context.supabaseAdmin, paymentId);
  if (!payment || payment.profile_id !== student.id) {
    throw new AppError(404, "payment_not_found", "Payment not found.");
  }
  return json(
    statusResponse(
      await simulateTestPayment(
        context.supabaseAdmin,
        payment,
        simulatedMethod(body.method),
      ),
    ),
  );
}
