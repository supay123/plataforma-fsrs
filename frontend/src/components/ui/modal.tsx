import { TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "./index";
import { ModalContext, type ModalApi, type ModalOptions, type ModalVariant } from "./use-modal";

const VARIANTS: Record<ModalVariant, { confirmLabel: string; pendingLabel: string; buttonVariant: "danger" | "primary" | "warning" }> = {
  delete: { confirmLabel: "Eliminar", pendingLabel: "Eliminando…", buttonVariant: "danger" },
  create: { confirmLabel: "Crear", pendingLabel: "Creando…", buttonVariant: "primary" },
  warning: { confirmLabel: "Confirmar", pendingLabel: "Aplicando…", buttonVariant: "warning" },
  info: { confirmLabel: "Entendido", pendingLabel: "Entendido", buttonVariant: "primary" },
};

interface OpenModal extends ModalOptions { id: number; variant: ModalVariant }

function ModalDialog({ modal, onClose }: { modal: OpenModal; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const variant = VARIANTS[modal.variant];
  const informative = modal.variant === "info";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pending, onClose]);

  const confirm = async () => {
    setPending(true);
    try {
      await modal.onConfirm();
      onClose();
    } catch {
      // Sigue abierto para reintentar o cancelar; quien llama muestra el error.
      setPending(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
    <button aria-label="Cerrar diálogo" className="absolute inset-0 bg-slate-950/55" disabled={pending} onClick={onClose} />
    <section aria-modal="true" aria-labelledby="modal-title" className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog">
      <h2 id="modal-title" className="flex items-center gap-2 text-lg font-bold text-slate-950">
        {modal.variant === "warning" && <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-600" />}
        {modal.title}
      </h2>
      <div className="mt-3 text-sm leading-6 text-slate-600">{modal.body}</div>
      <div className="mt-6 flex justify-end gap-3">
        {!informative && <Button autoFocus type="button" variant="secondary" disabled={pending} onClick={onClose}>Cancelar</Button>}
        <Button autoFocus={informative} type="button" variant={variant.buttonVariant} disabled={pending} onClick={() => void confirm()}>
          {pending ? variant.pendingLabel : modal.confirmLabel ?? variant.confirmLabel}
        </Button>
      </div>
    </section>
  </div>;
}

/** Modales de eliminación, de creación, de advertencia e informativos con título y cuerpo; se abren con useModal(). */
export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<OpenModal | null>(null);
  const nextId = useRef(0);
  const close = useCallback(() => setModal(null), []);
  const api = useMemo<ModalApi>(() => ({
    delete: (options) => setModal({ ...options, id: ++nextId.current, variant: "delete" }),
    create: (options) => setModal({ ...options, id: ++nextId.current, variant: "create" }),
    warning: (options) => setModal({ ...options, id: ++nextId.current, variant: "warning" }),
    info: (options) => setModal({ ...options, onConfirm: () => undefined, id: ++nextId.current, variant: "info" }),
  }), []);

  return <ModalContext.Provider value={api}>
    {children}
    {/* La key reinicia el estado cuando se abre otro modal. */}
    {modal && <ModalDialog key={modal.id} modal={modal} onClose={close} />}
  </ModalContext.Provider>;
}
