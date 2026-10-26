import clsx from "clsx";
import type { ReactNode } from "react";
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
 */
export function AuthLayout({ children, wide = false, action, cover = DEFAULT_COVER }: { children: ReactNode; wide?: boolean; action?: ReactNode; cover?: AuthCover }) {
  return <div className={clsx("grid min-h-screen bg-white text-slate-900 lg:grid-cols-2", wide && "xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]")}>
    {/* En móvil el formulario ocupa la primera pantalla; la portada aparece al hacer scroll. */}
    <main className="flex min-h-svh min-w-0 flex-col px-4 py-6 sm:px-10 lg:min-h-0">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex"><Logo onLight className="h-7" /></Link>
        {action}
      </div>
      <div className="flex flex-1 items-center justify-center py-8 lg:py-10">
        <div className={clsx("w-full", wide ? "max-w-2xl" : "max-w-md")}>{children}</div>
      </div>
    </main>
    {/* Fija mientras el formulario de la izquierda se desplaza. */}
    <aside className="p-3 lg:sticky lg:top-0 lg:h-screen">
      <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-950 px-6 pt-10 text-white sm:px-10 lg:pt-14 xl:px-14">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 animate-glow rounded-full bg-violet-400/40 blur-3xl" />
        <div className="relative max-w-xl">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl xl:text-5xl">{cover.title}</h2>
          <p className="mt-4 text-indigo-100 sm:mt-5 sm:text-lg">{cover.description}</p>
        </div>
        {/* La captura sale por el borde inferior derecho, como asomándose, con un velo oscuro encima. */}
        <div className="relative -mr-16 mt-auto pt-10 lg:pt-12 xl:-mr-24">
          <div className="relative overflow-hidden rounded-tl-2xl shadow-2xl shadow-indigo-950/60">
            <img src="/image/preview.webp" alt="Vista previa de una pregunta en Chancón" className="block w-full" />
            <div aria-hidden className="absolute inset-0 bg-slate-950/5" />
          </div>
        </div>
      </div>
    </aside>
  </div>;
}
