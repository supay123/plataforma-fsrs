import clsx from "clsx";
import type { ReactNode } from "react";
import type { MascotEvent, MascotGaze } from "../../components/ui/use-mascot-animation";
import { PracticeMascot, type MascotMood } from "../sessions/PracticeMascot";

export type MascotAdviceTone = "neutral" | "warning" | "success";

const BUBBLE_TONE: Record<MascotAdviceTone, string> = {
  neutral: "border-line bg-blocks text-on-blocks",
  warning: "border-warning bg-warning-soft text-warning-text",
  success: "border-success bg-success-soft text-success-text",
};

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
  className?: string;
}

/** La mascota con un globo de texto: cabeza a la izquierda y mensaje a la derecha, también en móvil. */
export function MascotAdvice({ children, mood, event, eventKey, gaze, tone = "neutral", actions, size = 64, className }: MascotAdviceProps) {
  return <div className={clsx("flex items-end gap-3", className)}>
    <PracticeMascot mood={mood} event={event} eventKey={eventKey} gaze={gaze} size={size} className="mb-1" />
    <div role="status" className={clsx("relative min-w-0 flex-1 rounded-2xl rounded-bl-md border-2 px-4 py-3 text-sm", BUBBLE_TONE[tone])}>
      <div className="min-w-0 wrap-break-word">{children}</div>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </div>;
}
