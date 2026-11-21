import { useEffect, useState } from "react";
import { Button, ProgressBar } from "../../components/ui";
import { BUSINESS } from "../../config/business";
import { progressFor, slowNotice, STAGE_LABEL, type LoadStage } from "./loading-progress";

/** Barra por etapas reales + avisos según el tiempo transcurrido. Tras 1 min ofrece reintentar. */
export function LoadingProgress({ stage, stageSince, startedAt, done = false, onRetry }: { stage: LoadStage; stageSince: number; startedAt: number; done?: boolean; onRetry: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const notice = done ? "none" : slowNotice(now - startedAt);
  return <div className="grid w-full gap-2 text-center">
    <ProgressBar value={done ? 100 : progressFor(stage, now - stageSince)} label="Progreso de la carga" />
    <p className="text-xs text-fg-muted">{done ? "¡Listo!" : STAGE_LABEL[stage]}</p>
    {notice === "slow" && <p className="text-sm text-fg">Esto a veces puede tardar.</p>}
    {notice === "stuck" && <div className="grid justify-items-center gap-3">
      <p className="text-sm text-warning-text">
        Esto está tardando más de lo normal. <a className="underline underline-offset-4" href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer">Contáctanos</a> para corregirlo.
      </p>
      <Button variant="secondary" onClick={onRetry}>Reintentar</Button>
    </div>}
  </div>;
}
