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
  invalid_credentials: "Los datos de acceso o la contraseña son incorrectos.",
  recovery_unavailable: "Esta cuenta todavía no tiene configurada la recuperación de contraseña.",
  invalid_recovery_answer: "La respuesta de seguridad es incorrecta.",
  recovery_locked: "Se alcanzó el límite de intentos. Inténtalo nuevamente en 15 minutos.",
  credential_reset_failed: "No se pudo restablecer la credencial.",
  security_update_failed: "No se pudo guardar la pregunta de seguridad.",
  validation_error: "Revisa los datos ingresados.",
  weak_password: "La contraseña no cumple los requisitos.",
  email_taken: "Este correo ya tiene una cuenta. Inicia sesión o usa otro correo.",
  registration_conflict: "Ya hay un registro en curso con este correo. Inténtalo de nuevo en unos segundos.",
  invalid_college: "Selecciona una institución de la lista.",
  invalid_teacher: "Selecciona un grupo de la lista.",
  email_not_found: "No encontramos una cuenta con ese correo. Revisa que esté bien escrito.",
  account_inactive: "Tu cuenta está desactivada. Comunícate con nosotros para reactivarla.",
  email_unavailable: "No pudimos enviar el correo. Inténtalo más tarde.",
  invalid_email_code: "El código es incorrecto.",
  email_code_expired: "El código venció. Pide uno nuevo.",
  email_code_locked: "Demasiados intentos incorrectos. Pide un código nuevo.",
  email_code_resend_too_soon: "Espera un momento antes de pedir otro código.",
  too_many_email_codes: "Ya enviamos varios códigos. Vuelve a llenar el formulario para empezar de nuevo.",
  registration_expired: "Tu registro venció. Vuelve a llenar el formulario.",
  email_already_verified: "Tu correo ya está verificado.",
  email_not_verified: "Primero verifica tu correo.",
  payments_unavailable: "El pago en línea todavía no está disponible.",
  payment_provider_unavailable: "No pudimos conectar con el servicio de pagos. Inténtalo de nuevo.",
  payment_provider_error: "Mercado Pago no pudo procesar el pago. Revisa tu celular y el código de Yape, e inténtalo de nuevo.",
  payment_not_found: "No encontramos ese pago. Inténtalo de nuevo.",
  payment_in_process: "Tu pago anterior todavía se está procesando. Espera unos minutos antes de volver a pagar.",
  payment_email_required: "Agrega un correo a tu perfil para poder pagar.",
  email_required: "Agrega un correo a tu perfil para restablecer tu contraseña.",
  student_email_required: "El estudiante no tiene un correo registrado para enviarle el link.",
  profile_update_failed: "No se pudieron guardar tus datos.",
  email_unchanged: "Ese ya es el correo de tu cuenta.",
  email_change_not_found: "No hay un cambio de correo pendiente. Pide un código nuevo.",
  email_change_failed: "No se pudo cambiar el correo.",
  group_change_failed: "No se pudo cambiar el grupo. Inténtalo de nuevo.",
  user_not_found: "No se encontró el usuario solicitado.",
  too_many_email_change_codes: "Ya enviamos varios códigos. Inténtalo de nuevo mañana.",
  password_reset_resend_too_soon: "Espera un momento antes de pedir otro link.",
  password_reset_failed: "No se pudo restablecer la contraseña. Inténtalo de nuevo.",
  invalid_reset_code: "El link no es válido, ya se usó o venció.",
  invalid_invitation: "La invitación no es válida, ya se usó o venció.",
  invitation_not_found: "La invitación ya no existe. Recarga la página.",
  invitation_access_ended: "El periodo de acceso de esta invitación ya terminó. Anúlala e invita de nuevo.",
  invitation_failed: "No se pudo procesar la invitación. Inténtalo de nuevo.",
  complaint_daily_limit: "Ya enviaste 2 hojas de reclamación hoy desde esta conexión.",
  complaint_not_sent: "No pudimos enviar tu hoja de reclamación. Inténtalo de nuevo en unos minutos.",
  complaint_number_failed: "No pudimos registrar tu hoja de reclamación. Inténtalo de nuevo en unos minutos.",
  attachments_too_large: "Los archivos adjuntos superan el tamaño permitido. Quita alguno e inténtalo de nuevo.",
  ranking_disabled: "El ranking no está activado en tu institución.",
  ranking_category_disabled: "Esta categoría del ranking no está disponible.",
  ranking_cache_not_found: "El ranking venció. Actualízalo para verlo de nuevo.",
  invalid_evidence: "Solo se aceptan imágenes o archivos PDF como evidencia.",
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

/**
 * Mensajes en español para reglas de la base de datos que llegan crudas desde
 * PostgREST (índices únicos y triggers). Se busca por el nombre de la
 * restricción o por el texto del trigger.
 */
const databaseMessages: Array<{ match: string; message: string }> = [
  { match: "courses_teacher_name_unique_active_ci", message: "Este profesor ya tiene un curso con ese nombre. Usa otro nombre o cambia el nombre del curso existente." },
  { match: "at most 8 non-archived courses", message: "Un profesor puede tener como máximo 8 cursos. Archiva alguno o elige otro profesor." },
  { match: "teacher and course must belong to the same college", message: "El profesor y el curso deben ser del mismo colegio." },
  { match: "at most 25 non-archived topics", message: "Un curso puede tener como máximo 25 temas." },
  { match: "at most 50 non-archived questions", message: "Un tema puede tener como máximo 50 preguntas." },
];

/** Convierte un error de PostgREST en un `AppError` con texto en español; si no lo reconoce, lo devuelve igual. */
export function translateDatabaseError(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("message" in error)) return error;
  const text = String(error.message);
  const known = databaseMessages.find(({ match }) => text.includes(match));
  return known ? new AppError("database_rule", known.message, error) : error;
}
