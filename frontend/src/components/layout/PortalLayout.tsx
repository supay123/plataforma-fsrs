import { BookOpen, Building2, GraduationCap, LogOut, Menu, Settings, Users, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import type { AppRole } from "../../types/contracts";
import { Button } from "../ui";

const links: Record<AppRole, Array<{ to: string; label: string; icon: typeof Users }>> = {
  admin: [{ to: "/admin/usuarios", label: "Usuarios", icon: Users }, { to: "/admin/colegios", label: "Colegios", icon: Building2 }],
  teacher: [{ to: "/profesor/cursos", label: "Cursos", icon: BookOpen }, { to: "/profesor/estudiantes", label: "Estudiantes", icon: Users }],
  student: [{ to: "/estudiante", label: "Mi progreso", icon: GraduationCap }],
};
const settingsPath: Record<AppRole, string> = { admin: "/admin/configuracion", teacher: "/profesor/configuracion", student: "/estudiante/configuracion" };
export function PortalLayout({ role }: { role: AppRole }) {
  const { profile, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = <><div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5"><GraduationCap className="text-indigo-300" /><strong>Aula FSRS</strong></div><nav className="grid gap-1 p-3">{links[role].map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? "bg-indigo-500 text-white" : "text-slate-300 hover:bg-slate-800"}`}><Icon size={18} />{label}</NavLink>)}<div className="my-2 border-t border-slate-800" /><NavLink to={settingsPath[role]} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? "bg-indigo-500 text-white" : "text-slate-300 hover:bg-slate-800"}`}><Settings size={18} />Configuración</NavLink></nav><div className="mt-auto border-t border-slate-800 p-4"><p className="truncate text-sm font-semibold">{profile?.full_name}</p><p className="truncate text-xs text-slate-400">{profile?.user_code}</p><Button variant="ghost" className="mt-3 w-full justify-start text-slate-300 hover:bg-slate-800" onClick={() => void logout()}><LogOut size={17} className="mr-2" />Salir</Button></div></>;
  return <div className="min-h-screen bg-slate-50"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-950 text-white md:flex">{nav}</aside>{open && <div className="fixed inset-0 z-40 md:hidden"><button aria-label="Cerrar menú" className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} /><aside className="relative flex h-full w-72 flex-col bg-slate-950 text-white">{nav}<button className="absolute right-3 top-4" onClick={() => setOpen(false)}><X /></button></aside></div>}<header className="sticky top-0 z-20 flex h-16 items-center border-b bg-white px-4 md:hidden"><button aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu /></button><strong className="ml-3">Aula FSRS</strong></header><main className="p-4 md:ml-64 md:p-8"><div className="mx-auto max-w-7xl"><Outlet /></div></main></div>;
}
