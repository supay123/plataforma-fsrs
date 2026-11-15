import type { MascotEvent } from "../../components/ui/use-mascot-animation";
import type { MascotAdviceTone } from "./MascotAdvice";

export interface ReviewAdvice {
  text: string;
  event: MascotEvent;
  tone: MascotAdviceTone;
}

const EXCELLENT_RATIO = 0.8;
const GOOD_RATIO = 0.5;

/** Mensaje de la mascota al revisar una práctica; siempre alentador, también con notas bajas. */
export function reviewAdvice(correctCount: number, incorrectCount: number): ReviewAdvice {
  const total = correctCount + incorrectCount;
  const ratio = total === 0 ? 0 : correctCount / total;
  if (ratio >= EXCELLENT_RATIO) return { event: "finish", tone: "success", text: `¡Excelente! Acertaste ${correctCount} de ${total}. Mira las pocas que fallaron para no repetirlas.` };
  if (ratio >= GOOD_RATIO) return { event: "correct", tone: "neutral", text: `Buen avance: ${correctCount} de ${total}. Revisa las explicaciones de las que fallaste y la próxima será mejor.` };
  return { event: "wrong", tone: "neutral", text: "No pasa nada: cada error te enseña algo. Lee las explicaciones de abajo y vuelve a intentarlo." };
}
