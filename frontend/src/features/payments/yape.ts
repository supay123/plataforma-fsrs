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
  interface Window { MercadoPago?: MercadoPagoConstructor; MP_DEVICE_SESSION_ID?: string }
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


// Script de seguridad de Mercado Pago: identifica el dispositivo del comprador para el antifraude y deja el
// resultado en window.MP_DEVICE_SESSION_ID.
const SECURITY_SCRIPT_URL = "https://www.mercadopago.com/v2/security.js";
const DEVICE_ID_WAIT_MS = 3000;
const DEVICE_ID_POLL_MS = 100;

/** Carga el script de seguridad; llamarlo al mostrar el pago deja tiempo para que calcule el identificador. */
export function loadDeviceSessionScript() {
  if (document.querySelector(`script[src="${SECURITY_SCRIPT_URL}"]`)) return;
  const script = document.createElement("script");
  script.src = SECURITY_SCRIPT_URL;
  script.async = true;
  script.setAttribute("view", "checkout");
  document.head.appendChild(script);
}

/** Identificador del dispositivo, o null si el script no cargó (por ejemplo, con un bloqueador): el pago sigue sin él. */
export async function getDeviceSessionId(): Promise<string | null> {
  loadDeviceSessionScript();
  for (let waited = 0; waited < DEVICE_ID_WAIT_MS; waited += DEVICE_ID_POLL_MS) {
    if (window.MP_DEVICE_SESSION_ID) return window.MP_DEVICE_SESSION_ID;
    await new Promise((resolve) => setTimeout(resolve, DEVICE_ID_POLL_MS));
  }
  return null;
}
