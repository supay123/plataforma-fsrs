import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Alert, Button } from "./index";

export interface ModalFormProps {
  title: string;
  /** Texto del botón principal (el que ejecuta la acción). */
  confirmLabel: string;
  /** Texto del botón principal mientras la acción está en curso. */
  pendingLabel?: string;
  pending?: boolean;
  /** Obligatorio salvo con `dismissible={false}`. */
  onCancel?: () => void;
  onSubmit: () => void;
  /** Con `false` no se puede cerrar (ni con la X, Escape, el fondo ni «Cancelar»): solo enviando el formulario. */
  dismissible?: boolean;
  /** Error de la acción; se muestra dentro del modal y este sigue abierto. */
  error?: ReactNode;
  /** Campos del formulario. */
  children: ReactNode;
}

/**
 * Modal con un formulario. El botón principal es de tipo submit, así que el
 * formulario también se envía con Enter. Se usa cuando la acción necesita
 * datos (crear o editar), a diferencia de useModal(), que solo confirma.
 */
export function ModalForm({
  title,
  confirmLabel,
  pendingLabel = "Guardando…",
  pending = false,
  onCancel,
  onSubmit,
  dismissible = true,
  error,
  children,
}: ModalFormProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending && dismissible) onCancel?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, pending, dismissible]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  return <div className="fixed inset-0 z-50 overflow-y-auto" role="presentation">
    {dismissible
      ? <button aria-label="Cerrar diálogo" className="fixed inset-0 bg-slate-950/55 portal:bg-black/70" disabled={pending} onClick={onCancel} />
      : <div aria-hidden className="fixed inset-0 bg-slate-950/55 portal:bg-black/70" />}
    <div className="pointer-events-none flex min-h-full items-center justify-center p-4">
    <section aria-modal="true" aria-labelledby="modal-form-title" role="dialog" className="pointer-events-auto relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:rounded-xl dark:border dark:border-white/10 dark:bg-slate-900 portal:rounded-2xl portal:border-2 portal:border-line portal:bg-blocks portal:text-on-blocks portal:shadow-[0_4px_0_var(--c-line)]">
      {dismissible && <button
        aria-label="Cerrar"
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full portal:rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100 portal:text-fg-muted portal:hover:bg-sunken portal:hover:text-fg"
        disabled={pending}
        onClick={onCancel}
        type="button"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>}
      <h2 id="modal-form-title" className={clsx(dismissible && "pr-10", "text-lg font-bold text-slate-950 dark:text-slate-50 portal:text-xl portal:type-heading portal:text-fg")}>{title}</h2>
      <form className="mt-4 grid gap-4" onSubmit={(event) => { event.preventDefault(); if (!pending) onSubmit(); }}>
        {children}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="mt-2 flex justify-end gap-3">
          {dismissible && <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Cancelar</Button>}
          <Button type="submit" disabled={pending}>{pending ? pendingLabel : confirmLabel}</Button>
        </div>
      </form>
    </section>
    </div>
  </div>;
}
