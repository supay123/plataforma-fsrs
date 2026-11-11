import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { LockKeyhole, LogIn, Mail, Phone, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Alert, Button, Field, Input, PasswordInput, Select } from "../../components/ui";
import { useToast } from "../../components/ui/use-toast";
import { findPlan } from "../../config/business";
import { useAuth } from "../../features/auth/AuthProvider";
import { saveCredentials } from "../../features/auth/save-credentials";
import { DOCUMENT_TYPES } from "../../features/complaints/model";
import { PaymentPanel } from "../../features/payments/PaymentPanel";
import { PlanPicker } from "../../features/payments/PlanPicker";
import {
  createRegistrationPayment, getRegistrationPaymentStatus, listRegistrationTeachers, requestRegistrationCode,
  validateRegistrationCode, validateStudentRegistration,
  type EmailCodeDelivery, type ValidatedRegistration,
} from "../../features/registration/api";
import {
  SERVER_FIELD_MESSAGES, documentIsValid, documentIssue, passwordFields, passwordMismatchIssue, passwordsMatch, studentFields,
} from "../../features/registration/fields";
import { normalizeIdentityDocument } from "../../features/registration/rules";
import { PasswordChecklist } from "../../features/registration/PasswordChecklist";
import { normalizeError } from "../../lib/api/errors";
import { secondsUntil, useNow } from "../../lib/use-now";

// Plazos que se explican al usuario; deben coincidir con el backend.
const PENDING_HOURS = 24;

const schema = z.object({
  ...studentFields,
  teacher_id: z.string().min(1, "Selecciona tu grupo."),
  ...passwordFields,
  accepted_terms: z.boolean().refine((value) => value, "Debes aceptar los términos y la política de privacidad."),
})
  .refine(documentIsValid, documentIssue)
  .refine(passwordsMatch, passwordMismatchIssue);
type Values = z.infer<typeof schema>;
type ServerField = "given_names" | "family_names" | "email" | "phone" | "identity_document_number" | "teacher_id" | "password";

const STEPS = ["Tus datos", "Verifica tu correo", "Pago"];

function Steps({ current }: { current: number }) {
  return <ol className="mb-5 grid grid-cols-3 gap-2 text-xs font-semibold sm:text-sm">
    {STEPS.map((label, index) => <li key={label} aria-current={index === current ? "step" : undefined} className={clsx("flex items-center gap-2 border-t-4 pt-2", index <= current ? "border-emerald-500 text-emerald-300" : "border-white/10 text-slate-500")}>
      <span className="hidden sm:inline">{index + 1}.</span>{label}
    </li>)}
  </ol>;
}

interface FirstCode { delivery: EmailCodeDelivery | null; error: string }

function VerifyEmail({ registration, firstCode, onVerified, onBack }: { registration: ValidatedRegistration; firstCode: FirstCode; onVerified: () => void; onBack: () => void }) {
  const [delivery, setDelivery] = useState<EmailCodeDelivery | null>(firstCode.delivery);
  const [code, setCode] = useState("");
  const [error, setError] = useState(firstCode.error);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const waitSeconds = delivery ? secondsUntil(delivery.resend_available_at, now) : 0;

  const verify = async () => {
    try {
      setBusy(true); setError(""); setNotice("");
      await validateRegistrationCode(registration.registration_id, code);
      onVerified();
    } catch (reason) {
      const normalized = await normalizeError(reason);
      const attemptsLeft = (normalized.details as { attempts_left?: number } | undefined)?.attempts_left;
      setError(attemptsLeft === undefined ? normalized.message : `${normalized.message} Te quedan ${attemptsLeft} intentos.`);
    } finally { setBusy(false); }
  };
  const resend = async () => {
    try {
      setBusy(true); setError(""); setNotice("");
      const firstSend = !delivery;
      setDelivery(await requestRegistrationCode(registration.registration_id));
      setCode("");
      setNotice(firstSend ? "Te enviamos el código." : "Te enviamos un código nuevo.");
    } catch (reason) { setError((await normalizeError(reason)).message); }
    finally { setBusy(false); }
  };

  return <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void verify(); }}>
    <div>
      <h2 className="text-lg font-semibold text-slate-50">Revisa tu correo</h2>
      {delivery
        ? <p className="text-sm text-slate-400">Enviamos un código de 6 dígitos a <strong>{delivery.email}</strong>. Vence en 10 minutos. Si no lo ves, revisa la carpeta de spam.</p>
        : <p className="text-sm text-slate-400">Tus datos están guardados, pero no pudimos enviar el código a <strong>{registration.email}</strong>. Vuelve a intentarlo con "Enviar código".</p>}
    </div>
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="success">{notice}</Alert>}
    <Field label="Código de verificación">
      <Input value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="max-w-48 text-center text-lg tracking-[0.4em]"
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
    </Field>
    <Button disabled={busy || code.length !== 6}>{busy ? "Verificando…" : "Verificar correo"}</Button>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <button type="button" className="font-semibold text-emerald-400 hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-slate-500" disabled={busy || waitSeconds > 0} onClick={() => void resend()}>
        {waitSeconds > 0 ? `Reenviar código en ${waitSeconds} s` : delivery ? "Reenviar código" : "Enviar código"}
      </button>
      <button type="button" className="font-semibold text-slate-400 hover:text-slate-100" onClick={onBack}>Corregir mis datos</button>
    </div>
  </form>;
}

