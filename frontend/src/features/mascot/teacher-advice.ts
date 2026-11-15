import type { Advice } from "./advice";

const DAY_MS = 86_400_000;
const INACTIVE_AFTER_DAYS = 7;
const WEAK_TOPIC_PERCENTAGE = 60;
const TREND_WINDOW = 3;
const TREND_THRESHOLD = 5;

export interface StudentActivityRow {
  student_id: string | null;
  last_completed_session_at: string | null;
}

/** Estudiantes sin práctica en la última semana (los que nunca practicaron también cuentan). */
export function teacherStudentsAdvice(rows: StudentActivityRow[], now: Date): Advice {
  const lastActivity = new Map<string, number>();
  for (const row of rows) {
    if (!row.student_id) continue;
    const time = row.last_completed_session_at ? new Date(row.last_completed_session_at).getTime() : 0;
    lastActivity.set(row.student_id, Math.max(lastActivity.get(row.student_id) ?? 0, time));
  }
  if (lastActivity.size === 0) return { event: "sleep", tone: "neutral", text: "Aún no tienes estudiantes asignados. Cuando el administrador te asigne alguno, aparecerá aquí." };
  const inactive = [...lastActivity.values()].filter((time) => now.getTime() - time > INACTIVE_AFTER_DAYS * DAY_MS).length;
  if (inactive === 0) return { event: "correct", tone: "success", text: "Todos tus estudiantes practicaron esta semana. ¡Buen trabajo!" };
  const who = inactive === 1 ? "1 estudiante lleva" : `${inactive} estudiantes llevan`;
  return { event: "rest", tone: "warning", text: `${who} más de una semana sin practicar (incluye a quienes aún no empiezan). Un mensaje tuyo suele ayudar.` };
}

export interface TopicResultRow {
  topic_name: string | null;
  correct_percentage: number | null;
}

/** `sessions` va de la más reciente a la más antigua. */
export function studentResultsAdvice(topics: TopicResultRow[], sessionPercentages: Array<number | null>): Advice {
  const percentages = sessionPercentages.filter((value): value is number => value !== null);
  if (percentages.length === 0) return { event: "sleep", tone: "neutral", text: "Este estudiante todavía no completa ninguna práctica." };
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  let trend = "";
  if (percentages.length >= TREND_WINDOW * 2) {
    const change = average(percentages.slice(0, TREND_WINDOW)) - average(percentages.slice(TREND_WINDOW, TREND_WINDOW * 2));
    if (change >= TREND_THRESHOLD) trend = " Viene mejorando en las últimas prácticas.";
    else if (change <= -TREND_THRESHOLD) trend = " Bajó en las últimas prácticas.";
  }
  const measured = topics.filter((topic) => topic.topic_name && topic.correct_percentage !== null);
  const weakest = measured.reduce<TopicResultRow | null>((worst, topic) => !worst || topic.correct_percentage! < worst.correct_percentage! ? topic : worst, null);
  if (weakest && weakest.correct_percentage! < WEAK_TOPIC_PERCENTAGE) {
    return { event: "rest", tone: "warning", text: `Su tema más débil es «${weakest.topic_name}» (${weakest.correct_percentage}% de acierto). Conviene reforzarlo.${trend}` };
  }
  return { event: "correct", tone: "success", text: `Ningún tema está por debajo del ${WEAK_TOPIC_PERCENTAGE}% de acierto.${trend}` };
}
