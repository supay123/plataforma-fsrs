import clsx from "clsx";
import { BookOpen, Building2, GraduationCap, ListChecks, LogOut, Menu, PanelLeftClose, Settings, Users, X } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { PlanExpiryBanner } from "../../features/payments/PlanExpiryBanner";
import { roleLabel } from "../../features/users/api";
import type { AppRole } from "../../types/contracts";
import { Button } from "../ui";
import { CenteredDivider } from "../ui/ornaments";
import { useModal } from "../ui/use-modal";
import { Logo } from "./Logo";
import { PortalModeContext, type LeaveWarning, type PortalModeApi } from "./portal-mode";

const links: Record<AppRole, Array<{ to: string; label: string; icon: typeof Users }>> = {
  admin: [{ to: "/admin/usuarios", label: "Usuarios", icon: Users }, { to: "/admin/cursos", label: "Cursos", icon: BookOpen }, { to: "/admin/colegios", label: "Colegios", icon: Building2 }, { to: "/admin/asignaciones", label: "Asignaciones", icon: ListChecks }],
  teacher: [{ to: "/profesor/cursos", label: "Cursos", icon: BookOpen }, { to: "/profesor/estudiantes", label: "Estudiantes", icon: Users }],
  student: [{ to: "/estudiante", label: "Mi aprendizaje", icon: GraduationCap }],
};
const settingsPath: Record<AppRole, string> = { admin: "/admin/configuracion", teacher: "/profesor/configuracion", student: "/estudiante/configuracion" };
const STORAGE_KEY = "portal-menu-collapsed";

