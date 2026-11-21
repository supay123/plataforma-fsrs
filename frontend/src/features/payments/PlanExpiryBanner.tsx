import { Link } from "react-router-dom";
import { PracticeMascot } from "../sessions/PracticeMascot";
import { formatDay } from "../../lib/dates";
import { RENEWAL_NOTICE_DAYS, studentAccess } from "../../lib/student-access";
import type { Profile } from "../../types/contracts";

/** Aviso en el portal del estudiante cuando a su plan le quedan pocos días. */
export function PlanExpiryBanner({ profile }: { profile: Profile }) {
  const access = studentAccess(profile);
  if (access.state !== "active" || access.daysLeft > RENEWAL_NOTICE_DAYS) return null;
  const when = access.daysLeft === 0 ? "hoy" : access.daysLeft === 1 ? "mañana" : `en ${access.daysLeft} días`;
  return <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-danger bg-danger-soft px-4 py-3 text-sm text-danger-text">
    <p className="flex items-center gap-3"><PracticeMascot mood="thinking" size={40} className="mb-1" />Tu plan vence {when} ({formatDay(profile.access_valid_until)}). Renuévalo para no perder el acceso.</p>
    <Link to="/estudiante/renovar" className="rounded-xl bg-danger px-4 py-1.5 font-semibold text-on-danger shadow-[0_3px_0_var(--c-danger-strong)] transition hover:brightness-105 active:translate-y-[3px] active:shadow-none">Renovar</Link>
  </div>;
}
