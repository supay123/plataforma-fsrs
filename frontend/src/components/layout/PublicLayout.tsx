import { Mail, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import complaintsBookImage from "../../assets/Libroreclamaciones.jpeg";
import { BUSINESS } from "../../config/business";
import { Logo } from "./Logo";

const columns = [
  { title: "Producto", links: [{ to: "/precios", label: "Planes y precios" }, { to: "/estudiante/login", label: "Ingreso de estudiantes" }, { to: "/profesor/login", label: "Ingreso de profesores" }] },
  { title: "Legal", links: [{ to: "/terminos", label: "Términos y condiciones" }, { to: "/privacidad", label: "Política de privacidad" }, { to: "/reembolsos", label: "Política de reembolsos" }] },
];

export function ComplaintsBookIcon({ className = "h-5" }: { className?: string }) {
  return <img src={complaintsBookImage} alt="" aria-hidden="true" className={`w-auto rounded bg-white ${className}`} />;
}

export function PublicFooter() {
  return <footer className="border-t border-slate-800 bg-slate-950 px-4 py-14 text-slate-300 print:hidden">
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="inline-flex"><Logo className="h-8" /></Link>
          <p className="mt-3 text-sm text-slate-400">Entrenador preuniversitario con práctica adaptativa.</p>
        </div>
        {columns.map((column) => <nav key={column.title} aria-label={column.title}>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">{column.title}</h2>
          <ul className="mt-4 grid gap-3 text-sm">{column.links.map((link) => <li key={link.to}><Link className="hover:text-white" to={link.to}>{link.label}</Link></li>)}</ul>
        </nav>)}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Contacto</h2>
          <ul className="mt-4 grid gap-3 text-sm">
            <li><a className="inline-flex items-center gap-2 hover:text-white" href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`}><Phone size={16} />{BUSINESS.phone}</a></li>
            <li><a className="inline-flex items-center gap-2 hover:text-white" href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={16} />Escríbenos por WhatsApp</a></li>
            <li><a className="inline-flex items-center gap-2 break-all hover:text-white" href={`mailto:${BUSINESS.email}`}><Mail size={16} className="shrink-0" />{BUSINESS.email}</a></li>
            <li><Link className="inline-flex items-center gap-2 hover:text-white" to="/libro-reclamaciones"><ComplaintsBookIcon />Libro de reclamaciones</Link></li>
          </ul>
        </div>
      </div>
      {BUSINESS.social.length > 0 && <ul className="mt-10 flex justify-center gap-3">{BUSINESS.social.map((item) => <li key={item.url}><a className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-indigo-400 hover:text-white" href={item.url} target="_blank" rel="noreferrer">{item.label}</a></li>)}</ul>}
      <div className="mt-10 grid gap-1 border-t border-slate-800 pt-6 text-center text-sm text-slate-400">
        <p>© {new Date().getFullYear()} {BUSINESS.tradeName}</p>
        <p>{BUSINESS.legalName} · RUC {BUSINESS.ruc} · {BUSINESS.address}</p>
      </div>
    </div>
  </footer>;
}

export function PublicPage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-slate-950 text-white">
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 print:hidden"><Link to="/" className="inline-flex"><Logo /></Link></div>
    <main className="flex-1">{children}</main>
    <PublicFooter />
  </div>;
}
