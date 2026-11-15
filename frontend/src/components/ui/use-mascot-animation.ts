import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, MathUtils, Mesh, type AnimationAction, type Object3D } from "three";

/** Clips que trae `mascot_head.glb` (ver `public/models/mascot_head_notes.md`). */
export type MascotClip = "idle" | "think" | "correct" | "wrong" | "celebrate" | "levelUp" | "finish" | "sleep" | "appear" | "disappear";

/** Lo que pasa en la app; cada evento se traduce a un clip. */
export type MascotEvent = "rest" | "loading" | "correct" | "wrong" | "streak" | "levelUp" | "finish" | "sleep" | "appear" | "disappear" | "tip";

export interface ClipPlan {
  clip: MascotClip;
  /** `true`: se repite sin fin; `false`: suena una vez y vuelve al reposo. */
  loop: boolean;
}

const PLANS: Record<MascotEvent, ClipPlan> = {
  rest: { clip: "idle", loop: true },
  loading: { clip: "think", loop: true },
  sleep: { clip: "sleep", loop: true },
  correct: { clip: "correct", loop: false },
  wrong: { clip: "wrong", loop: false },
  streak: { clip: "celebrate", loop: false },
  levelUp: { clip: "levelUp", loop: false },
  finish: { clip: "finish", loop: false },
  // Cambio de consejo: el saltito alegre (el más suave de los que celebran).
  tip: { clip: "correct", loop: false },
  appear: { clip: "appear", loop: false },
  disappear: { clip: "disappear", loop: false },
};

/** Evento de la app → clip. Función pura, sin three. */
export function clipForEvent(event: MascotEvent): ClipPlan {
  return PLANS[event];
}

/** Hacia dónde mira: x de -1 (izquierda) a 1 (derecha), y de -1 (abajo) a 1 (arriba). */
export interface MascotGaze {
  x: number;
  y: number;
}

const GAZE_MORPHS = { left: "lookLeft", right: "lookRight", up: "lookUp", down: "lookDown" } as const;
const GAZE_SPEED = 12;

/** Suma la mirada a los morphs de la cara (lo que dejó el clip en este cuadro). */
function addGazeMorphs(face: Mesh, { x, y }: MascotGaze): void {
  const dictionary = face.morphTargetDictionary;
  const influences = face.morphTargetInfluences;
  if (!dictionary || !influences) return;
  const additions = [[GAZE_MORPHS.left, Math.max(0, -x)], [GAZE_MORPHS.right, Math.max(0, x)], [GAZE_MORPHS.up, Math.max(0, y)], [GAZE_MORPHS.down, Math.max(0, -y)]] as const;
  for (const [morph, amount] of additions) {
    const index = dictionary[morph];
    if (index !== undefined) influences[index] = MathUtils.clamp((influences[index] ?? 0) + amount, 0, 1);
  }
}

const FADE_IN_S = 0.15;
const FADE_BACK_S = 0.25;

interface Options {
  event: MascotEvent;
  /** Súbelo para repetir el mismo evento (por ejemplo, un consejo nuevo). */
  eventKey?: number;
  /** Evento en bucle al que se vuelve al terminar uno de una sola vez. */
  rest?: MascotEvent;
  /** Movimiento reducido: pose de reposo quieta, sin clips. */
  reduced?: boolean;
  /** Se suma a lo que haga el clip, porque el clip reescribe los morphs en cada cuadro. */
  gaze?: MascotGaze | null;
}

/**
 * Reproduce el clip de cada evento con *crossfade*, vuelve al reposo cuando termina uno de una
 * sola vez y entra con `appear`. Se usa dentro de `<Canvas>`.
 */
export function useMascotAnimation(root: Object3D, clips: AnimationClip[], { event, eventKey = 0, rest = "rest", reduced = false, gaze = null }: Options): void {
  const mixer = useMemo(() => new AnimationMixer(root), [root]);
  const current = useRef<AnimationAction | null>(null);
  const started = useRef(false);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    current.current = null;
    started.current = false;
  }, [mixer, root]);

  useEffect(() => {
    const play = (plan: ClipPlan, fade: number): void => {
      const clip = AnimationClip.findByName(clips, plan.clip);
      if (!clip) return;
      const action = mixer.clipAction(clip);
      action.reset();
      action.setLoop(plan.loop ? LoopRepeat : LoopOnce, plan.loop ? Infinity : 1);
      action.clampWhenFinished = !plan.loop;
      const previous = current.current;
      if (previous && previous !== action) action.crossFadeFrom(previous, fade, false);
      action.play();
      current.current = action;
    };

    const restPlan = clipForEvent(rest);
    if (reduced) {
      play(restPlan, 0);
      mixer.setTime(0);
      invalidate();
      return;
    }

    const plan = clipForEvent(event);
    // Al entrar en escena (solo la primera vez) y si lo pedido es un bucle: `appear` y luego el bucle.
    const intro = !started.current && plan.loop;
    started.current = true;
    let next: ClipPlan | null = plan.loop ? null : restPlan;
    if (intro) {
      next = plan;
      play(clipForEvent("appear"), 0);
    } else {
      play(plan, FADE_IN_S);
    }
    const onFinished = (finished: { action: AnimationAction }): void => {
      if (finished.action !== current.current || !next) return;
      const target = next;
      next = null;
      play(target, FADE_BACK_S);
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [mixer, clips, event, eventKey, rest, reduced, invalidate]);

  const faceMesh = useRef<Mesh | null>(null);
  useEffect(() => {
    const mesh = root.getObjectByName("Face");
    faceMesh.current = mesh instanceof Mesh ? mesh : null;
  }, [root]);
  const targetGaze = useRef<MascotGaze | null>(gaze);
  const currentGaze = useRef<MascotGaze>({ x: 0, y: 0 });
  useEffect(() => { targetGaze.current = gaze; }, [gaze]);

  const addGaze = useCallback((): void => {
    if (faceMesh.current) addGazeMorphs(faceMesh.current, currentGaze.current);
  }, []);

  useEffect(() => {
    if (!reduced) return;
    currentGaze.current = { ...(gaze ?? { x: 0, y: 0 }) };
    mixer.setTime(0);
    addGaze();
    invalidate();
  }, [reduced, gaze, mixer, addGaze, invalidate]);

  useFrame((_, delta) => {
    if (reduced) return;
    mixer.update(delta);
    const target = targetGaze.current ?? { x: 0, y: 0 };
    const blend = 1 - Math.exp(-delta * GAZE_SPEED);
    currentGaze.current.x += (target.x - currentGaze.current.x) * blend;
    currentGaze.current.y += (target.y - currentGaze.current.y) * blend;
    addGaze();
  });
}
