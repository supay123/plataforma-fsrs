import { createContext, useContext, type ReactNode } from "react";

export type ModalVariant = "delete" | "create";
export interface ModalOptions {
  title: string;
  body: ReactNode;
  /**
   * Acción del botón principal. Mientras su promesa está pendiente los botones
   * se desactivan; si se resuelve, el modal se cierra y si falla, sigue abierto
   * (quien llama muestra el error, por ejemplo con un toast).
   */
  onConfirm: () => unknown;
  /** Texto del botón principal; por defecto "Eliminar" o "Crear". */
  confirmLabel?: string;
}
export interface ModalApi {
  delete: (options: ModalOptions) => void;
  create: (options: ModalOptions) => void;
}

export const ModalContext = createContext<ModalApi | null>(null);

/** Abre modales de eliminación o de creación; requiere ModalProvider en un nivel superior. */
export function useModal(): ModalApi {
  const api = useContext(ModalContext);
  if (!api) throw new Error("useModal debe usarse dentro de ModalProvider.");
  return api;
}
