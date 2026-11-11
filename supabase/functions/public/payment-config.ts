import { json } from "../_shared/errors.ts";
import { publicKey } from "../_shared/mercadopago.ts";
import type { EdgeContext } from "../_shared/types.ts";

/**
 * GET /public/payment-config
 * Public Key de Mercado Pago, con la que el navegador convierte el celular y
 * el OTP de Yape en un token. Es pública; vive en el servidor para cambiar de
 * prueba a producción sin volver a publicar la web. Sin configurar responde
 * 503 payments_unavailable.
 */
export function paymentConfig(
  _request: Request,
  _context: EdgeContext,
): Promise<Response> {
  return Promise.resolve(json({ public_key: publicKey() }));
}
