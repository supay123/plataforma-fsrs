import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import { AnimationMixer, LoopOnce, type AnimationAction, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MASCOT_MODEL_URL, withMeshopt } from "./mascot-model";

function Mascot({ greetKey, onReady }: { greetKey: number; onReady?: () => void }) {
  const gltf = useLoader(GLTFLoader, MASCOT_MODEL_URL, withMeshopt);
  const mixer = useMemo(() => new AnimationMixer(gltf.scene), [gltf.scene]);

  useEffect(() => {
    // Sin el teléfono se usan los clips normales (`idle`, `wave`).
    const phone = gltf.scene.getObjectByName("Phone");
    if (phone) phone.visible = false;
    gltf.scene.traverse((object: Object3D) => { object.frustumCulled = false; });
    onReady?.();
    return () => { mixer.stopAllAction(); };
  }, [gltf, mixer, onReady]);

  // Saluda cada vez que cambia el consejo y vuelve a reposo.
  useEffect(() => {
    const idle = gltf.animations.find((clip) => clip.name === "idle");
    const wave = gltf.animations.find((clip) => clip.name === "wave");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let current: AnimationAction | null = null;
    const play = (clip: typeof idle, once: boolean): AnimationAction | null => {
      if (!clip) return null;
      const action = mixer.clipAction(clip);
      action.reset();
      if (once) { action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; }
      if (current && current !== action) action.crossFadeFrom(current, 0.3, false);
      action.play();
      current = action;
      return action;
    };
    play(idle, false);
    let timer: number | undefined;
    if (wave && !reduceMotion && greetKey > 0) {
      play(wave, true);
      timer = window.setTimeout(() => play(idle, false), Math.max(0, wave.duration * 1000 - 300));
    }
    return () => window.clearTimeout(timer);
  }, [gltf, mixer, greetKey]);

  useFrame((_, delta) => mixer.update(delta));
  return <primitive object={gltf.scene} />;
}

/** Mascota en 3D (se carga aparte para no meter `three` en el paquete principal). */
export default function MascotScene({ greetKey = 0, onReady, className }: { greetKey?: number; onReady?: () => void; className?: string }) {
  return <div aria-hidden className={className}>
    <Canvas
      camera={{ position: [0, 1.4, 7.2], fov: 30 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      // El modelo mide 2,70 y tiene los pies en Y=0: se mira a su centro, no al origen.
      onCreated={({ camera }) => camera.lookAt(0, 1.35, 0)}
    >
      {/* Luz tenue y fría como el fondo del portal, con un contraluz jade y otro dorado suave. */}
      <hemisphereLight args={["#b8c9d9", "#0a1019", 0.9]} />
      <directionalLight position={[2, 4, 5]} intensity={1.1} color="#e6eef5" />
      <directionalLight position={[-4, 2.5, -3]} intensity={1.6} color="#3fb97c" />
      <directionalLight position={[4, 1.5, -3]} intensity={0.9} color="#c9a961" />
      <Suspense fallback={null}><Mascot greetKey={greetKey} onReady={onReady} /></Suspense>
    </Canvas>
  </div>;
}
