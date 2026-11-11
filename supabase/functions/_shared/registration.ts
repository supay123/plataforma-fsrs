import { AppError } from "./errors.ts";
import type { Database } from "./database.types.ts";

export type IdentityDocumentType =
  Database["public"]["Enums"]["identity_document_type"];

/** Datos del estudiante que también se editan desde su perfil. */
export interface StudentProfileInput {
  given_names: string;
  family_names: string;
  phone: string;
  identity_document_type: IdentityDocumentType;
  identity_document_number: string;
}

export interface StudentRegistrationInput extends StudentProfileInput {
  teacher_id: string;
  email: string;
  password: string;
}

export const USER_CODE_PATTERN = /^[A-Za-z0-9._-]{4,30}$/;
export const USER_CODE_MAX_LENGTH = 30;
// bcrypt solo usa los primeros 72 bytes de la contraseña.
export const PASSWORD_MAX_LENGTH = 72;
// Regla propia del registro (sin PIN); coincide con rules.ts del frontend.
export const PASSWORD_MIN_LENGTH = 6;

export function isValidRegistrationPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

const NAME_PATTERN = /^\p{L}[\p{L}\p{M}' .-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Por ahora solo celulares de Perú: 9 dígitos que empiezan con 9.
const PERU_MOBILE_PATTERN = /^9\d{8}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const IDENTITY_DOCUMENT_PATTERNS: Record<IdentityDocumentType, RegExp> =
  {
    DNI: /^\d{8}$/,
    CE: /^[A-Z0-9]{9,12}$/,
    PASAPORTE: /^[A-Z0-9]{6,12}$/,
    RUC: /^(10|15|17|20)\d{9}$/,
  };

function invalid(field: string, message: string): AppError {
  return new AppError(400, "validation_error", message, { field });
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalid(field, `${field} is required.`);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maxLength) {
    throw invalid(field, `${field} must not exceed ${maxLength} characters.`);
  }
  return normalized;
}

function name(value: unknown, field: string): string {
  const normalized = text(value, field, 100);
  if (!NAME_PATTERN.test(normalized)) {
    throw invalid(field, `${field} contains invalid characters.`);
  }
  return normalized;
}

export function identityDocumentType(value: unknown): IdentityDocumentType {
  if (
    typeof value !== "string" ||
    !Object.hasOwn(IDENTITY_DOCUMENT_PATTERNS, value)
  ) {
    throw invalid(
      "identity_document_type",
      "identity_document_type must be DNI, CE, PASAPORTE, or RUC.",
    );
  }
  return value as IdentityDocumentType;
}

export function identityDocumentNumber(
  type: IdentityDocumentType,
  value: unknown,
): string {
  const normalized = text(value, "identity_document_number", 20)
    .replace(/[\s-]/g, "")
    .toUpperCase();
  if (!IDENTITY_DOCUMENT_PATTERNS[type].test(normalized)) {
    throw invalid(
      "identity_document_number",
      "The identity document number is not valid.",
    );
  }
  return normalized;
}

export function normalizePhone(value: unknown): string {
  // Se acepta con o sin el código de país (+51) y se guarda sin él.
  const normalized = text(value, "phone", 30).replace(/[\s()-]/g, "")
    .replace(/^\+?51(?=\d{9}$)/, "");
  if (!PERU_MOBILE_PATTERN.test(normalized)) {
    throw invalid("phone", "The phone number is not valid.");
  }
  return normalized;
}

export function parseEmail(value: unknown, field = "email"): string {
  const email = text(value, field, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw invalid(field, "The email is not valid.");
  }
  return email;
}

/** Contraseña nueva del estudiante (registro y restablecimiento). */
export function parseNewPassword(value: unknown): string {
  if (typeof value !== "string") {
    throw invalid("password", "password is required.");
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    throw invalid(
      "password",
      `password must not exceed ${PASSWORD_MAX_LENGTH} characters.`,
    );
  }
  if (!isValidRegistrationPassword(value)) {
    throw new AppError(
      400,
      "weak_password",
      `Password must contain at least ${PASSWORD_MIN_LENGTH} characters, uppercase, lowercase, and a digit.`,
      { field: "password" },
    );
  }
  return value;
}

export function parseStudentProfile(
  body: Record<string, unknown>,
): StudentProfileInput {
  const documentType = identityDocumentType(body.identity_document_type);
  return {
    given_names: name(body.given_names, "given_names"),
    family_names: name(body.family_names, "family_names"),
    phone: normalizePhone(body.phone),
    identity_document_type: documentType,
    identity_document_number: identityDocumentNumber(
      documentType,
      body.identity_document_number,
    ),
  };
}

export function parseStudentRegistration(
  body: Record<string, unknown>,
): StudentRegistrationInput {
  if (
    typeof body.teacher_id !== "string" || !UUID_PATTERN.test(body.teacher_id)
  ) {
    throw invalid("teacher_id", "teacher_id must be a UUID.");
  }
  const profile = parseStudentProfile(body);
  const email = parseEmail(body.email);
  const password = parseNewPassword(body.password);
  if (body.accepted_terms !== true) {
    throw invalid(
      "accepted_terms",
      "The terms and privacy policy must be accepted.",
    );
  }
  return { ...profile, teacher_id: body.teacher_id, email, password };
}

/**
 * Base del código de usuario que se genera al activar la cuenta: la parte del
 * correo antes de la @, con solo los caracteres permitidos.
 */
export function userCodeBaseFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").normalize("NFD")
    .replace(/[^A-Za-z0-9._-]/g, "").toLowerCase();
  return (local.length >= 2 ? local : `est${local}`).slice(0, 24);
}

/**
 * Variantes numeradas de un código, en orden de preferencia. Se generan sin
 * leer la base: después se consulta de una vez cuáles están libres.
 */
export function userCodeCandidates(
  code: string,
  count = 10,
  random: () => number = Math.random,
): string[] {
  const base = code.replace(/[^A-Za-z0-9._-]/g, "");
  const candidates = new Set<string>();
  let guard = 0;
  while (candidates.size < count && guard++ < count * 20) {
    const digits = candidates.size < count / 2 ? 2 : 3;
    const suffix = String(Math.floor(random() * 10 ** digits)).padStart(
      digits,
      "0",
    );
    const separator = candidates.size % 3 === 2 ? "." : "";
    const head = base.slice(
      0,
      USER_CODE_MAX_LENGTH - separator.length - suffix.length,
    );
    const candidate = `${head}${separator}${suffix}`;
    if (USER_CODE_PATTERN.test(candidate)) candidates.add(candidate);
  }
  return [...candidates];
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
  return `${visible}${
    "*".repeat(Math.max(3, local.length - visible.length))
  }@${domain}`;
}
