import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { LockKeyhole, Mail, Phone, School, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AuthLayout } from "../../components/layout/AuthLayout";
import { Button, Field, Input, PasswordInput, Select, Spinner } from "../../components/ui";
import { useToast } from "../../components/ui/use-toast";
import { DOCUMENT_TYPES } from "../../features/complaints/model";
import { acceptStudentInvitation, checkStudentInvitation, type StudentInvitation } from "../../features/invitations/api";
import {
  SERVER_FIELD_MESSAGES, documentIsValid, documentIssue, passwordFields, passwordMismatchIssue, passwordsMatch, studentFields,
} from "../../features/registration/fields";
import { PasswordChecklist } from "../../features/registration/PasswordChecklist";
import { normalizeIdentityDocument } from "../../features/registration/rules";
import { normalizeError, type AppError } from "../../lib/api/errors";
import { formatDay } from "../../lib/dates";

// El correo y la institución los fija la invitación; el estudiante completa el resto.
const schema = z.object({
  ...studentFields,
  ...passwordFields,
  accepted_terms: z.boolean().refine((value) => value, "Debes aceptar los términos y la política de privacidad."),
}).omit({ email: true, college_id: true })
  .refine(documentIsValid, documentIssue)
  .refine(passwordsMatch, passwordMismatchIssue);
type Values = z.infer<typeof schema>;

function InvalidInvitation() {
  return <div className="grid justify-items-center gap-3 text-center">
    <h1 className="text-2xl font-bold">Esta invitación no es válida</h1>
    <p className="text-sm text-slate-600">El link no es válido, ya se usó o venció. Pide al administrador de tu institución que te la reenvíe.</p>
    <Link to="/estudiante/login" className="mt-2 font-semibold text-indigo-600 hover:text-indigo-800">Ir al inicio de sesión</Link>
  </div>;
}

function AcceptForm({ code, invitation, onInvalid }: { code: string; invitation: StudentInvitation; onInvalid: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      given_names: "", family_names: "", phone: "", identity_document_type: "DNI", identity_document_number: "",
      password: "", password_confirmation: "", accepted_terms: false,
    },
  });
  const password = useWatch({ control, name: "password" });
  const passwordConfirmation = useWatch({ control, name: "password_confirmation" });

  const submit = handleSubmit(async (values) => {
    try {
      await acceptStudentInvitation({
        code,
        given_names: values.given_names,
        family_names: values.family_names,
        phone: values.phone,
        identity_document_type: values.identity_document_type,
        identity_document_number: normalizeIdentityDocument(values.identity_document_number),
        password: values.password,
        accepted_terms: values.accepted_terms,
      });
      navigate("/estudiante/login?invitacion=aceptada", { replace: true });
    } catch (reason) {
      const error = await normalizeError(reason);
      if (error.code === "invalid_invitation") return onInvalid();
      const field = (error.details as { field?: keyof Values } | undefined)?.field;
      if (field && field in values) {
        setError(field, { message: error.code === "validation_error" ? SERVER_FIELD_MESSAGES[field] ?? error.message : error.message }, { shouldFocus: true });
      } else toast.error(error.message);
    }
  });

  return <>
    <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
    <p className="mt-2 text-sm text-slate-600">{invitation.college_name} te invitó a Chancón. Tu acceso es del {formatDay(invitation.access_valid_from)} al {formatDay(invitation.access_valid_until)}.</p>
    <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Correo electrónico" hideLabel><Input variant="soft" icon={<Mail size={20} />} readOnly value={invitation.email} className="cursor-default read-only:text-slate-500 read-only:focus:border-indigo-100 read-only:focus:bg-indigo-50/50 read-only:focus:ring-0" /></Field>
        <Field label="Institución" hideLabel><Input variant="soft" icon={<School size={20} />} readOnly value={invitation.college_name ?? ""} className="cursor-default read-only:text-slate-500 read-only:focus:border-indigo-100 read-only:focus:bg-indigo-50/50 read-only:focus:ring-0" /></Field>
        <Field label="Nombres" hideLabel error={errors.given_names?.message}><Input variant="soft" icon={<User size={20} />} placeholder="Nombres" autoComplete="given-name" {...register("given_names")} /></Field>
        <Field label="Apellidos" hideLabel error={errors.family_names?.message}><Input variant="soft" placeholder="Apellidos" autoComplete="family-name" {...register("family_names")} /></Field>
        <Field label="Celular" hideLabel error={errors.phone?.message}><Input variant="soft" icon={<Phone size={20} />} type="tel" placeholder="Celular" autoComplete="tel" {...register("phone")} /></Field>
        <div className="grid grid-cols-[8.5rem_1fr] gap-2">
          <Field label="Tipo de documento" hideLabel><Select variant="soft" {...register("identity_document_type")}>{DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <Field label="Número de documento" hideLabel error={errors.identity_document_number?.message}><Input variant="soft" placeholder="Nro. de documento" autoComplete="off" {...register("identity_document_number")} /></Field>
        </div>
        <Field label="Contraseña" hideLabel error={errors.password?.message}><PasswordInput variant="soft" icon={<LockKeyhole size={20} />} placeholder="Contraseña" autoComplete="new-password" {...register("password")} /></Field>
        <Field label="Repite tu contraseña" hideLabel error={errors.password_confirmation?.message}><PasswordInput variant="soft" icon={<LockKeyhole size={20} />} placeholder="Repite tu contraseña" autoComplete="new-password" {...register("password_confirmation")} /></Field>
      </div>
      {(password || passwordConfirmation) && <PasswordChecklist password={password} />}
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" {...register("accepted_terms")} />
        <span>Acepto los <Link className="font-semibold text-indigo-600 hover:text-indigo-800" to="/terminos" target="_blank">términos y condiciones</Link> y la <Link className="font-semibold text-indigo-600 hover:text-indigo-800" to="/privacidad" target="_blank">política de privacidad</Link>.</span>
      </label>
      {errors.accepted_terms && <span className="text-xs text-rose-600">{errors.accepted_terms.message}</span>}
      <Button disabled={isSubmitting}>{isSubmitting ? "Creando tu cuenta…" : "Crear mi cuenta"}</Button>
    </form>
  </>;
}

/** Página del link de invitación: el estudiante completa sus datos y crea su cuenta. */
export function InvitationPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const toast = useToast();
  const [usedOrInvalid, setUsedOrInvalid] = useState(false);
  const check = useQuery({
    queryKey: ["student-invitation", code],
    queryFn: () => checkStudentInvitation(code),
    enabled: Boolean(code),
    retry: false,
    staleTime: Infinity,
  });
  const invalid = !code || usedOrInvalid || (check.error as AppError | null)?.code === "invalid_invitation";
  // Otro error (por ejemplo, sin conexión) no significa que la invitación sea inválida.
  const failed = check.isError && !invalid;

  useEffect(() => {
    if (failed) toast.error(check.error.message);
  }, [failed, check.error, toast]);

  return <AuthLayout wide={!invalid && Boolean(check.data)}>
    {invalid
      ? <InvalidInvitation />
      : failed
        ? <Button type="button" className="w-full" onClick={() => void check.refetch()}>Reintentar</Button>
        : check.data ? <AcceptForm code={code} invitation={check.data} onInvalid={() => setUsedOrInvalid(true)} /> : <Spinner />}
  </AuthLayout>;
}