const linkClass = (active: boolean, compact: boolean) => clsx("relative flex items-center gap-3 py-2.5 text-sm font-medium transition", compact ? "justify-center px-0" : "px-5", active ? "bg-primary/10 text-primary-pale" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg-strong");

// El navegador puede bloquear el almacenamiento: el menú funciona igual sin recordar el estado.
function readCollapsed() {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}
function saveCollapsed(value: boolean) {
  try { localStorage.setItem(STORAGE_KEY, value ? "1" : "0"); } catch { /* sin almacenamiento */ }
}

/** Cabeza de la mascota (recorte de la ilustración 2D) para el menú reducido. */
function MascotHead({ className }: { className?: string }) {
  return <span aria-hidden className={clsx("block shrink-0 bg-no-repeat", className)} style={{ backgroundImage: "url(/image/mascota-cabeza.png)", backgroundSize: "100%", backgroundPosition: "49% 22%" }} />;
}

export function PortalLayout({ role }: { role: AppRole }) {
  // Toasts y modales se montan fuera de esta pantalla: también heredan el estilo desde <html>.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const added = ["dark", "portal"].filter((name) => !root.classList.contains(name));
    root.classList.add(...added);
    return () => root.classList.remove(...added);
  }, []);
  const { profile, logout } = useAuth();
  const modal = useModal();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // Modo práctica: el menú se reduce sin tocar la preferencia guardada y,
  // si el usuario lo expande, vuelve a reducirse en la próxima práctica.
  const [focus, setFocusState] = useState(false);
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [leaveWarning, setLeaveWarning] = useState<LeaveWarning | null>(null);
  const portalMode = useMemo<PortalModeApi>(() => ({
    setFocus: (value) => { setFocusState(value); setFocusExpanded(false); },
    setLeaveWarning,
  }), []);
  const compactDesktop = focus ? !focusExpanded : collapsed;
  // "/estudiante" (Mi aprendizaje) también coincide con "/estudiante/configuracion":
  // en Configuración solo se marca Configuración.
  const inSettings = useLocation().pathname.startsWith(settingsPath[role]);
  const toggle = (value: boolean) => {
    if (focus) { setFocusExpanded(!value); return; }
    setCollapsed(value);
    saveCollapsed(value);
  };
  // Con una advertencia activa (p. ej. una práctica en curso) salir pide confirmación.
  const leave = (action: () => unknown) => {
    setOpen(false);
    if (!leaveWarning) { void action(); return; }
    modal.warning({ ...leaveWarning, onConfirm: action });
  };

  // `compact`: solo iconos (escritorio reducido). En el drawer móvil siempre va completo.
  const renderNav = (compact: boolean) => {
    const label = (text: string) => <span className={compact ? "sr-only" : undefined}>{text}</span>;
    const item = (to: string, text: string, Icon: typeof Users, active: (isActive: boolean) => boolean) => (
      <NavLink key={to} to={to} title={compact ? text : undefined} onClick={(event) => {
        if (!leaveWarning) { setOpen(false); return; }
        event.preventDefault();
        leave(() => navigate(to));
      }} className={({ isActive }) => linkClass(active(isActive), compact)}>{({ isActive }) => <>{active(isActive) && <span aria-hidden className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 bg-ornament" />}<Icon size={18} className={active(isActive) ? "text-primary-light" : undefined} />{label(text)}</>}</NavLink>
    );
    return <>
      <div className={clsx("flex h-16 shrink-0 items-center", compact ? "justify-center" : "justify-between px-5")}>
        {compact
          ? <button type="button" aria-label="Expandir menú" title="Expandir menú" className="p-1 hover:bg-white/[0.04]" onClick={() => toggle(false)}><MascotHead className="h-9 w-9" /></button>
          : <><Logo className="h-7" /><button type="button" aria-label="Reducir menú" title="Reducir menú" className="hidden p-1.5 text-fg-muted hover:bg-white/[0.04] hover:text-fg-strong md:block" onClick={() => toggle(true)}><PanelLeftClose size={18} /></button></>}
      </div>
      <CenteredDivider className="px-4" />
      <nav className={clsx("grid gap-1 p-3", compact && "justify-items-stretch")}>
        {links[role].map(({ to, label: text, icon }) => item(to, text, icon, (isActive) => isActive && !inSettings))}
        <CenteredDivider className="my-2 px-2" />
        {item(settingsPath[role], "Configuración", Settings, (isActive) => isActive)}
      </nav>
      <div className="mt-auto"><CenteredDivider className="px-4" /><div className={compact ? "p-3" : "p-4"}>
        {!compact && <><p className="truncate text-sm font-semibold text-fg-strong">{profile?.full_name}</p><p className="truncate text-xs text-fg-faint">{profile && roleLabel(profile.role)}</p></>}
        <Button variant="ghost" title={compact ? "Salir" : undefined} className={clsx("w-full", compact ? "justify-center px-0" : "mt-3 justify-start")} onClick={() => leave(() => logout())}><LogOut size={17} className={compact ? undefined : "mr-2"} />{label("Salir")}</Button>
      </div></div>
    </>;
  };

  return <PortalModeContext.Provider value={portalMode}><div className="dark portal min-h-screen bg-canvas text-fg" style={{ fontFamily: "Inter, ui-sans-serif, sans-serif" }}>
    <div aria-hidden className="portal-atmosphere pointer-events-none fixed inset-0" />
    <div aria-hidden className="portal-grain pointer-events-none fixed inset-0 z-40" />
    {/* Escritorio: menú fijo, completo o reducido a iconos. */}
    <aside className={clsx("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-sidebar/95 text-fg transition-[width] duration-200 md:flex", compactDesktop ? "w-[4.5rem]" : "w-64")}>{renderNav(compactDesktop)}</aside>
    {/* Móvil: hamburguesa que abre el menú desde la izquierda. */}
    {open && <div className="fixed inset-0 z-40 md:hidden"><button aria-label="Cerrar menú" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} /><aside className="relative flex h-full w-72 animate-drawer flex-col border-r border-line bg-sidebar text-fg">{renderNav(false)}<button aria-label="Cerrar menú" className="absolute right-3 top-4 text-fg-muted hover:text-fg-strong" onClick={() => setOpen(false)}><X /></button></aside></div>}
    <header className="sticky top-0 z-20 flex h-16 items-center border-b border-line bg-sidebar px-4 md:hidden"><button aria-label="Abrir menú" className="text-fg-muted hover:text-fg-strong" onClick={() => setOpen(true)}><Menu /></button><span className="ml-3"><Logo className="h-5" /></span></header>
    <main className={clsx("relative p-4 pb-24 transition-[margin] duration-200 md:p-8", compactDesktop ? "md:ml-[4.5rem]" : "md:ml-64")}><div className="mx-auto max-w-7xl">{role === "student" && profile && <PlanExpiryBanner profile={profile} />}<Outlet /></div></main>
  </div></PortalModeContext.Provider>;
}
