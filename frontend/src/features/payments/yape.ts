import { AppError } from "../../lib/api/errors";

// SDK de Mercado Pago (https://www.mercadopago.com.pe/developers). Con la Public
// Key convierte el celular y el código de aprobación (OTP) de Yape en un token
// de un solo uso; el cobro lo crea el servidor con ese token.
const SDK_URL = "https://sdk.mercadopago.com/js/v2";

interface MercadoPagoInstance {
  yape(options: { otp: string; phoneNumber: string }): { create(): Promise<{ id: string }> };
}
type MercadoPagoConstructor = new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;

declare global {
  interface Window { MercadoPago?: MercadoPagoConstructor }
}

let sdk: Promise<MercadoPagoConstructor> | null = null;

function loadSdk(): Promise<MercadoPagoConstructor> {
  sdk ??= new Promise<MercadoPagoConstructor>((resolve, reject) => {
    if (window.MercadoPago) return resolve(window.MercadoPago);
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => window.MercadoPago ? resolve(window.MercadoPago) : reject(new Error("SDK sin MercadoPago"));
    script.onerror = () => reject(new Error("No se cargó el SDK"));
    document.head.appendChild(script);
  }).catch((reason: unknown) => {
    // Permite reintentar si falló la red.
    sdk = null;
    throw reason;
  });
  return sdk;
}

/** Token de Yape para pagar. El OTP lo muestra la app de Yape y dura poco. */
export async function createYapeToken(publicKey: string, phoneNumber: string, otp: string): Promise<string> {
  let MercadoPago: MercadoPagoConstructor;
  try { MercadoPago = await loadSdk(); }
  catch { throw new AppError("payment_sdk_unavailable", "No pudimos conectar con Mercado Pago. Revisa tu conexión e inténtalo de nuevo."); }
  try {
    const token = await new MercadoPago(publicKey, { locale: "es-PE" }).yape({ otp, phoneNumber }).create();
    if (!token?.id) throw new Error("Token vacío");
    return token.id;
  } catch {
    throw new AppError("yape_token_failed", "Yape no aceptó el celular o el código de aprobación. Genera un código nuevo en tu app e inténtalo otra vez.");
  }
}
