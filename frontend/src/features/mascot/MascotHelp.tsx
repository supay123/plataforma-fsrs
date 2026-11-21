import { CircleHelp, MessageCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BUSINESS } from "../../config/business";
import type { Advice } from "./advice";
import { MascotAdvice } from "./MascotAdvice";

const SEEN_KEY_PREFIX = "mascotHelpSeen:";

/** Ayuda abierta solo la primera vez que se entra a la pantalla; después queda a un clic. */
function firstVisit(screen: string): boolean {
  try {
    const key = `${SEEN_KEY_PREFIX}${screen}`;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

interface MascotHelpProps {
  /** Identifica la pantalla para recordar que ya vio su ayuda. */
  screen: string;
  advice: Advice;
  /** Pasos o consejos de la pantalla, en orden. */
  tips: string[];
  className?: string;
  children?: ReactNode;
}

/** La mascota consejera del profesor: un mensaje sobre lo que ve y, a un clic, la ayuda de la pantalla y el WhatsApp. */
export function MascotHelp({ screen, advice, tips, className, children }: MascotHelpProps) {
  const [open, setOpen] = useState(() => firstVisit(screen));
  return <MascotAdvice className={className} event={advice.event} tone={advice.tone}
    actions={<button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold underline-offset-4 hover:underline">
      <CircleHelp size={16} aria-hidden />{open ? "Ocultar ayuda" : "Ayuda de esta pantalla"}
    </button>}>
    <p>{advice.text}</p>
    {children}
    {open && <div className="mt-3 border-t-2 border-line pt-3">
      <ol className="grid list-decimal gap-1.5 pl-5">{tips.map((tip) => <li key={tip}>{tip}</li>)}</ol>
      <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
        <MessageCircle size={16} aria-hidden />¿Falta algo? Contáctanos por WhatsApp
      </a>
    </div>}
  </MascotAdvice>;
}
