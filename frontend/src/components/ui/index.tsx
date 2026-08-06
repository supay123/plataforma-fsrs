import { useEffect } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import clsx from "clsx";

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return <button className={clsx("inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", {
    "bg-indigo-600 text-white hover:bg-indigo-700": variant === "primary",
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50": variant === "secondary",
    "bg-rose-600 text-white hover:bg-rose-700": variant === "danger",
    "text-slate-600 hover:bg-slate-100": variant === "ghost",
  }, className)} {...props} />;
}
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{label}</span>{children}{error && <span className="text-xs text-rose-600">{error}</span>}</label>;
}
const control = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input className={clsx(control, props.className)} {...props} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={clsx(control, props.className)} {...props} />; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={clsx(control, props.className)} {...props} />; }
export function Card({ children, className }: { children: ReactNode; className?: string }) { return <section className={clsx("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</section>; }
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) { return <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>{description && <p className="mt-1 text-sm text-slate-600">{description}</p>}</div>{actions}</header>; }
export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) { return <div role="alert" className={clsx("rounded-xl border p-3 text-sm", tone === "error" && "border-rose-200 bg-rose-50 text-rose-800", tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800", tone === "info" && "border-indigo-200 bg-indigo-50 text-indigo-800")}>{children}</div>; }
export function Spinner() { return <div role="status" className="mx-auto my-12 h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"><span className="sr-only">Cargando</span></div>; }
export function EmptyState({ children }: { children: ReactNode }) { return <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">{children}</div>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) { return <span className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold", tone === "neutral" && "bg-slate-100 text-slate-700", tone === "success" && "bg-emerald-100 text-emerald-700", tone === "warning" && "bg-amber-100 text-amber-700")}>{children}</span>; }

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Continuar",
  cancelLabel = "Cancelar",
  confirmVariant = "primary",
  pendingLabel = "Guardando…",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  pendingLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, pending, onCancel]);

  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
    <button aria-label="Cerrar diálogo" className="absolute inset-0 bg-slate-950/55" disabled={pending} onClick={onCancel} />
    <section aria-modal="true" aria-labelledby="confirm-dialog-title" className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog">
      <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
      <div className="mt-6 flex justify-end gap-3">
        <Button autoFocus type="button" variant="secondary" disabled={pending} onClick={onCancel}>{cancelLabel}</Button>
        <Button type="button" variant={confirmVariant} disabled={pending} onClick={onConfirm}>{pending ? pendingLabel : confirmLabel}</Button>
      </div>
    </section>
  </div>;
}
