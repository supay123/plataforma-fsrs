import { invokeFunction } from "../../lib/api/functions";
import type { DocumentType } from "../complaints/model";

export interface RegistrationCollege { id: string; name: string }
export interface ValidateStudentBody {
  college_id: string;
  given_names: string;
  family_names: string;
  email: string;
  phone: string;
  identity_document_type: DocumentType;
  identity_document_number: string;
  password: string;
  accepted_terms: boolean;
  /** Registro anterior del mismo navegador, cuando el usuario volvió a corregir sus datos. */
  replaces_registration_id?: string;
}
/** Registro pendiente creado; email llega enmascarado. */
export interface ValidatedRegistration { registration_id: string; email: string }
/** Datos del código enviado al correo; email llega enmascarado. */
export interface EmailCodeDelivery { email: string; code_expires_at: string; resend_available_at: string }
export interface VerifiedRegistration { status: "verified"; registration_id: string }

/** GET /public/colleges */
export async function listRegistrationColleges() {
  const { colleges } = await invokeFunction<{ colleges: RegistrationCollege[] }, Record<string, never>>("public/colleges", {}, { method: "GET" });
  return colleges;
}

/** POST /registration/student/validate: valida los datos y crea el registro pendiente. */
export function validateStudentRegistration(body: ValidateStudentBody) {
  return invokeFunction<ValidatedRegistration, ValidateStudentBody>("registration/student/validate", body);
}

/** POST /registration/request-code: envía o reenvía el código al correo. */
export function requestRegistrationCode(registrationId: string) {
  return invokeFunction<EmailCodeDelivery, { registration_id: string }>("registration/request-code", { registration_id: registrationId });
}

/** POST /registration/validateCode: verifica el código del correo. */
export function validateRegistrationCode(registrationId: string, code: string) {
  return invokeFunction<VerifiedRegistration, { registration_id: string; code: string }>(
    "registration/validateCode",
    { registration_id: registrationId, code },
  );
}
