import { useEffect, useState } from "react";

/** Hora actual que se actualiza cada segundo (para cuentas regresivas). */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Segundos que faltan para una fecha ISO (0 si ya pasó). */
export function secondsUntil(isoDate: string, now: number) {
  return Math.max(0, Math.ceil((Date.parse(isoDate) - now) / 1000));
}
