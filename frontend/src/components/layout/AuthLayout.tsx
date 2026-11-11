import clsx from "clsx";
import { useLayoutEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export type AuthCover = { title: string; description: string };

const DEFAULT_COVER: AuthCover = {
  title: "Repasa justo antes de olvidar",
  description: "Chancón programa cada pregunta con repaso espaciado para que estudies menos y recuerdes más.",
};

/**
 * Pantalla partida para el acceso: login, registro, invitación, nueva contraseña y renovación.
 * A la izquierda, sobre fondo blanco, el logo y el formulario; a la derecha, una portada con
 * la vista previa de la plataforma (en móvil va debajo del formulario).
 * `wide` da más ancho para formularios de dos columnas.
 * `action` se muestra a la derecha del logo (p. ej. un botón para iniciar sesión).
 * `cover` cambia el texto de la portada; la imagen es la misma en todas las pantallas.
 * `dark` usa el estilo SaaS oscuro y activa la clase `dark` también en <html>, para que los
 * toasts y modales (que se montan fuera de esta pantalla) se vean oscuros. Las pantallas que
 * aún no migraron no lo pasan y siguen claras.
 */
export function AuthLayout({ children, wide = false, action, cover = DEFAULT_COVER, dark = false }: { children: ReactNode; wide?: boolean; action?: ReactNode; cover?: AuthCover; dark?: boolean }) {
  useLayoutEffect(() => {
    if (!dark) return;
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);
  return <div className={clsx("grid min-h-screen lg:grid-cols-2", dark ? "dark bg-slate-950 text-slate-200" : "bg-white text-slate-900", wide && "xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]")}>
    {/* En móvil el formulario ocupa la primera pantalla; la portada aparece al hacer scroll. */}
    <main className="flex min-h-svh min-w-0 flex-col px-4 py-6 sm:px-10 lg:min-h-0">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex"><Logo onLight={!dark} className="h-7" /></Link>
        {action}
      </div>
      <div className="flex flex-1 items-center justify-center py-8 lg:py-10">
        <div className={clsx("w-full", wide ? "max-w-2xl" : "max-w-md")}>{children}</div>
      </div>
    </main>
    {/* Fija mientras el formulario de la izquierda se desplaza. */}
    <aside className="p-3 lg:sticky lg:top-0 lg:h-screen">
      <div className={clsx("relative flex h-full flex-col overflow-hidden px-6 pt-10 text-white sm:px-10 lg:pt-14 xl:px-14",
        dark ? "rounded-xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950" : "rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-950")}>
        {dark && <div aria-hidden className="bg-grid absolute inset-0" />}
        <div aria-hidden className={clsx("pointer-events-none absolute -right-24 -top-24 h-80 w-80 animate-glow rounded-full blur-3xl", dark ? "bg-emerald-500/15" : "bg-violet-400/40")} />
        <div className="relative max-w-xl">
          <h2 className={clsx("text-3xl leading-tight sm:text-4xl xl:text-5xl", dark ? "font-display font-semibold tracking-wide text-slate-50" : "font-bold")}>{cover.title}</h2>
          <p className={clsx("mt-4 sm:mt-5 sm:text-lg", dark ? "text-slate-300" : "text-indigo-100")}>{cover.description}</p>
        </div>
        {/* La captura sale por el borde inferior derecho, como asomándose, con un velo oscuro encima. */}
        <div className="relative -mr-16 mt-auto pt-10 lg:pt-12 xl:-mr-24">
          <div className={clsx("relative overflow-hidden rounded-tl-2xl shadow-2xl", dark ? "shadow-black/60" : "shadow-indigo-950/60")}>
            <img src="/image/preview.webp" alt="Vista previa de una pregunta en Chancón" className="block w-full" />
            <div aria-hidden className="absolute inset-0 bg-slate-950/5" />
          </div>
        </div>
      </div>
    </aside>
  </div>;
}
