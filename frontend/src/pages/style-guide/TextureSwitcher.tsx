// Guía de estilo (solo desarrollo): barra para saltar entre los dos estilos de referencia que quedan.
import { NavLink } from "react-router-dom";

const options = [
  { to: "/textura/elden-ring-1-5", label: "1.5 · Portales" },
  { to: "/textura/elden-ring-saas", label: "3 · SaaS (home)" },
];

export function TextureSwitcher() {
  return <nav className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full border border-white/15 bg-black/80 p-1 font-sans text-xs shadow-2xl backdrop-blur" aria-label="Estilos de referencia">
    {options.map((option) => <NavLink key={option.to} to={option.to} className={({ isActive }) => `whitespace-nowrap rounded-full px-3 py-1.5 font-semibold transition ${isActive ? "bg-white text-black" : "text-white/70 hover:text-white"}`}>{option.label}</NavLink>)}
  </nav>;
}
