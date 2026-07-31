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

export async function normalizeError(error: unknown): Promise<AppError> {
  if (error instanceof AppError) return error;
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      return new AppError(body?.error?.code ?? "function_error", body?.error?.message ?? error.message, body?.error?.details);
    } catch { return new AppError("function_error", error.message); }
  }
  if (error instanceof FunctionsRelayError) return new AppError("relay_error", "El servicio no está disponible.");
  if (error instanceof FunctionsFetchError) return new AppError("network_error", "No se pudo conectar con el servicio.");
  if (error && typeof error === "object" && "message" in error) return new AppError("request_error", String(error.message));
  return new AppError("unknown_error", "Ocurrió un error inesperado.");
}
