import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MascotEvent, MascotGaze } from "../../components/ui/use-mascot-animation";
import { PracticeMascot, type MascotMood } from "../sessions/PracticeMascot";

export type MascotAdviceTone = "neutral" | "warning" | "success";

const BUBBLE_TONE: Record<MascotAdviceTone, string> = {
  neutral: "border-line bg-blocks text-on-blocks",
  warning: "border-warning bg-warning-soft text-warning-text",
  success: "border-success bg-success-soft text-success-text",
};

// Separación de la cabeza al borde izquierdo de la tarjeta: debe ser mayor que la curva de la esquina (16px)
// para que el recorte redondeado no se coma la cabeza antes de que toque el borde inferior.
const PEEKING_LEFT_INSET = 20;

// Lo que "habla" la mascota cada vez que cambia el mensaje: proporcional al texto, con tope.
const SPEECH_MS_PER_CHARACTER = 35;
const SPEECH_MIN_MS = 700;
const SPEECH_MAX_MS = 3000;

interface MascotAdviceProps {
  children: ReactNode;
  mood?: MascotMood;
  event?: MascotEvent;
  /** Súbelo para repetir el mismo evento. */
  eventKey?: number;
  gaze?: MascotGaze | null;
  tone?: MascotAdviceTone;
  /** Botones o enlaces debajo del texto. */
  actions?: ReactNode;
  size?: number;
  /** Agranda la mascota para llamar la atención (por ejemplo, al elegir un tema). */
  emphasized?: boolean;
  /** Dentro de una tarjeta: la mascota asoma por la esquina inferior izquierda y el globo queda a su lado. El contenedor debe ser `relative overflow-hidden`. */
  peeking?: boolean;
  className?: string;
}

/** Mueve la boca de la mascota un rato cada vez que el texto del globo cambia. */
function useSpeakingWhileTextChanges(bubble: React.RefObject<HTMLDivElement | null>): boolean {
  const [speaking, setSpeaking] = useState(false);
  const lastText = useRef<string | null>(null);
  const stopTimer = useRef<number>(undefined);
  // Sin lista de dependencias a propósito: el texto cambia por dentro del globo y solo se ve leyendo el DOM; `lastText` evita el bucle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const text = bubble.current?.textContent ?? "";
    if (text === lastText.current) return;
    lastText.current = text;
    setSpeaking(true);
    window.clearTimeout(stopTimer.current);
    stopTimer.current = window.setTimeout(() => setSpeaking(false), Math.min(SPEECH_MAX_MS, Math.max(SPEECH_MIN_MS, text.length * SPEECH_MS_PER_CHARACTER)));
  });
  useEffect(() => () => window.clearTimeout(stopTimer.current), []);
  return speaking;
}

/** La mascota con un globo de diálogo del tamaño de su texto; la colita apunta a la boca y la mascota "habla" al cambiar el mensaje. */
export function MascotAdvice({ children, mood, event, eventKey, gaze, tone = "neutral", actions, size = 64, emphasized = false, peeking = false, className }: MascotAdviceProps) {
  const bubble = useRef<HTMLDivElement>(null);
  const speaking = useSpeakingWhileTextChanges(bubble);
  const mascot = <PracticeMascot mood={mood} event={event} eventKey={eventKey} gaze={gaze} speaking={speaking} size={size} />;
  return <div className={clsx("flex items-end", peeking ? "relative pr-4 sm:pr-5" : "gap-4", className)} style={peeking ? { paddingLeft: PEEKING_LEFT_INSET + size + 16 } : undefined}>
    {peeking
      ? <div className="absolute bottom-0" style={{ left: PEEKING_LEFT_INSET }}>{mascot}</div>
      : <div className={clsx("mb-1 shrink-0 origin-bottom transition-transform duration-300 ease-out", emphasized && "scale-125")}>{mascot}</div>}
    <div ref={bubble} role="status" className={clsx("relative min-w-0 max-w-full rounded-3xl border-2 px-5 py-3 text-sm", peeking && "mb-1 rounded-bl-md", BUBBLE_TONE[tone])}>
      <span aria-hidden className={clsx("absolute -left-[7px] size-3 rotate-45 border-b-2 border-l-2 bg-inherit", peeking ? "bottom-[3px]" : "bottom-4")} style={{ borderColor: "inherit" }} />
      <div className="min-w-0 wrap-break-word">{children}</div>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </div>;
}
