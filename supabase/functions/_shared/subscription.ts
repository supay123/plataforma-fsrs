// Fechas de la suscripción mensual. Las fechas de acceso son días completos en
// hora de Lima (YYYY-MM-DD) y ambos extremos son inclusivos.

/**
 * Días de acceso después de la fecha de cobro mientras la suscripción se
 * renueva sola, para no cortar el acceso antes de que Kuti cobre o reintente.
 */
export const RENEWAL_GRACE_DAYS = 3;

export interface SubscriptionPeriod {
  /** Primer día pagado. */
  period_start: string;
  /** Último día pagado. */
  period_end: string;
  /** Día en que se espera el siguiente cobro automático. */
  next_charge_date: string;
  access_valid_until: string;
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
 * Suma meses conservando el día de cobro original (anchorDay). Si el mes no
 * tiene ese día, usa el último: 31/01 → 28/02 → 31/03.
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

/**
 * Periodo mensual que empieza en periodStart. Si la suscripción se renueva
 * sola, el acceso dura hasta el cobro más los días de gracia; si fue
 * cancelada, termina el último día pagado.
 */
export function subscriptionPeriod(
  periodStart: string,
  options: { autoRenew: boolean; anchorDay?: number },
): SubscriptionPeriod {
  const nextCharge = addMonths(periodStart, 1, options.anchorDay);
  const periodEnd = addDays(nextCharge, -1);
  return {
    period_start: periodStart,
    period_end: periodEnd,
    next_charge_date: nextCharge,
    access_valid_until: options.autoRenew
      ? addDays(nextCharge, RENEWAL_GRACE_DAYS)
      : periodEnd,
  };
}
