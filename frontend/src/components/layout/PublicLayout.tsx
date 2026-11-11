import { Mail, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import complaintsBookImage from "../../assets/Libroreclamaciones.jpeg";
import { BUSINESS } from "../../config/business";
import { Logo } from "./Logo";

const columns = [
  { title: "Producto", links: [{ to: "/estudiante/login", label: "Ingreso de estudiantes" }, { to: "/profesor/login", label: "Ingreso de profesores" }, { to: "/admin/login", label: "Ingreso de administradores" }] },
  { title: "Legal", links: [{ to: "/terminos", label: "Términos y condiciones" }, { to: "/privacidad", label: "Política de privacidad" }, { to: "/reembolsos", label: "Política de reembolsos" }] },
];

export function ComplaintsBookIcon({ className = "h-5" }: { className?: string }) {
  return <img src={complaintsBookImage} alt="" aria-hidden="true" className={`w-auto rounded bg-white ${className}`} />;
}

export function PublicFooter() {
  // Fijo al fondo de la pantalla: el contenido (z-10) se desliza encima y lo descubre al llegar al final.
  // En celular es más alto que la pantalla y quedaría asomado detrás del header, así que ahí es normal.
  return <footer className="relative z-0 border-t border-white/[0.06] bg-slate-950 px-4 py-14 text-slate-300 sm:sticky sm:bottom-0 print:static">
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="inline-flex"><Logo className="h-8" /></Link>
          <p className="mt-3 text-sm text-slate-400">Entrenador preuniversitario con práctica adaptativa.</p>
        </div>
        {columns.map((column) => <nav key={column.title} aria-label={column.title}>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">{column.title}</h2>
          <ul className="mt-4 grid gap-3 text-sm">{column.links.map((link) => <li key={link.to}><Link className="underline-offset-4 hover:text-white hover:underline" to={link.to}>{link.label}</Link></li>)}</ul>
        </nav>)}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Contacto</h2>
          <ul className="mt-4 grid gap-3 text-sm">
            <li><a className="inline-flex items-center gap-2 underline-offset-4 hover:text-white hover:underline" href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`}><Phone size={16} />{BUSINESS.phone}</a></li>
            <li><a className="inline-flex items-center gap-2 underline-offset-4 hover:text-white hover:underline" href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={16} />Escríbenos por WhatsApp</a></li>
            <li><a className="inline-flex items-center gap-2 break-all underline-offset-4 hover:text-white hover:underline" href={`mailto:${BUSINESS.email}`}><Mail size={16} className="shrink-0" />{BUSINESS.email}</a></li>
            <li><Link className="inline-flex items-center gap-2 underline-offset-4 hover:text-white hover:underline" to="/libro-reclamaciones"><ComplaintsBookIcon />Libro de reclamaciones</Link></li>
          </ul>
        </div>
      </div>
      {BUSINESS.social.length > 0 && <ul className="mt-10 flex justify-center gap-3">{BUSINESS.social.map((item) => <li key={item.url}><a className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:border-emerald-400 hover:text-white hover:underline" href={item.url} target="_blank" rel="noreferrer">{item.label}</a></li>)}</ul>}
      <div className="mt-10 grid gap-1 border-t border-white/10 pt-6 text-center text-sm text-slate-400">
        <p>© {new Date().getFullYear()} {BUSINESS.tradeName}</p>
        <p>{BUSINESS.legalName} · RUC {BUSINESS.ruc} · {BUSINESS.address}</p>
      </div>
    </div>
  </footer>;
}

export function PublicPage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-slate-950 text-white">
    <div className="relative z-10 bg-slate-950 print:hidden"><div className="mx-auto w-full max-w-6xl px-4 pt-6"><Link to="/" className="inline-flex"><Logo /></Link></div></div>
    <main className="relative z-10 flex-1 bg-slate-950 shadow-xl shadow-black/40">{children}</main>
    <PublicFooter />
  </div>;
}
