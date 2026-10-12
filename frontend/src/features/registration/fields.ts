import { z } from "zod";
import { EMAIL_PATTERN, NAME_PATTERN, PASSWORD_MAX_LENGTH, isValidIdentityDocument, isValidPassword, isValidPhone } from "./rules";
import type { DocumentType } from "../complaints/model";

// Campos de los formularios del estudiante (registro, perfil y nueva
// contraseña). Siguen las mismas reglas que el backend.
const name = (required: string) => z.string().trim().min(1, required).max(100, "Máximo 100 caracteres.")
  .regex(NAME_PATTERN, "Usa solo letras, espacios, apóstrofos o guiones.");

export const studentFields = {
  given_names: name("Ingresa tus nombres."),
  family_names: name("Ingresa tus apellidos."),
  email: z.string().trim().max(254, "Máximo 254 caracteres.").regex(EMAIL_PATTERN, "Ingresa un correo válido."),
  phone: z.string().trim().refine(isValidPhone, "Ingresa un celular válido de 9 dígitos, por ejemplo 987654321."),
  identity_document_type: z.enum(["DNI", "CE", "PASAPORTE", "RUC"]),
  identity_document_number: z.string().trim().min(1, "Ingresa tu número de documento."),
  college_id: z.string().min(1, "Selecciona tu institución."),
};

export const passwordFields = {
  password: z.string().max(PASSWORD_MAX_LENGTH, `Máximo ${PASSWORD_MAX_LENGTH} caracteres.`).refine(isValidPassword, "La contraseña no cumple los requisitos."),
  password_confirmation: z.string().min(1, "Repite tu contraseña."),
};

/** Las validaciones entre campos corren aunque otros campos aún tengan errores. */
export const hasIssueOn = (fields: string[]) => ({ issues }: { issues: Array<{ path?: PropertyKey[] }> }) =>
  !issues.some((issue) => fields.includes(String(issue.path?.[0])));

export const documentIsValid = (values: { identity_document_type: DocumentType; identity_document_number: string }) =>
  isValidIdentityDocument(values.identity_document_type, values.identity_document_number);
export const documentIssue = {
  path: ["identity_document_number"], message: "El número de documento no es válido.",
  when: hasIssueOn(["identity_document_type", "identity_document_number"]),
};

export const passwordsMatch = (values: { password: string; password_confirmation: string }) =>
  values.password === values.password_confirmation;
export const passwordMismatchIssue = {
  path: ["password_confirmation"], message: "Las contraseñas no coinciden.", when: hasIssueOn(["password_confirmation"]),
};

/** Mensajes en español para los campos que el backend rechaza con validation_error. */
export const SERVER_FIELD_MESSAGES: Record<string, string> = {
  identity_document_number: "El número de documento no es válido.",
  phone: "Ingresa un celular válido de 9 dígitos.",
  email: "Ingresa un correo válido.",
};
