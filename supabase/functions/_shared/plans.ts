// Planes de pago. El monto que se cobra sale de aquí, nunca del navegador.
// Deben coincidir con PLANS en frontend/src/config/business.ts.
//
// Los planes no se renuevan solos: cada pago cubre sus meses y, para seguir,
// el estudiante vuelve a pagar. Las fechas de acceso son días completos en hora
// de Lima (YYYY-MM-DD) y ambos extremos son inclusivos.

import { AppError } from "./errors.ts";

export const PLANS = {
  mensual: { name: "Plan Estudiante", months: 1, amount: "14.90" },
  semestral: { name: "Plan Semestral", months: 6, amount: "77.40" },
} as const;

export type PlanId = keyof typeof PLANS;

export function planId(value: unknown, field = "plan"): PlanId {
  if (typeof value !== "string" || !Object.hasOwn(PLANS, value)) {
    throw new AppError(
      400,
      "validation_error",
      `${field} must be one of: ${Object.keys(PLANS).join(", ")}.`,
      { field },
    );
  }
  return value as PlanId;
}

export interface PlanPeriod {
  /** Primer día pagado. */
  period_start: string;
  /** Último día pagado; el acceso termina ese día. */
  period_end: string;
  /** Día en que empezaría el siguiente periodo si el estudiante renueva. */
  next_period_start: string;
}

function parse(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const result = parse(date);
  result.setUTCDate(result.getUTCDate() + days);
  return format(result);
}

/**
 * Suma meses conservando el día original (anchorDay). Si el mes no tiene ese
 * día, usa el último: 31/01 → 28/02 → 31/03.
 */
export function addMonths(
  date: string,
  months: number,
  anchorDay = parse(date).getUTCDate(),
): string {
  const start = parse(date);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return format(new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay))));
}

/** Periodo que paga el plan si empieza en periodStart. */
export function planPeriod(
  periodStart: string,
  plan: PlanId,
  anchorDay?: number,
): PlanPeriod {
  const nextPeriodStart = addMonths(
    periodStart,
    PLANS[plan].months,
    anchorDay,
  );
  return {
    period_start: periodStart,
    period_end: addDays(nextPeriodStart, -1),
    next_period_start: nextPeriodStart,
  };
}
