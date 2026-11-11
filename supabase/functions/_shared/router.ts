import { AppError } from "./errors.ts";
import type { EdgeContext } from "./types.ts";

export type RouteHandler = (
  request: Request,
  context: EdgeContext,
) => Promise<Response>;

/**
 * Ruta dentro de la función. Supabase dirige /functions/v1/<función>/<ruta> a
 * la función <función>, así que se toma lo que viene después de su nombre:
 * "/functions/v1/registration/request-code" → "/request-code".
 */
export function functionSubpath(
  request: Request,
  functionName: string,
): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const index = segments.indexOf(functionName);
  return `/${index < 0 ? "" : segments.slice(index + 1).join("/")}`;
}

/**
 * Ejecuta el endpoint registrado como "MÉTODO /ruta". Responde 404 si la ruta
 * no existe y 405 si existe con otro método.
 */
export function routeRequest(
  request: Request,
  context: EdgeContext,
  functionName: string,
  routes: Record<string, RouteHandler>,
): Promise<Response> {
  const path = functionSubpath(request, functionName);
  const handler = routes[`${request.method} ${path}`];
  if (handler) return handler(request, context);
  if (Object.keys(routes).some((route) => route.endsWith(` ${path}`))) {
    throw new AppError(405, "method_not_allowed", "Method not allowed.");
  }
  throw new AppError(404, "not_found", "Endpoint not found.");
}
