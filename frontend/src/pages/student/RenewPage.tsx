import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { findPlan } from "../../config/business";
import { useAuth } from "../../features/auth/AuthProvider";
import { createRenewalPayment, getRenewalPaymentStatus, simulateRenewalPayment } from "../../features/payments/api";
import { PaymentPanel } from "../../features/payments/PaymentPanel";
import { PlanPicker } from "../../features/payments/PlanPicker";
import { formatDay } from "../../lib/dates";
import { studentAccess } from "../../lib/student-access";

/**
 * Renovación del plan. La ve el estudiante con el plan vigente (desde el aviso
 * de vencimiento) y también con el plan vencido, que solo puede entrar aquí.
 */
export function RenewPage() {
  const { profile, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const plan = findPlan(searchParams.get("plan"));
  if (!profile) return null;
  const expired = studentAccess(profile).state === "expired";

  return <AuthLayout wide>
    <div className="mb-4">
      <h1 className="text-2xl font-bold">Renueva tu plan</h1>
      <p className="mt-2 text-sm text-slate-600">
        {expired
          ? <>Tu plan venció el <strong>{formatDay(profile.access_valid_until)}</strong>. Renuévalo para volver a practicar.</>
          : <>Tu plan vence el <strong>{formatDay(profile.access_valid_until)}</strong>. Los meses que pagues se suman al final.</>}
      </p>
    </div>
    <div className="mb-5"><PlanPicker plan={plan} onChange={(id) => setSearchParams({ plan: id }, { replace: true })} /></div>
    <PaymentPanel plan={plan} payerKey={profile.id} createPayment={createRenewalPayment} fetchStatus={getRenewalPaymentStatus} simulatePayment={simulateRenewalPayment}
      onPaid={() => void refreshProfile().then(() => navigate("/estudiante", { replace: true }))} />
    <div className="mt-6 text-center text-sm">
      {expired
        ? <button type="button" className="font-semibold text-slate-600 hover:text-slate-900" onClick={() => void logout()}>Salir</button>
        : <Link className="font-semibold text-indigo-600 hover:text-indigo-800" to="/estudiante">Volver a mi progreso</Link>}
    </div>
  </AuthLayout>;
}
