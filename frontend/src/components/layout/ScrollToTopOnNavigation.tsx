import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Al retroceder (POP) se deja al navegador restaurar la posición; con un hash, la página destino decide.
export function ScrollToTopOnNavigation() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP" || hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navigationType]);

  return null;
}
