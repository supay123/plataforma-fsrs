import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Mail, Phone, School, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Card, Field, Input, Select, Spinner } from "../../components/ui";
import { useToast } from "../../components/ui/use-toast";
import { normalizeError } from "../../lib/api/errors";
import { secondsUntil, useNow } from "../../lib/use-now";
import { useAuth } from "../auth/AuthProvider";
import { DOCUMENT_TYPES } from "../complaints/model";
import { SERVER_FIELD_MESSAGES, documentIsValid, documentIssue, studentFields } from "../registration/fields";
import { normalizeIdentityDocument } from "../registration/rules";
import {
  accountProfileQueryKey, cancelPasswordReset, confirmEmailChange, getAccountProfile, requestEmailChange, requestPasswordReset, updateAccountProfile,
  type AccountProfile, type EmailChangeDelivery, type PasswordResetDelivery,
} from "./api";

// La institución no se edita aquí. El correo puede quedar vacío en cuentas creadas por el administrador.
const schema = z.object(studentFields).omit({ college_id: true })
  .extend({ email: studentFields.email.or(z.literal("")) })
  .refine(documentIsValid, documentIssue);
type Values = z.infer<typeof schema>;
const PROFILE_FIELDS = ["given_names", "family_names", "phone", "identity_document_type", "identity_document_number"] as const;

function formValues(profile: AccountProfile): Values {
  return {
    given_names: profile.given_names ?? "",
    family_names: profile.family_names ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    identity_document_type: profile.identity_document_type ?? "DNI",
    identity_document_number: profile.identity_document_number ?? "",
  };
}

const SAVED = "Guardamos correctamente tus datos";
const SAVE_FAILED = "Hubo un error al guardar tus datos";

/** El campo que rechazó el endpoint y por qué, para mostrarlo junto a ese campo. */
async function fieldError(reason: unknown) {
  const error = await normalizeError(reason);
  const field = (error.details as { field?: string } | undefined)?.field;
  const message = error.code === "validation_error" && field ? SERVER_FIELD_MESSAGES[field] ?? error.message : error.message;
  return { field, message };
}

