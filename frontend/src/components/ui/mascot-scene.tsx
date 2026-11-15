import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Mesh, PMREMGenerator, type Material, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MASCOT_MODEL_URL, withMeshopt } from "./mascot-model";
import { useMascotAnimation, type MascotEvent, type MascotGaze } from "./use-mascot-animation";

/** Encuadre: `fit` = unidades del modelo que caben a lo ancho; `center` = altura del centro de la cabeza (0 = abajo, 1 = arriba). */
export interface MascotFraming {
  fit: number;
  center: number;
}

export interface MascotSceneProps {
  event?: MascotEvent;
  /** Súbelo para repetir el mismo evento. */
  eventKey?: number;
  /** Evento en bucle al que se vuelve tras uno de una sola vez. */
  rest?: MascotEvent;
  framing?: MascotFraming;
  gaze?: MascotGaze | null;
  onReady?: () => void;
  className?: string;
}

const DEFAULT_FRAMING: MascotFraming = { fit: 1.45, center: 0.5 };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Copia propia de la cabeza: así cada escena puede teñirla sin afectar a las demás. */
function cloneHead(source: Object3D): Object3D {
  const copy = source.clone(true);
  copy.traverse((object) => {
    object.frustumCulled = false;
    if (object instanceof Mesh && object.material instanceof Object) object.material = (object.material as Material).clone();
  });
  return copy;
}

/** Tiñe la piel y el acento con los colores del tema (`--c-primary`, `--c-secondary`) y se actualiza si cambian. */
function useThemeTint(head: Object3D): void {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const colored: Record<string, string> = { M_Skin: "--c-primary", M_Accent: "--c-secondary" };
    const apply = (): void => {
      const style = getComputedStyle(document.documentElement);
      head.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const material = object.material as Material & { color?: { set: (value: string) => void } };
        const variable = colored[material.name];
        const value = variable ? style.getPropertyValue(variable).trim() : "";
        if (value && material.color) material.color.set(value);
      });
      invalidate();
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
    return () => observer.disconnect();
  }, [head, invalidate]);
}

function Head({ event, eventKey, rest, reduced, gaze, onReady }: { event: MascotEvent; eventKey: number; rest: MascotEvent; reduced: boolean; gaze: MascotGaze | null; onReady?: () => void }) {
  const gltf = useLoader(GLTFLoader, MASCOT_MODEL_URL, withMeshopt);
  const head = useMemo(() => cloneHead(gltf.scene), [gltf.scene]);
  useEffect(() => () => {
    head.traverse((object) => { if (object instanceof Mesh) (object.material as Material).dispose(); });
  }, [head]);
  useThemeTint(head);
  useMascotAnimation(head, gltf.animations, { event, eventKey, rest, reduced, gaze });
  useEffect(() => { onReady?.(); }, [onReady]);
  return <primitive object={head} />;
}

/** Cámara ortográfica: la cabeza ocupa `fit` unidades de ancho y su centro queda a la altura `center`. */
function Rig({ fit, center }: MascotFraming) {
  const size = useThree((state) => state.size);
  const get = useThree((state) => state.get);
  useLayoutEffect(() => {
    const { camera, invalidate } = get();
    const zoom = size.width / fit;
    camera.zoom = zoom;
    camera.position.y = (size.height / zoom) * (0.5 - center);
    camera.updateProjectionMatrix();
    invalidate();
  }, [get, size.width, size.height, fit, center]);
  return null;
}

/** Luz de estudio neutra (el color lo ponen los materiales, que siguen el tema). */
function Lighting() {
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { gl, scene } = get();
    const generator = new PMREMGenerator(gl);
    const environment = generator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.55;
    generator.dispose();
    return () => { scene.environment = null; environment.dispose(); };
  }, [get]);
  return <directionalLight position={[2, 3, 4]} intensity={1.6} color="#ffffff" />;
}

/** Cabeza de la mascota en 3D (se carga aparte para no meter `three` en el paquete principal). */
export default function MascotScene({ event = "rest", eventKey = 0, rest = "rest", framing = DEFAULT_FRAMING, gaze = null, onReady, className }: MascotSceneProps) {
  const reduced = useState(prefersReducedMotion)[0];
  // El lienzo sobresale por arriba de la mascota: `pointer-events: none` explícito en el propio <Canvas>
  // (su contenedor puede volver a activarlos) para que nunca tape botones o pestañas que queden debajo.
  return <div aria-hidden className={className}>
    <Canvas
      style={{ pointerEvents: "none" }}
      orthographic
      camera={{ position: [0, 0, 10], near: 0.1, far: 50 }}
      dpr={[1, 2]}
      frameloop={reduced ? "demand" : "always"}
      gl={{ alpha: true, antialias: true }}
    >
      <Lighting />
      <Rig fit={framing.fit} center={framing.center} />
      <Suspense fallback={null}><Head event={event} eventKey={eventKey} rest={rest} reduced={reduced} gaze={gaze} onReady={onReady} /></Suspense>
    </Canvas>
  </div>;
}
