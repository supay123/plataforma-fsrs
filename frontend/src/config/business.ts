// Datos públicos del comercio.
export const BUSINESS = {
  brand: "Chancón",
  tradeName: "Chancón - entrenador preuniversitario",
  legalName: "Miguel Ángel Llacta Pereira",
  ruc: "10774172578",
  address: "Av. Carlos Ugarte Mza. B Lote. 62 Coripata Sur, Santiago, Cusco, Cusco",
  phone: "+51 942 722 127",
  whatsapp: "51942722127",
  email: "pesupay@gmail.com",
  complaintsBookCode: "001",
  social: [] as Array<{ label: string; url: string }>,
};

// Los precios se cobran en soles a través de Kuti. Deben coincidir con PLANS en
// supabase/functions/_shared/plans.ts, que es el que fija el monto cobrado.
export type PlanId = "mensual" | "semestral";

export const PLAN = {
  id: "mensual" as PlanId,
  name: "Plan Estudiante",
  priceSoles: 14.90,
  months: 1,
  period: "mes",
  features: [
    "Todos los cursos de tu grupo",
    "Sesiones de 20 preguntas por tema",
    "Repaso espaciado de tus errores",
    "Explicación al instante de cada respuesta",
    "Progreso por curso y por tema",
  ],
};

// Mismo acceso que el plan mensual, pagado por adelantado cada 6 meses.
export const SEMESTER_PLAN = {
  id: "semestral" as PlanId,
  name: "Plan Semestral",
  priceSoles: 77.40,
  months: 6,
};

export const PLANS = [PLAN, SEMESTER_PLAN];
export type Plan = (typeof PLANS)[number];

/** Plan elegido en la URL (?plan=…); si no es válido, el mensual. */
export function findPlan(id: string | null): Plan {
  return PLANS.find((plan) => plan.id === id) ?? PLAN;
}

/** "S/ 14.90 por 1 mes" o "S/ 77.40 por 6 meses". */
export function planPriceLabel(plan: Plan) {
  return `${formatSoles(plan.priceSoles)} por ${plan.months} ${plan.months === 1 ? "mes" : "meses"}`;
}

// Días mínimos de aviso antes de un cambio de precio.
export const PRICE_CHANGE_NOTICE_DAYS = 10;

export function formatSoles(amount: number) {
  return `S/ ${amount.toFixed(2)}`;
}
