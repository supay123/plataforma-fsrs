import clsx from "clsx";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "../ui";
import { Logo } from "./Logo";

/**
 * Fondo degradado con una tarjeta y el logo, sin encabezado ni pie de página.
 * Lo usan las pantallas de acceso: login, registro y nueva contraseña.
 * `wide` da más ancho para formularios de dos columnas.
 */
export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-indigo-950 via-indigo-800 to-sky-700 p-4">
    <Card className={clsx("w-full border-0 p-7 shadow-2xl", wide ? "max-w-3xl sm:p-8" : "max-w-md")}>
      <Link to="/" className="mb-7 inline-flex"><Logo onLight className="h-7" /></Link>
      {children}
    </Card>
  </main>;
}
