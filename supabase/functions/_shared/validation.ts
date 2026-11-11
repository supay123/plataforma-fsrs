import { AppError } from "./errors.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function requiredString(
  value: unknown,
  field: string,
  maxLength = 500,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(400, "validation_error", `${field} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new AppError(
      400,
      "validation_error",
      `${field} must not exceed ${maxLength} characters.`,
    );
  }
  return normalized;
}

export function optionalString(
  value: unknown,
  field: string,
  maxLength = 500,
): string | undefined {
  return value === undefined
    ? undefined
    : requiredString(value, field, maxLength);
}

export function uuid(value: unknown, field: string): string {
  const normalized = requiredString(value, field, 36);
  if (!UUID_PATTERN.test(normalized)) {
    throw new AppError(400, "validation_error", `${field} must be a UUID.`);
  }
  return normalized;
}

/** UUID opcional: null, undefined y la cadena vacía cuentan como ausentes. */
export function optionalUuid(
  value: unknown,
  field: string,
): string | undefined {
  if (
    value === undefined || value === null ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return undefined;
  }
  return uuid(value, field);
}

export function date(value: unknown, field: string): string {
  const normalized = requiredString(value, field, 10);
  if (!DATE_PATTERN.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    throw new AppError(
      400,
      "validation_error",
      `${field} must use YYYY-MM-DD.`,
    );
  }
  return normalized;
}

export function optionalDate(
  value: unknown,
  field: string,
): string | undefined {
  return value === undefined ? undefined : date(value, field);
}

export function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new AppError(400, "validation_error", `${field} must be boolean.`);
  }
  return value;
}

export function option(value: unknown): "A" | "B" | "C" | "D" {
  const normalized = requiredString(value, "selected_option", 1).toUpperCase();
  if (!["A", "B", "C", "D"].includes(normalized)) {
    throw new AppError(
      400,
      "validation_error",
      "selected_option must be A, B, C, or D.",
    );
  }
  return normalized as "A" | "B" | "C" | "D";
}

export function nonNegativeInteger(
  value: unknown,
  field: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new AppError(
      400,
      "validation_error",
      `${field} must be a non-negative integer.`,
    );
  }
  return value as number;
}

export function assertDateOrder(from: string, until: string): void {
  if (from > until) {
    throw new AppError(
      400,
      "validation_error",
      "access_valid_from cannot be after access_valid_until.",
    );
  }
}

export function limaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isWithinDateRange(
  current: string,
  from: string | null,
  until: string | null,
): boolean {
  return from !== null && until !== null && current >= from && current <= until;
}
