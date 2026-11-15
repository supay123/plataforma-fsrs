import type { MascotEvent } from "../../components/ui/use-mascot-animation";

export interface DashboardAdviceInput {
  courseCount: number;
  lastCompletedAt: string | null;
  /** `null` si no se pudo saber cuántas preguntas toca repasar. */
  dueReviews: number | null;
  now: Date;
}

export interface Advice {
  text: string;
  event: MascotEvent;
}

const DAY_MS = 86_400_000;
const DAYS_BEFORE_SLEEPING = 3;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Mensaje de la mascota en el inicio del estudiante, según lo que ya practicó. */
export function dashboardAdvice({ courseCount, lastCompletedAt, dueReviews, now }: DashboardAdviceInput): Advice {
  if (courseCount === 0) return { event: "sleep", text: "Todavía no tienes cursos activos. Cuando tu institución te asigne uno, lo verás aquí." };
  if (!lastCompletedAt) return { event: "rest", text: "¡Hola! Elige un curso y haz tu primera práctica. Yo te acompaño." };
  if (dueReviews !== null && dueReviews > 0) {
    const questions = dueReviews === 1 ? "1 pregunta lista" : `${dueReviews} preguntas listas`;
    return { event: "rest", text: `Tienes ${questions} para repasar. Es el mejor momento para no olvidarlas.` };
  }
  const daysAway = Math.round((startOfDay(now) - startOfDay(new Date(lastCompletedAt))) / DAY_MS);
  if (daysAway === 0) return { event: "correct", text: "¡Ya practicaste hoy! Volver mañana mantiene tu ritmo." };
  if (daysAway >= DAYS_BEFORE_SLEEPING) return { event: "sleep", text: `Hace ${daysAway} días que no practicas. Una práctica corta y retomas el ritmo.` };
  return { event: "rest", text: "Sigue con tu próximo tema. Un poco cada día rinde más que mucho de golpe." };
}
