/** ¿Hay WebGL? Sin él (o en las pruebas con jsdom) se ve la cabeza 2D. */
export function supportsWebGL(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl"));
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
