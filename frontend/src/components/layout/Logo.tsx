import clsx from "clsx";
import logo from "../../assets/ChanconLogo.png";
import { BUSINESS } from "../../config/business";

// Adaptamos el png del logo para que se vea bien en modo claro y oscuro.
export function Logo({ className = "h-7", onLight = false }: { className?: string; onLight?: boolean }) {
  const image = <img src={logo} alt={BUSINESS.brand} className={clsx("aspect-[5/1] w-auto object-cover", className)} />;
  return onLight ? <span className="inline-flex rounded-lg bg-slate-950 px-3 py-1.5">{image}</span> : image;
}
