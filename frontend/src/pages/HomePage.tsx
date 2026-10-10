import { Link, Navigate } from "react-router-dom";
import { Logo } from "../components/layout/Logo";
import { PublicFooter } from "../components/layout/PublicLayout";
import { Card } from "../components/ui";
import { useAuth } from "../features/auth/AuthProvider";
const portals = [
  { path: "/admin/login", title: "Administrador", text: "Instituciones, usuarios y accesos." },
  { path: "/profesor/login", title: "Profesor", text: "Cursos, preguntas y resultados." },
  { path: "/estudiante/login", title: "Estudiante", text: "Materiales, sesiones y progreso." },
];
export function HomePage() {
  const { profile, loading } = useAuth();
  if (!loading && profile) return <Navigate to={profile.role === "teacher" ? "/profesor" : `/${profile.role === "student" ? "estudiante" : "admin"}`} replace />;
  return <div className="flex min-h-screen flex-col bg-slate-950 text-white"><main className="flex-1 px-4 py-16"><div className="mx-auto max-w-5xl"><div className="mb-12 text-center"><h1><Logo className="mx-auto h-16 sm:h-20" /></h1><p className="mt-5 text-slate-300">Entrenador preuniversitario con práctica adaptativa.</p><Link to="/precios" className="mt-6 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold hover:bg-indigo-500">Ver planes</Link></div><div className="grid gap-5 md:grid-cols-3">{portals.map((portal) => <Link key={portal.path} to={portal.path}><Card className="h-full border-slate-700 bg-slate-900 text-white transition hover:-translate-y-1 hover:border-indigo-400"><h2 className="text-xl font-bold text-white">{portal.title}</h2><p className="mt-2 text-sm text-slate-400">{portal.text}</p><span className="mt-8 block text-sm font-semibold text-indigo-300">Ingresar →</span></Card></Link>)}</div></div></main><PublicFooter /></div>;
}
export function NotFoundPage() { return <main className="grid min-h-screen place-items-center p-6 text-center"><div><strong className="text-6xl text-indigo-600">404</strong><h1 className="mt-4 text-2xl font-bold">Página no encontrada</h1><Link className="mt-5 inline-block font-semibold text-indigo-600" to="/">Volver al inicio</Link></div></main>; }
