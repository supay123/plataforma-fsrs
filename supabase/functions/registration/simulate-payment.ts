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
 * POST /registration/payment/simulate
 * Solo modo prueba: da por pagado el cobro del registro y activa la cuenta,
 * para probar el flujo sin dinero real.
 */
export async function simulateRegistrationPayment(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<SimulatePaymentBody>(request);
  const paymentId = uuid(body.payment_id, "payment_id");
  const payment = await findPayment(context.supabaseAdmin, paymentId);
  if (!payment?.registration_id) {
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
