import type { Profile } from "../types/contracts";
import { todayInLima } from "./dates";

/** Días antes del vencimiento en que el estudiante ve el aviso para renovar. */
export const RENEWAL_NOTICE_DAYS = 3;
/** Días después del vencimiento en que la cuenta aparece al administrador para borrarla. */
export const EXPIRED_REVIEW_DAYS = 7;

export type StudentAccess =
  | { state: "active"; daysLeft: number }
  | { state: "expired"; daysSinceExpiry: number }
  | { state: "not_started" };

/** Días entre dos fechas "AAAA-MM-DD" (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Situación del plan de un estudiante hoy en Lima. Con el plan vencido puede
 * entrar, pero solo para renovarlo; si su acceso aún no empieza, no entra.
 */
export function studentAccess(profile: Pick<Profile, "access_valid_from" | "access_valid_until">, today = todayInLima()): StudentAccess {
  const { access_valid_from: from, access_valid_until: until } = profile;
  if (until && until < today) return { state: "expired", daysSinceExpiry: daysBetween(until, today) };
  if (!from || !until || today < from) return { state: "not_started" };
  return { state: "active", daysLeft: daysBetween(today, until) };
}
