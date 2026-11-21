/** Pantalla de espera: solo el fondo base de la institución (o el de por defecto), sin contenido que cambie al cargar. */
export function BaseBackground() {
  return <div role="status" aria-busy="true" aria-label="Cargando" className="min-h-dvh bg-base" />;
}
