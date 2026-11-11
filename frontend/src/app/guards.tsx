import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PageSkeleton } from "../components/ui/skeleton";
import { useAuth } from "../features/auth/AuthProvider";
import { studentAccess } from "../lib/student-access";
import type { AppRole } from "../types/contracts";

const home: Record<AppRole, string> = { admin: "/admin", teacher: "/profesor", student: "/estudiante" };
/** allowExpired: la página también la ve un estudiante con el plan vencido (renovación). */
export function RoleGuard({ role, children, allowExpired = false }: { role: AppRole; children: ReactNode; allowExpired?: boolean }) {
  const { loading, profile } = useAuth();
  const location = useLocation();
  if (loading) return <div className="dark portal min-h-screen bg-canvas p-8"><div className="mx-auto max-w-6xl"><PageSkeleton /></div></div>;
  if (!profile) return <Navigate to={`${home[role]}/login`} state={{ from: location.pathname }} replace />;
  if (!profile.is_active) return <Navigate to={`${home[role]}/login`} replace />;
  if (profile.role !== role) return <Navigate to={home[profile.role]} replace />;
  if (role === "student") {
    const access = studentAccess(profile);
    if (access.state === "not_started") return <Navigate to="/estudiante/login?acceso=vencido" replace />;
    if (access.state === "expired" && !allowExpired) return <Navigate to="/estudiante/renovar" replace />;
  }
  return children;
}
