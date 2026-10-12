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
  return <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
    <p className="flex items-center gap-2"><CalendarClock size={18} />Tu plan vence {when} ({formatDay(profile.access_valid_until)}). Renuévalo para no perder el acceso.</p>
    <Link to="/estudiante/renovar" className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700">Renovar</Link>
  </div>;
}
