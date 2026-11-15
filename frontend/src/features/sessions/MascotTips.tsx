import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Eyebrow } from "../../components/ui";
import { supportsWebGL } from "./mascot-support";
import { shuffleTips } from "./practice-tips";

const MascotScene = lazy(() => import("../../components/ui/mascot-scene"));
const TIP_INTERVAL_MS = 5000;

/** Cabeza 2D: se ve mientras carga el modelo 3D y si el dispositivo no soporta WebGL. */
function MascotFallback() {
  return <span aria-hidden className="block h-full w-full bg-no-repeat" style={{ backgroundImage: "url(/image/mascota-cabeza.png)", backgroundSize: "70%", backgroundPosition: "center" }} />;
}

/** Mascota que va dando consejos, sin repetir ninguno hasta haberlos mostrado todos. */
export function MascotTips() {
  const [queue, setQueue] = useState(() => shuffleTips());
  const [position, setPosition] = useState(0);
  // Cuántos consejos han cambiado: la mascota reacciona a cada cambio.
  const [tipChanges, setTipChanges] = useState(0);
  const [webgl] = useState(supportsWebGL);
  const [modelReady, setModelReady] = useState(false);
  const markReady = useCallback(() => setModelReady(true), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTipChanges((count) => count + 1);
      setPosition((current) => {
        if (current + 1 < queue.length) return current + 1;
        setQueue(shuffleTips(undefined, queue[queue.length - 1]));
        return 0;
      });
    }, TIP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [queue]);


  return <div className="grid justify-items-center gap-4">
    <div className="relative h-64 w-48 bg-[radial-gradient(ellipse_at_50%_80%,color-mix(in_srgb,var(--c-primary)_22%,transparent),transparent_65%)] sm:h-72 sm:w-56">
      {/* El canvas siempre tiene su tamaño completo (con tamaño 0 no carga el modelo); la cabeza 2D lo cubre hasta que esté listo. */}
      {webgl && <Suspense fallback={null}><MascotScene event={tipChanges > 0 ? "tip" : "loading"} eventKey={tipChanges} rest="loading" onReady={markReady} className="h-full w-full" /></Suspense>}
      {!modelReady && <div className="absolute inset-0"><MascotFallback /></div>}
    </div>
    <div key={`${queue.length}-${position}-${queue[position]}`} className="min-h-12 max-w-sm animate-tip rounded-2xl border-2 border-line bg-blocks px-4 py-3 text-left text-sm text-on-blocks">
      <Eyebrow className="mb-1">Consejo</Eyebrow>
      {queue[position]}
    </div>
  </div>;
}
