import { invokeFunction } from "../../lib/api/functions";
import type { PlanId } from "../../config/business";
import type { PlanPaymentState, YapePayment } from "../payments/api";
import type { DocumentType } from "../complaints/model";

/** Grupo que elige el estudiante: un profesor, con su institución. */
export interface RegistrationTeacher {
  id: string;
  name: string;
  college_id: string;
  college_name: string;
}
export interface ValidateStudentBody {
  /** Profesor del grupo; la institución y los cursos salen de él. */
  teacher_id: string;
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

/** GET /public/teachers */
export async function listRegistrationTeachers() {
  const { teachers } = await invokeFunction<{ teachers: RegistrationTeacher[] }, Record<string, never>>("public/teachers", {}, { method: "GET" });
  return teachers;
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

/** POST /registration/payment: cobra con Yape el plan elegido; si se aprueba, activa la cuenta. */
export function createRegistrationPayment(registrationId: string, plan: PlanId, yape: YapePayment) {
  return invokeFunction<PlanPaymentState, { registration_id: string; plan: PlanId } & YapePayment>(
    "registration/payment",
    { registration_id: registrationId, plan, ...yape },
  );
}

/** GET /registration/payment?payment_id=...: estado del pago; al pagarse activa la cuenta. */
export function getRegistrationPaymentStatus(paymentId: string) {
  return invokeFunction<PlanPaymentState, Record<string, never>>(
    `registration/payment?payment_id=${encodeURIComponent(paymentId)}`, {}, { method: "GET" },
  );
}
