import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { shuffleTips } from "./practice-tips";

const MascotScene = lazy(() => import("../../components/ui/mascot-scene"));
const TIP_INTERVAL_MS = 5000;

function supportsWebGL(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl"));
  } catch {
    return false;
  }
}

/** Cabeza 2D: se ve mientras carga el modelo 3D y si el dispositivo no soporta WebGL. */
function MascotFallback() {
  return <span aria-hidden className="block h-full w-full bg-no-repeat" style={{ backgroundImage: "url(/image/mascota-cabeza.png)", backgroundSize: "70%", backgroundPosition: "center" }} />;
}

/** Mascota que va dando consejos, sin repetir ninguno hasta haberlos mostrado todos. */
export function MascotTips() {
  const [queue, setQueue] = useState(() => shuffleTips());
  const [position, setPosition] = useState(0);
  const [webgl] = useState(supportsWebGL);
  const [modelReady, setModelReady] = useState(false);
  const markReady = useCallback(() => setModelReady(true), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPosition((current) => {
        if (current + 1 < queue.length) return current + 1;
        setQueue(shuffleTips(undefined, queue[queue.length - 1]));
        return 0;
      });
    }, TIP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [queue]);


  return <div className="grid justify-items-center gap-4">
    <div className="relative h-64 w-48 bg-[radial-gradient(ellipse_at_50%_80%,color-mix(in_srgb,var(--color-primary)_22%,transparent),transparent_65%)] sm:h-72 sm:w-56">
      {/* El canvas siempre tiene su tamaño completo (con tamaño 0 no carga el modelo); la cabeza 2D lo cubre hasta que esté listo. */}
      {webgl && <Suspense fallback={null}><MascotScene greetKey={position} onReady={markReady} className="h-full w-full" /></Suspense>}
      {!modelReady && <div className="absolute inset-0"><MascotFallback /></div>}
    </div>
    <p key={`${queue.length}-${position}-${queue[position]}`} className="min-h-12 max-w-sm animate-tip border border-line bg-surface-deep px-4 py-3 text-sm text-fg">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-ornament">Consejo</span>
      {queue[position]}
    </p>
  </div>;
}