function EmailVerification({ delivery, newEmail, onResent, onVerified, onCancel }: {
  delivery: EmailChangeDelivery; newEmail: string; onResent: (delivery: EmailChangeDelivery) => void;
  onVerified: (email: string) => void; onCancel: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const waitSeconds = secondsUntil(delivery.resend_available_at, now);

  const verify = async () => {
    try {
      setBusy(true); setError("");
      onVerified((await confirmEmailChange(code)).email);
    } catch (reason) {
      const normalized = await normalizeError(reason);
      const attemptsLeft = (normalized.details as { attempts_left?: number } | undefined)?.attempts_left;
      setError(attemptsLeft === undefined ? normalized.message : `${normalized.message} Te quedan ${attemptsLeft} intentos.`);
    } finally { setBusy(false); }
  };
  const resend = async () => {
    try {
      setBusy(true); setError("");
      onResent(await requestEmailChange(newEmail));
      setCode("");
    } catch (reason) { toast.error((await normalizeError(reason)).message); }
    finally { setBusy(false); }
  };

  return <form className="grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4" onSubmit={(event) => { event.preventDefault(); void verify(); }}>
    <p className="text-sm text-slate-700">Enviamos un código de 6 dígitos a <strong>{delivery.email}</strong>. Tu correo cambiará cuando lo verifiques. Vence en 10 minutos.</p>
    {error && <Alert tone="error">{error}</Alert>}
    <Field label="Código de verificación">
      <Input value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="max-w-48 text-center text-lg tracking-[0.4em]"
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
    </Field>
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={busy || code.length !== 6}>{busy ? "Verificando…" : "Verificar correo"}</Button>
      <button type="button" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:text-slate-400" disabled={busy || waitSeconds > 0} onClick={() => void resend()}>
        {waitSeconds > 0 ? `Reenviar código en ${waitSeconds} s` : "Reenviar código"}
      </button>
      <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
    </div>
  </form>;
}

function ProfileForm({ profile }: { profile: AccountProfile }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();
  const [notice, setNotice] = useState("");
  const [emailChange, setEmailChange] = useState<{ email: string; delivery: EmailChangeDelivery } | null>(null);
  const { register, handleSubmit, reset, resetField, setError, formState: { errors, isSubmitting, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema), mode: "onTouched", defaultValues: formValues(profile),
  });
  const submit = handleSubmit(async (values) => {
    setNotice("");
    const current = formValues(profile);
    const profileChanged = PROFILE_FIELDS.some((field) => values[field].trim() !== current[field].trim());
    const newEmail = values.email.trim().toLowerCase();
    const emailChanged = newEmail !== "" && newEmail !== current.email.toLowerCase();
    try {
      if (profileChanged) {
        const updated = await updateAccountProfile({
          given_names: values.given_names,
          family_names: values.family_names,
          phone: values.phone,
          identity_document_type: values.identity_document_type,
          identity_document_number: normalizeIdentityDocument(values.identity_document_number),
        });
        queryClient.setQueryData(accountProfileQueryKey, updated);
        reset(formValues(updated));
        void refreshProfile();
        toast.success(SAVED);
      }
      if (emailChanged) {
        setEmailChange({ email: newEmail, delivery: await requestEmailChange(newEmail) });
        reset({ ...values, email: current.email });
      }
    } catch (reason) {
      toast.error(SAVE_FAILED);
      const { field, message } = await fieldError(reason);
      if (field && field in values) setError(field as keyof Values, { message }, { shouldFocus: true });
    }
  });

  const onEmailVerified = (email: string) => {
    setEmailChange(null);
    resetField("email", { defaultValue: email });
    queryClient.setQueryData<AccountProfile>(accountProfileQueryKey, (old) => old && { ...old, email });
    setNotice(`Listo. Desde ahora inicia sesión con ${email}.`);
  };

  return <div className="grid gap-4">
    {notice && <Alert tone="success">{notice}</Alert>}
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombres" hideLabel error={errors.given_names?.message}><Input variant="soft" icon={<User size={20} />} placeholder="Nombres" autoComplete="given-name" {...register("given_names")} /></Field>
        <Field label="Apellidos" hideLabel error={errors.family_names?.message}><Input variant="soft" placeholder="Apellidos" autoComplete="family-name" {...register("family_names")} /></Field>
        <Field label="Correo electrónico" hideLabel error={errors.email?.message}><Input variant="soft" icon={<Mail size={20} />} type="email" placeholder="tu@correo.com" autoComplete="email" readOnly={Boolean(emailChange)} {...register("email")} /></Field>
        <Field label="Celular" hideLabel error={errors.phone?.message}><Input variant="soft" icon={<Phone size={20} />} type="tel" placeholder="Celular" autoComplete="tel" {...register("phone")} /></Field>
        <div className="grid grid-cols-[8.5rem_1fr] gap-2">
          <Field label="Tipo de documento" hideLabel><Select variant="soft" {...register("identity_document_type")}>{DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <Field label="Número de documento" hideLabel error={errors.identity_document_number?.message}><Input variant="soft" placeholder="Nro. de documento" autoComplete="off" {...register("identity_document_number")} /></Field>
        </div>
        {/* Solo lectura: la institución la cambia el administrador. */}
        <Field label="Institución" hideLabel>
          <Input variant="soft" icon={<School size={20} />} readOnly value={profile.college_name ?? ""} placeholder="Institución" className="cursor-default read-only:text-slate-500 read-only:focus:border-indigo-100 read-only:focus:bg-indigo-50/50 read-only:focus:ring-0" />
        </Field>
      </div>
      <div><Button disabled={isSubmitting || !isDirty}>{isSubmitting ? "Guardando…" : "Guardar cambios"}</Button></div>
    </form>
    {emailChange && <EmailVerification delivery={emailChange.delivery} newEmail={emailChange.email}
      onResent={(delivery) => setEmailChange({ ...emailChange, delivery })} onVerified={onEmailVerified} onCancel={() => setEmailChange(null)} />}
  </div>;
}

function PasswordReset({ hasEmail }: { hasEmail: boolean }) {
  const toast = useToast();
  const [delivery, setDelivery] = useState<PasswordResetDelivery | null>(null);
  const [busy, setBusy] = useState<"send" | "cancel" | null>(null);
  const now = useNow();
  const waitSeconds = delivery ? secondsUntil(delivery.resend_available_at, now) : 0;

  const send = async () => {
    try {
      setBusy("send");
      setDelivery(await requestPasswordReset());
    } catch (reason) { toast.error((await normalizeError(reason)).message); }
    finally { setBusy(null); }
  };
  // Por si se pidió por error: el link enviado deja de servir.
  const cancel = async () => {
    try {
      setBusy("cancel");
      await cancelPasswordReset();
      setDelivery(null);
      toast.success("Anulamos el link que te enviamos.");
    } catch {
      toast.error("No pudimos anular el link. Inténtalo de nuevo.");
    }
    finally { setBusy(null); }
  };

  return <div className="grid gap-3">
    <p className="text-sm text-slate-600">Te enviaremos a tu correo un link para crear una nueva contraseña. El link vence en 1 hora y solo se puede usar una vez. Al cambiarla, se cerrará tu sesión en todos tus dispositivos.</p>
    {!hasEmail && <Alert>Agrega un correo a tu perfil para poder restablecer tu contraseña.</Alert>}
    {delivery && <Alert tone="success">Te enviamos el link a <strong>{delivery.email}</strong>. Si no lo ves, revisa la carpeta de spam.</Alert>}
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="secondary" disabled={!hasEmail || Boolean(busy) || waitSeconds > 0} onClick={() => void send()}>
        <KeyRound size={16} className="mr-2" />
        {busy === "send" ? "Enviando…" : waitSeconds > 0 ? `Reenviar link en ${waitSeconds} s` : delivery ? "Reenviar link" : "Restablecer contraseña"}
      </Button>
      {delivery && <Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => void cancel()}>{busy === "cancel" ? "Cancelando…" : "Cancelar"}</Button>}
    </div>
  </div>;
}

/** Perfil del estudiante: sus datos y el cambio de contraseña por correo. */
export function ProfileSection() {
  const toast = useToast();
  const account = useQuery({ queryKey: accountProfileQueryKey, queryFn: getAccountProfile });

  useEffect(() => {
    if (account.error) toast.error("No se pudo cargar tu perfil. Recarga la página.");
  }, [account.error, toast]);

  if (!account.data) return account.isPending ? <Spinner /> : null;
  return <div className="grid gap-6">
    <Card>
      <h2 className="font-bold">Mi perfil</h2>
      <p className="mt-1 text-sm text-slate-600">Si cambias tu correo, te enviaremos un código para verificarlo.</p>
      <div className="mt-4"><ProfileForm profile={account.data} /></div>
    </Card>
    <Card>
      <h2 className="font-bold">Contraseña</h2>
      <div className="mt-2"><PasswordReset hasEmail={Boolean(account.data.email)} /></div>
    </Card>
  </div>;
}
