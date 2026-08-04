import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";

export class AppError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const translatedMessages: Record<string, string> = {
  invalid_credentials: "El código o la contraseña son incorrectos.",
  recovery_unavailable: "Esta cuenta todavía no tiene configurada la recuperación de contraseña.",
  invalid_recovery_answer: "La respuesta de seguridad es incorrecta.",
  recovery_locked: "Se alcanzó el límite de intentos. Inténtalo nuevamente en 15 minutos.",
  credential_reset_failed: "No se pudo restablecer la credencial.",
  security_update_failed: "No se pudo guardar la pregunta de seguridad.",
  validation_error: "Revisa los datos ingresados.",
};

export async function normalizeError(error: unknown): Promise<AppError> {
  if (error instanceof AppError) return error;
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      const code = body?.error?.code ?? "function_error";
      if (code === "unauthorized") {
        return new AppError("session_expired", "Tu sesión expiró. Vuelve a ingresar.");
      }
      return new AppError(code, translatedMessages[code] ?? body?.error?.message ?? error.message, body?.error?.details);
    } catch { return new AppError("function_error", error.message); }
  }
  if (error instanceof FunctionsRelayError) return new AppError("relay_error", "El servicio no está disponible.");
  if (error instanceof FunctionsFetchError) return new AppError("network_error", "No se pudo conectar con el servicio.");
  if (error && typeof error === "object" && "message" in error) return new AppError("request_error", String(error.message));
  return new AppError("unknown_error", "Ocurrió un error inesperado.");
}