export function SignUpPage() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [registration, setRegistration] = useState<ValidatedRegistration | null>(null);
  const [firstCode, setFirstCode] = useState<FirstCode>({ delivery: null, error: "" });
  const [formError, setFormError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const plan = findPlan(searchParams.get("plan"));
  const toast = useToast();
  const auth = useAuth();
  // Correo y contraseña del registro en curso: solo en memoria, para entrar al confirmarse el pago.
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const teachers = useQuery({ queryKey: ["registration-teachers"], queryFn: listRegistrationTeachers });
  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      given_names: "", family_names: "", email: "", phone: "", identity_document_type: "DNI", identity_document_number: "",
      teacher_id: "", password: "", password_confirmation: "", accepted_terms: false,
    },
  });
  const password = useWatch({ control, name: "password" });
  const passwordConfirmation = useWatch({ control, name: "password_confirmation" });
  const teacherId = useWatch({ control, name: "teacher_id" });

  useEffect(() => {
    if (teachers.error) toast.error("No se pudo cargar la lista de grupos. Recarga la página.");
  }, [teachers.error, toast]);

  const submit = handleSubmit(async (values) => {
    setFormError("");
    try {
      const validated = await validateStudentRegistration({
        teacher_id: values.teacher_id,
        given_names: values.given_names,
        family_names: values.family_names,
        email: values.email,
        phone: values.phone,
        identity_document_type: values.identity_document_type,
        identity_document_number: normalizeIdentityDocument(values.identity_document_number),
        password: values.password,
        accepted_terms: values.accepted_terms,
        // Si volvió a corregir sus datos, el registro anterior se reemplaza.
        replaces_registration_id: registration?.registration_id,
      });
      setCredentials({ email: values.email, password: values.password });
      // Los datos ya quedaron guardados: si el correo falla, se reintenta desde
      // el paso de verificación sin volver a llenar el formulario.
      let next: FirstCode = { delivery: null, error: "" };
      try { next = { delivery: await requestRegistrationCode(validated.registration_id), error: "" }; }
      catch (sendReason) { next = { delivery: null, error: (await normalizeError(sendReason)).message }; }
      setRegistration(validated);
      setFirstCode(next);
      setStep(1);
      window.scrollTo({ top: 0 });
    } catch (reason) {
      const error = await normalizeError(reason);
      const details = error.details as { field?: ServerField } | undefined;
      if (details?.field && details.field in values) {
        setError(details.field, { message: error.code === "validation_error" ? SERVER_FIELD_MESSAGES[details.field] ?? error.message : error.message }, { shouldFocus: true });
      } else setFormError(error.message);
    }
  });

  // Con el pago confirmado la cuenta ya existe: entra directo y ofrece guardar
  // las credenciales. Si el login falla, el login muestra "Pago confirmado".
  const enterAfterPayment = async () => {
    try {
      if (!credentials) throw new Error("Sin credenciales en memoria.");
      void saveCredentials(credentials.email, credentials.password);
      await auth.login(credentials.email, credentials.password, "student");
      navigate("/estudiante", { replace: true });
    } catch {
      navigate("/estudiante/login?pago=confirmado", { replace: true });
    }
  };

  return <AuthLayout dark wide cover={{ title: "Empieza a prepararte hoy", description: "Practica con las preguntas de tu grupo y recibe la explicación de cada respuesta al instante." }} action={<Link
    to="/estudiante/login"
    className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400 hover:bg-white/5"
  ><LogIn className="h-4 w-4" aria-hidden />Iniciar sesión</Link>}>
    <div className="mb-4">
      <h1 className="font-display text-2xl font-semibold tracking-wide text-slate-50">Crea tu cuenta</h1>
    </div>
    <div className="mb-4"><PlanPicker plan={plan} onChange={(id) => setSearchParams({ plan: id }, { replace: true })} /></div>
    <Steps current={step} />
    {step === 2 && registration && <PaymentPanel plan={plan}
      createPayment={(planId, yape) => createRegistrationPayment(registration.registration_id, planId, yape)}
      fetchStatus={getRegistrationPaymentStatus}
      onPaid={() => void enterAfterPayment()}
      unavailableNote={`Guardamos tus datos durante ${PENDING_HOURS} horas para que completes el pago. Si no se completa, los eliminamos.`} />}
    {step === 1 && registration && <VerifyEmail key={registration.registration_id} registration={registration} firstCode={firstCode} onVerified={() => setStep(2)} onBack={() => setStep(0)} />}
    {step === 0 && <form onSubmit={submit} className="grid gap-4" noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombres" hideLabel error={errors.given_names?.message}><Input variant="soft" icon={<User size={20} />} placeholder="Nombres" autoComplete="given-name" {...register("given_names")} /></Field>
        <Field label="Apellidos" hideLabel error={errors.family_names?.message}><Input variant="soft" placeholder="Apellidos" autoComplete="family-name" {...register("family_names")} /></Field>
        <Field label="Correo electrónico" hideLabel error={errors.email?.message}><Input variant="soft" icon={<Mail size={20} />} type="email" placeholder="tu@correo.com" autoComplete="username" {...register("email")} /></Field>
        <Field label="Celular" hideLabel error={errors.phone?.message}><Input variant="soft" icon={<Phone size={20} />} type="tel" placeholder="Celular" autoComplete="tel" {...register("phone")} /></Field>
        <div className="grid grid-cols-[8.5rem_1fr] gap-2">
          <Field label="Tipo de documento" hideLabel><Select variant="soft" {...register("identity_document_type")}>{DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <Field label="Número de documento" hideLabel error={errors.identity_document_number?.message}><Input variant="soft" placeholder="Nro. de documento" autoComplete="off" {...register("identity_document_number")} /></Field>
        </div>
        <Field label="Grupo" hideLabel error={errors.teacher_id?.message}>
          {/* Cada grupo es un profesor; sin grupo elegido, el select se ve como placeholder. */}
          <Select variant="soft" icon={<Users size={20} />} disabled={!teachers.data} className={clsx(!teacherId && "text-slate-500", "[&>option]:text-slate-100")} {...register("teacher_id")}>
            <option value="">{teachers.isPending ? "Cargando grupos..." : "Selecciona tu grupo"}</option>
            {teachers.data?.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
          </Select>
        </Field>
      </div>
      <p className="-mb-2 text-sm text-slate-400">Con tu <strong>correo</strong> y esta <strong>contraseña</strong> ingresarás a Chancón.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contraseña" hideLabel error={errors.password?.message}><PasswordInput variant="soft" icon={<LockKeyhole size={20} />} placeholder="Contraseña" autoComplete="new-password" {...register("password")} /></Field>
        <Field label="Repite tu contraseña" hideLabel error={errors.password_confirmation?.message}><PasswordInput variant="soft" icon={<LockKeyhole size={20} />} placeholder="Repite tu contraseña" autoComplete="new-password" {...register("password_confirmation")} /></Field>
      </div>
      {/* Las reglas aparecen cuando empieza a escribir alguna de las contraseñas. */}
      {(password || passwordConfirmation) && <PasswordChecklist password={password} />}

      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-500" {...register("accepted_terms")} />
        <span>Acepto los <Link className="font-semibold text-emerald-400 hover:text-emerald-300" to="/terminos" target="_blank">términos y condiciones</Link> y la <Link className="font-semibold text-emerald-400 hover:text-emerald-300" to="/privacidad" target="_blank">política de privacidad</Link>.</span>
      </label>
      {errors.accepted_terms && <span className="text-xs text-rose-400">{errors.accepted_terms.message}</span>}

      <Button disabled={isSubmitting}>{isSubmitting ? "Validando tus datos…" : "Continuar"}</Button>
    </form>}
  </AuthLayout>;
}
