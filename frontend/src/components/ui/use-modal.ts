import { createContext, useContext, type ReactNode } from "react";
import type { MascotEvent } from "./use-mascot-animation";

export type ModalVariant = "delete" | "create" | "warning" | "info";
/** Contenido del modal; como función recibe `close` para cerrarlo desde dentro. */
export type ModalBody = ReactNode | ((close: () => void) => ReactNode);
export interface ModalOptions {
  title: string;
  body: ModalBody;
  /**
   * Acción del botón principal. Mientras su promesa está pendiente los botones
   * se desactivan; si se resuelve, el modal se cierra y si falla, sigue abierto
   * (quien llama muestra el error, por ejemplo con un toast).
   */
  onConfirm: () => unknown;
  /** Texto del botón principal; por defecto "Eliminar", "Crear" o "Confirmar". */
  confirmLabel?: string;
  /** La mascota sobre el título (para avisar del impacto de la acción). */
  mascot?: MascotEvent;
}
/** Modal informativo: solo un botón para cerrarlo, sin acción que confirmar. */
export interface InfoModalOptions {
  title: string;
  body: ModalBody;
  /** Oculta el botón de cerrar cuando el propio contenido ya trae uno. */
  hideConfirm?: boolean;
  /** Texto del botón para cerrar; por defecto "Entendido". */
  confirmLabel?: string;
}
export interface ModalApi {
  delete: (options: ModalOptions) => void;
  create: (options: ModalOptions) => void;
  /** Advierte antes de una acción que afecta directamente a otra persona. */
  warning: (options: ModalOptions) => void;
  /** Muestra indicaciones o ayuda; se cierra con un solo botón. */
  info: (options: InfoModalOptions) => void;
}

export const ModalContext = createContext<ModalApi | null>(null);

/** Abre modales de eliminación, de creación, de advertencia o informativos; requiere ModalProvider en un nivel superior. */
export function useModal(): ModalApi {
  const api = useContext(ModalContext);
  if (!api) throw new Error("useModal debe usarse dentro de ModalProvider.");
  return api;
}
