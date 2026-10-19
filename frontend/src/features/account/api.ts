import { invokeFunction } from "../../lib/api/functions";
import type { DocumentType } from "../complaints/model";

/** Perfil del estudiante. En cuentas creadas por el administrador, email llega null. */
export interface AccountProfile {
  given_names: string | null;
  family_names: string | null;
  email: string | null;
  phone: string | null;
  identity_document_type: DocumentType | null;
  identity_document_number: string | null;
  college_id: string | null;
  college_name: string | null;
  /** Grupo = nombre del profesor de sus cursos activos (varios, separados por coma). */
  group_name: string | null;
}
export interface UpdateAccountProfileBody {
  given_names: string;
  family_names: string;
  phone: string;
  identity_document_type: DocumentType;
  identity_document_number: string;
}
/** Código enviado al correo nuevo; email llega enmascarado. */
export interface EmailChangeDelivery { email: string; code_expires_at: string; resend_available_at: string }
/** Link de restablecimiento enviado; email llega enmascarado. */
export interface PasswordResetDelivery { email: string; expires_at: string; resend_available_at: string }

export const accountProfileQueryKey = ["account-profile"] as const;

/** GET /account/profile */
export async function getAccountProfile() {
  const { profile } = await invokeFunction<{ profile: AccountProfile }, Record<string, never>>("account/profile", {}, { method: "GET" });
  return profile;
}

/** PUT /account/profile: guarda los datos editables (el correo va aparte). */
export async function updateAccountProfile(body: UpdateAccountProfileBody) {
  const { profile } = await invokeFunction<{ profile: AccountProfile }, UpdateAccountProfileBody>("account/profile", body, { method: "PUT" });
  return profile;
}

/** POST /account/email-change: envía un código al correo nuevo. */
export function requestEmailChange(email: string) {
  return invokeFunction<EmailChangeDelivery, { email: string }>("account/email-change", { email });
}

/** POST /account/email-change/confirm: verifica el código y cambia el correo. */
export function confirmEmailChange(code: string) {
  return invokeFunction<{ email: string }, { code: string }>("account/email-change/confirm", { code });
}

/** POST /account/password-reset: envía el link para crear una nueva contraseña. */
export function requestPasswordReset() {
  return invokeFunction<PasswordResetDelivery, Record<string, never>>("account/password-reset", {});
}

/** DELETE /account/password-reset: anula el link enviado. */
export function cancelPasswordReset() {
  return invokeFunction<{ status: "cancelled" }, Record<string, never>>("account/password-reset", {}, { method: "DELETE" });
}

/** POST /password-reset/request-link: "¿Olvidaste tu contraseña?" del login; responde igual exista o no el correo. */
export function requestPasswordResetLink(email: string) {
  return invokeFunction<{ status: "requested" }, { email: string }>("password-reset/request-link", { email });
}

/** GET /password-reset?code=...: indica si el link sigue vigente. */
export function checkPasswordResetCode(code: string) {
  return invokeFunction<{ status: "valid"; expires_at: string }, Record<string, never>>(
    `password-reset?code=${encodeURIComponent(code)}`, {}, { method: "GET" },
  );
}

/** POST /password-reset: usa el link y guarda la nueva contraseña. */
export function resetPassword(code: string, password: string) {
  return invokeFunction<{ status: "password_updated" }, { code: string; password: string }>("password-reset", { code, password });
}
