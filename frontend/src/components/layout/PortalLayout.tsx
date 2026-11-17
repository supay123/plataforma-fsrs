import clsx from "clsx";
import { BookOpen, Building2, GraduationCap, ListChecks, LogOut, PanelLeftClose, Route as RouteIcon, Settings, Trophy, Users, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { PlanExpiryBanner } from "../../features/payments/PlanExpiryBanner";
import { preloadMascot } from "../../features/sessions/preload-mascot";
import { roleLabel } from "../../features/users/api";
import type { AppRole } from "../../types/contracts";
import { useTheme } from "../../lib/theme/theme-context";
import { ThemeToggle } from "../ui/ThemeToggle";
import { useModal } from "../ui/use-modal";
import { Logo } from "./Logo";
import { PortalModeContext, type LeaveWarning, type PortalModeApi } from "./portal-mode";

type NavItem = { to: string; label: string; icon: typeof Users };

const links: Record<AppRole, NavItem[]> = {
  admin: [{ to: "/admin/usuarios", label: "Usuarios", icon: Users }, { to: "/admin/cursos", label: "Cursos", icon: BookOpen }, { to: "/admin/colegios", label: "Colegios", icon: Building2 }, { to: "/admin/asignaciones", label: "Asignaciones", icon: ListChecks }, { to: "/admin/ruta", label: "Modo ruta", icon: RouteIcon }],
  teacher: [{ to: "/profesor/cursos", label: "Cursos", icon: BookOpen }, { to: "/profesor/estudiantes", label: "Estudiantes", icon: Users }, { to: "/profesor/ruta", label: "Modo ruta", icon: RouteIcon }],
  student: [{ to: "/estudiante", label: "Mi aprendizaje", icon: GraduationCap }, { to: "/estudiante/logros", label: "Mis logros", icon: Trophy }, { to: "/estudiante/ruta", label: "Modo ruta", icon: RouteIcon }],
};
const settingsPath: Record<AppRole, string> = { admin: "/admin/configuracion", teacher: "/profesor/configuracion", student: "/estudiante/configuracion" };
const homePath: Record<AppRole, string> = { admin: "/admin/usuarios", teacher: "/profesor/cursos", student: "/estudiante" };
const STORAGE_KEY = "portal-menu-collapsed";

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

/**
 * Estructura de los tres portales (estilo Chancón).
 * - Escritorio: una cuadrícula `menú | contenido`. El menú ocupa su propia columna (pegado arriba
 *   con `sticky`, no `fixed`), completo o reducido a iconos.
 * - Móvil: cabecera con el logo y barra de iconos fija abajo. Durante una práctica la barra se
 *   oculta y la cabecera ofrece salir.
 * El contenedor recorta el desborde horizontal y la columna del contenido puede encogerse
 * (`minmax(0, 1fr)`), para que un texto largo nunca ensanche la página.
 */
export function PortalLayout({ role }: { role: AppRole }) {
  // Toasts y modales se montan fuera de esta pantalla: también heredan el estilo desde <html>.
  const { mode } = useTheme();
  useLayoutEffect(() => {
    const root = document.documentElement;
    const added = ["portal", ...(mode === "dark" ? ["dark"] : [])].filter((name) => !root.classList.contains(name));
    root.classList.add(...added);
    return () => root.classList.remove(...added);
  }, [mode]);
  // El estudiante practica con la mascota 3D: se baja en segundo plano, sin competir con la carga inicial.
  useEffect(() => {
    if (role !== "student") return;
    const timer = window.setTimeout(preloadMascot, 1500);
    return () => window.clearTimeout(timer);
  }, [role]);
  const { profile, logout } = useAuth();
  const modal = useModal();
  const navigate = useNavigate();
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
  const pathname = useLocation().pathname;
  const toggle = (value: boolean) => {
    if (focus) { setFocusExpanded(!value); return; }
    setCollapsed(value);
    saveCollapsed(value);
  };
  // Con una advertencia activa (p. ej. una práctica en curso) salir pide confirmación.
  const leave = (action: () => unknown) => {
    if (!leaveWarning) { void action(); return; }
    modal.warning({ ...leaveWarning, onConfirm: action });
  };
  const go = (to: string) => (event: { preventDefault: () => void }) => {
    if (!leaveWarning) return;
    event.preventDefault();
    leave(() => navigate(to));
  };

  const sections: NavItem[] = [...links[role], { to: settingsPath[role], label: "Configuración", icon: Settings }];
  // Una sección está activa en su ruta, salvo que otra sección más específica (p. ej. Modo ruta o
  // Configuración dentro de "/estudiante", la raíz de Mi aprendizaje) también coincida: entonces solo se marca esa.
  const isActive = (item: NavItem, active: boolean) => active && !sections.some((other) => other.to !== item.to && other.to.startsWith(`${item.to}/`) && pathname.startsWith(other.to));

  const renderItem = (item: NavItem, compact: boolean) => <NavLink key={item.to} to={item.to} title={compact ? item.label : undefined} onClick={go(item.to)}
    className={({ isActive: active }) => clsx(
      "flex items-center gap-3 rounded-xl py-3 font-medium transition",
      compact ? "justify-center px-0" : "px-4",
      isActive(item, active) ? "bg-primary-soft text-primary-text" : "text-fg-muted hover:bg-line hover:text-fg",
    )}>
    {({ isActive: active }) => <>
      <item.icon size={20} />
      <span className={compact ? "sr-only" : undefined}>{item.label}</span>
      {isActive(item, active) && !compact && <span aria-hidden className="ml-auto h-1.5 w-1.5 rotate-45 bg-secondary" />}
    </>}
  </NavLink>;

  const sidebar = <aside className="sticky top-0 hidden h-dvh flex-col overflow-hidden border-r-2 border-line bg-blocks text-on-blocks md:flex">
    <div className={clsx("flex h-16 shrink-0 items-center border-b-2 border-line", compactDesktop ? "justify-center" : "justify-between px-5")}>
      {compactDesktop
        ? <button type="button" aria-label="Expandir menú" title="Expandir menú" className="rounded-xl p-1 hover:bg-line" onClick={() => toggle(false)}><MascotHead className="h-9 w-9" /></button>
        : <><Logo onLight={mode === "light"} className="h-7" /><button type="button" aria-label="Reducir menú" title="Reducir menú" className="rounded-xl p-1.5 text-fg-muted hover:bg-line hover:text-fg" onClick={() => toggle(true)}><PanelLeftClose size={18} /></button></>}
    </div>
    <nav aria-label="Principal" className="grid gap-1 p-3">{sections.map((item) => renderItem(item, compactDesktop))}</nav>
    <div className={clsx("mt-auto border-t-2 border-line", compactDesktop ? "p-2" : "p-4")}>
      {!compactDesktop && <><p className="truncate text-sm font-semibold">{profile?.full_name}</p><p className="truncate text-xs text-fg-faint">{profile && roleLabel(profile.role)}</p></>}
      <div className={clsx("flex gap-2", compactDesktop ? "mt-0 flex-col items-center" : "mt-3 items-center justify-between")}>
        <button type="button" title={compactDesktop ? "Salir" : undefined} onClick={() => leave(() => logout())}
          className={clsx("flex items-center gap-2 rounded-xl py-2 text-sm font-medium text-fg-muted transition hover:bg-line hover:text-fg", compactDesktop ? "w-full justify-center" : "px-4")}>
          <LogOut size={17} /><span className={compactDesktop ? "sr-only" : undefined}>Salir</span>
        </button>
        <ThemeToggle />
      </div>
    </div>
  </aside>;

  const mobileHeader = <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b-2 border-line bg-blocks px-4 text-on-blocks md:hidden">
    <Logo onLight={mode === "light"} className="h-6" />
    {focus
      ? <button type="button" aria-label="Salir de la práctica" className="rounded-xl p-2 text-fg-muted hover:bg-line hover:text-fg" onClick={() => leave(() => navigate(homePath[role]))}><X size={22} /></button>
      : <div className="flex items-center gap-1"><ThemeToggle /><button type="button" aria-label="Cerrar sesión" className="rounded-xl p-2 text-fg-muted hover:bg-line hover:text-fg" onClick={() => leave(() => logout())}><LogOut size={20} /></button></div>}
  </header>;

  // Barra inferior: solo iconos; el activo lleva una línea debajo. Se oculta durante una práctica.
  const bottomBar = !focus && <nav aria-label="Principal (móvil)" className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col border-t-2 border-line bg-blocks pb-[env(safe-area-inset-bottom)] text-on-blocks md:hidden">
    {sections.map((item) => <NavLink key={item.to} to={item.to} aria-label={item.label} onClick={go(item.to)}
      className={({ isActive: active }) => clsx("relative grid h-16 place-items-center transition", isActive(item, active) ? "text-fg" : "text-fg-faint hover:text-fg-muted")}>
      {({ isActive: active }) => <>
        <item.icon size={24} strokeWidth={isActive(item, active) ? 2.2 : 1.8} />
        {isActive(item, active) && <span aria-hidden className="absolute bottom-1.5 h-[3px] w-10 rounded-full bg-current" />}
      </>}
    </NavLink>)}
  </nav>;

  return <PortalModeContext.Provider value={portalMode}>
    <div className={clsx("portal min-h-dvh overflow-x-clip bg-base text-on-base md:grid md:transition-[grid-template-columns] md:duration-200", mode === "dark" && "dark")} style={{ gridTemplateColumns: "var(--menu-w) minmax(0, 1fr)", "--menu-w": compactDesktop ? "4.5rem" : "16rem" } as CSSProperties}>
      {sidebar}
      <div className="min-w-0">
        {mobileHeader}
        <main className={clsx("p-4 md:p-8", focus ? "pb-24" : "pb-28 md:pb-16")}>
          <div className="@container mx-auto max-w-7xl">{role === "student" && profile && <PlanExpiryBanner profile={profile} />}<Outlet /></div>
        </main>
      </div>
      {bottomBar}
    </div>
  </PortalModeContext.Provider>;
}
