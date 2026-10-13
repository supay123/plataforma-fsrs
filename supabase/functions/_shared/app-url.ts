// Sitios del frontend a los que pueden apuntar los links de los correos. Se
// usa el origen de la petición solo si está en esta lista; si no, producción.
// Al cambiar de dominio, agrégalo aquí (no hace falta variable de entorno).
export const APP_ORIGINS = [
  "https://aula-repaso.netlify.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

export function appOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  return APP_ORIGINS.find((allowed) => allowed === origin) ?? APP_ORIGINS[0];
}
