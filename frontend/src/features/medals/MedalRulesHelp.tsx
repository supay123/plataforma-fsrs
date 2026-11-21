import type { ReactNode } from "react";
import { useModal } from "../../components/ui/use-modal";

/** Texto de la regla de estrellas por tema, el mismo en la ayuda y en la configuración. */
export function MedalRulesBody() {
  return <ul className="grid list-disc gap-2 pl-5">
    <li>Cada tema da <strong>3 estrellas como máximo</strong>.</li>
    <li>Mientras no lo completes, solo sumas la diferencia con tu mejor marca del tema: si tenías 2 y sacas 3, ganas +1.</li>
    <li>Con un tema ya completado (3 estrellas), al volver a intentarlo <strong>solo ganas +1 estrella con un resultado de +3</strong>; con +1 o +2 no sumas.</li>
    <li>Una nota baja siempre te resta estrellas, pero nunca bajas de 0.</li>
  </ul>;
}

/** Icono "?" que abre un modal informativo; el título sirve de tooltip. Por defecto explica cómo se ganan las estrellas. */
export function MedalRulesHelp({ className, title = "¿Cómo se ganan las estrellas?", body }: { className?: string; title?: string; body?: ReactNode }) {
  const modal = useModal();
  return <button type="button" title={title} aria-label={title} className={`inline-grid h-7 w-7 place-items-center rounded-full text-fg-muted transition hover:text-fg ${className ?? ""}`}
    onClick={() => modal.info({ title, body: body ?? <MedalRulesBody /> })}>
    <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5" />
      <circle cx="12" cy="17.8" r="0.6" fill="currentColor" />
    </svg>
  </button>;
}
