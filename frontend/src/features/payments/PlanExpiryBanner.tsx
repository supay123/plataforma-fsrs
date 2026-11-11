import { CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDay } from "../../lib/dates";
import { RENEWAL_NOTICE_DAYS, studentAccess } from "../../lib/student-access";
import type { Profile } from "../../types/contracts";

/** Aviso en el portal del estudiante cuando a su plan le quedan pocos días. */
export function PlanExpiryBanner({ profile }: { profile: Profile }) {
  const access = studentAccess(profile);
  if (access.state !== "active" || access.daysLeft > RENEWAL_NOTICE_DAYS) return null;
  const when = access.daysLeft === 0 ? "hoy" : access.daysLeft === 1 ? "mañana" : `en ${access.daysLeft} días`;
  return <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-light">
    <p className="flex items-center gap-2"><CalendarClock size={18} />Tu plan vence {when} ({formatDay(profile.access_valid_until)}). Renuévalo para no perder el acceso.</p>
    <Link to="/estudiante/renovar" className="border border-danger/60 bg-danger/10 px-3 py-1.5 font-semibold text-danger-light hover:bg-danger/20">Renovar</Link>
  </div>;
}
