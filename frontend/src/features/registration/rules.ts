import type { DocumentType } from "../complaints/model";

// Mismas reglas que valida POST /registration/student/validate.
export const NAME_PATTERN = /^\p{L}[\p{L}\p{M}' .-]*$/u;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Por ahora solo celulares de Perú: 9 dígitos que empiezan con 9 (con o sin +51).
const PERU_MOBILE_PATTERN = /^9\d{8}$/;
// bcrypt solo usa los primeros 72 bytes de la contraseña.
export const PASSWORD_MAX_LENGTH = 72;

const IDENTITY_DOCUMENT_PATTERNS: Record<DocumentType, RegExp> = {
  DNI: /^\d{8}$/,
  CE: /^[A-Z0-9]{9,12}$/,
  PASAPORTE: /^[A-Z0-9]{6,12}$/,
  RUC: /^(10|15|17|20)\d{9}$/,
};

export function normalizeIdentityDocument(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIdentityDocument(type: DocumentType, value: string) {
  return IDENTITY_DOCUMENT_PATTERNS[type].test(normalizeIdentityDocument(value));
}

export function isValidPhone(value: string) {
  return PERU_MOBILE_PATTERN.test(value.trim().replace(/[\s()-]/g, "").replace(/^\+?51(?=\d{9}$)/, ""));
}

export const PASSWORD_MIN_LENGTH = 6;

export interface PasswordChecks { length: boolean; lowercase: boolean; uppercase: boolean; digit: boolean }

export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
  };
}

/** Al menos 6 caracteres con una minúscula, una mayúscula y un número. */
export function isValidPassword(password: string) {
  if (password.length > PASSWORD_MAX_LENGTH) return false;
  return Object.values(passwordChecks(password)).every(Boolean);
}
