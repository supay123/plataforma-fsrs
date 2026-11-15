import clsx from "clsx";
import { lazy, Suspense, useCallback, useState } from "react";
import type { MascotEvent, MascotGaze } from "../../components/ui/use-mascot-animation";
import { prefersReducedMotion, supportsWebGL } from "./mascot-support";

const MascotScene = lazy(() => import("../../components/ui/mascot-scene"));

export type MascotMood = "idle" | "happy" | "sad" | "thinking";

const MOTION: Record<MascotMood, string> = {
  idle: "motion-safe:animate-mascot-bob",
  happy: "motion-safe:animate-mascot-happy",
  sad: "motion-safe:animate-mascot-sad saturate-75",
  thinking: "motion-safe:animate-mascot-think",
};

const MOOD_EVENT: Record<MascotMood, MascotEvent> = { idle: "rest", happy: "correct", sad: "wrong", thinking: "loading" };

// La cabeza ocupa 1,25 unidades de ancho; el lienzo es 3 veces más alto que ella para dejar sitio a los saltos.
const FRAMING = { fit: 1.25, center: 0.16 };

/**
 * Cabeza de la mascota que reacciona a lo que hace el estudiante (reposo, acierto, error y, con
 * `event`, rachas, subida de nivel o fin de práctica). Es una cabeza 3D animada; sin WebGL o con
 * movimiento reducido (y mientras baja el modelo) se ve la cabeza PNG con animaciones CSS.
 * El lienzo 3D sobresale por arriba sin estorbar (no recibe clics) para que los saltos se vean completos.
 */
export function PracticeMascot({ mood = "idle", event, eventKey, gaze, size = 56, className }: { mood?: MascotMood; event?: MascotEvent; eventKey?: number; gaze?: MascotGaze | null; size?: number; className?: string }) {
  const [use3d] = useState(() => supportsWebGL() && !prefersReducedMotion());
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  return <div className={clsx("shrink-0", className)} style={{ width: size, height: size }}><div className="relative h-full w-full">
    {use3d && <Suspense fallback={null}>
      <MascotScene event={event ?? MOOD_EVENT[mood]} eventKey={eventKey} framing={FRAMING} gaze={gaze} onReady={markReady} className="pointer-events-none absolute bottom-0 left-0 z-10 h-[300%] w-full" />
    </Suspense>}
    {!ready && <img key={mood} src="/image/mascota-cabeza.png" alt="" aria-hidden width={size} height={size}
      className={clsx("h-full w-full select-none drop-shadow-[0_6px_10px_rgb(0_0_0/0.25)]", MOTION[mood])} />}
  </div></div>;
}
