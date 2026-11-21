import { useEffect, useState } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

/** `true` cuando pasó `timeoutMs` sin que el usuario toque nada; cualquier toque o tecla lo apaga. */
export function useInactivity(timeoutMs: number, enabled = true): boolean {
  const [inactive, setInactive] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer = window.setTimeout(() => setInactive(true), timeoutMs);
    const wake = (): void => {
      setInactive(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setInactive(true), timeoutMs);
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, wake));
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, wake));
      setInactive(false);
    };
  }, [timeoutMs, enabled]);
  return enabled && inactive;
}
