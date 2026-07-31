import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spinner } from "../components/ui";
import { useAuth } from "../features/auth/AuthProvider";
import { todayInLima } from "../lib/dates";
import type { AppRole } from "../types/contracts";

const home: Record<AppRole, string> = { admin: "/admin", teacher: "/profesor", student: "/estudiante" };
export function RoleGuard({ role, children }: { role: AppRole; children: ReactNode }) {
  const { loading, profile } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!profile) return <Navigate to={`${home[role]}/login`} state={{ from: location.pathname }} replace />;
  if (!profile.is_active) return <Navigate to={`${home[role]}/login`} replace />;
  if (profile.role !== role) return <Navigate to={home[profile.role]} replace />;
  if (
    role === "student" &&
    (!profile.access_valid_from ||
      !profile.access_valid_until ||
      todayInLima() < profile.access_valid_from ||
      todayInLima() > profile.access_valid_until)
  ) {
    return <Navigate to="/estudiante/login?acceso=vencido" replace />;
  }
  return children;
}
