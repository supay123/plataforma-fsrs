import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Card, Field, Input, Select } from "../../components/ui";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { normalizeError } from "../../lib/api/errors";
import { secondsUntil, useNow } from "../../lib/use-now";
import type { PasswordResetDelivery } from "../account/api";
import { DOCUMENT_TYPES } from "../complaints/model";
import { listRegistrationTeachers } from "../registration/api";
import { SERVER_FIELD_MESSAGES, documentIsValid, documentIssue, studentFields } from "../registration/fields";
import { normalizeIdentityDocument } from "../registration/rules";
import {
  cancelStudentPasswordReset, requestStudentPasswordReset, studentProfileQueryKey, updateStudentEmail, updateStudentGroup,
  updateStudentProfile, updateUser, type AdminStudentProfile,
} from "./api";

interface StudentUser { id: string; full_name: string; user_code: string; is_active: boolean }

const PROFILE_FIELDS = ["given_names", "family_names", "phone", "identity_document_type", "identity_document_number"] as const;
const userCode = z.string().trim().min(1, "Ingresa el código de acceso.");
const { given_names, family_names, email, phone, identity_document_type, identity_document_number } = studentFields;
// El correo es obligatorio si ya tenía uno; en cuentas creadas por el administrador puede seguir vacío.
const emailField = (required: boolean) => required ? email : email.or(z.literal(""));
const fullSchema = (emailRequired: boolean) => z.object({
  given_names, family_names, phone, identity_document_type, identity_document_number,
  email: emailField(emailRequired), teacher_id: z.string(), user_code: userCode,
}).refine(documentIsValid, documentIssue);
// Mismos campos sin reglas para los datos del perfil: se validan solo si cambiaron.
const partialSchema = (emailRequired: boolean) => z.object({
  given_names: z.string(), family_names: z.string(), phone: z.string(), identity_document_type,
  identity_document_number: z.string(), email: emailField(emailRequired), teacher_id: z.string(), user_code: userCode,
});
type Values = z.infer<ReturnType<typeof fullSchema>>;

/** Grupo actual: el profesor de sus cursos activos. Con varios o ninguno no hay uno solo que preseleccionar. */
const currentTeacherId = (profile: AdminStudentProfile) => profile.group_teacher_ids.length === 1 ? profile.group_teacher_ids[0]! : "";

function formValues(profile: AdminStudentProfile, code: string): Values {
  return {
    given_names: profile.given_names ?? "",
    family_names: profile.family_names ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    identity_document_type: profile.identity_document_type ?? "DNI",
    identity_document_number: profile.identity_document_number ?? "",
    teacher_id: currentTeacherId(profile),
    user_code: code,
  };
}

/**
 * Todos los datos del estudiante, con las mismas reglas que su propio perfil.
 * Los datos del perfil solo se validan si cambiaron: así se puede cambiar el
 * código, el correo o el grupo de una cuenta creada por el administrador sin
 * completar su perfil. Antes de guardar se advierte cómo le afecta cada cambio.
 */
export function StudentDataCard({ user, profile, className }: { user: StudentUser; profile: AdminStudentProfile; className?: string }) {
  const toast = useToast();
  const modal = useModal();
  const client = useQueryClient();
  const teachers = useQuery({ queryKey: ["registration-teachers"], queryFn: listRegistrationTeachers });
  const initial = formValues(profile, user.user_code);
  const emailRequired = Boolean(profile.email);
  const profileChanged = (values: Values) => PROFILE_FIELDS.some((field) => values[field].trim() !== initial[field].trim());
  const newEmail = (values: Values) => {
    const value = values.email.trim().toLowerCase();
    return value && value !== initial.email.toLowerCase() ? value : null;
  };
  const newTeacher = (values: Values) => values.teacher_id && values.teacher_id !== initial.teacher_id
    ? teachers.data?.find((teacher) => teacher.id === values.teacher_id) ?? null
    : null;
  const resolver: Resolver<Values> = (values, context, options) =>
    zodResolver(profileChanged(values) ? fullSchema(emailRequired) : partialSchema(emailRequired))(values, context, options);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting, isDirty } } = useForm<Values>({
    resolver, mode: "onTouched", defaultValues: initial,
  });

  // Cada cambio va a su endpoint. Si uno falla, los anteriores ya quedaron guardados y se recargan.
  const save = async (values: Values) => {
    const code = values.user_code.trim();
    const email = newEmail(values);
    const teacher = newTeacher(values);
    try {
      if (profileChanged(values)) {
        await updateStudentProfile({
          user_id: user.id,
          given_names: values.given_names,
          family_names: values.family_names,
          phone: values.phone,
          identity_document_type: values.identity_document_type,
          identity_document_number: normalizeIdentityDocument(values.identity_document_number),
        });
      }
      if (email) await updateStudentEmail({ user_id: user.id, email });
      if (teacher) await updateStudentGroup({ user_id: user.id, teacher_id: teacher.id });
      if (code !== user.user_code) await updateUser({ user_id: user.id, user_code: code });
      reset({ ...values, email: email ?? values.email, user_code: code });
      toast.success("Guardamos los datos del estudiante.");
    } catch (reason) {
      const error = await normalizeError(reason);
      const field = (error.details as { field?: string } | undefined)?.field;
      toast.error(error.message);
      if (field && field in values) {
        setError(field as keyof Values, { message: error.code === "validation_error" ? SERVER_FIELD_MESSAGES[field] ?? error.message : error.message }, { shouldFocus: true });
      }
    } finally {
      void client.invalidateQueries({ queryKey: studentProfileQueryKey(user.id) });
      void client.invalidateQueries({ queryKey: ["users"] });
    }
  };

  const submit = handleSubmit((values) => {
    const code = values.user_code.trim();
    const email = newEmail(values);
    const teacher = newTeacher(values);
    modal.warning({
      title: "Guardar cambios",
      confirmLabel: "Guardar cambios",
      body: <>
        <p>Estos cambios afectan directamente a {user.full_name}:</p>
        <ul className="mt-2 grid list-disc gap-2 pl-5">
          {profileChanged(values) && <li>Se actualizarán sus datos personales.</li>}
          {email && <li>
            <strong>Su correo cambiará {initial.email ? <>de {initial.email} </> : null}a {email}, sin verificación.</strong> Desde ahora podrá iniciar sesión con ese correo y ahí recibirá los avisos.
            {initial.email && <> Se anularán los links o códigos enviados al correo anterior.</>}
          </li>}
          {teacher && <li>
            <strong>Pasará {profile.group_name ? <>del grupo de {profile.group_name} </> : null}al grupo de {teacher.name} ({teacher.college_name}).</strong> Dejará los cursos de su grupo actual y quedará inscrito en los de {teacher.name}.
            {" "}<strong>Su progreso en los cursos que deja se borrará en 7 días</strong>, salvo que vuelva a ellos antes.
          </li>}
          {code !== user.user_code && <li><strong>El código cambiará de {user.user_code} a {code}.</strong> Deberá usar el nuevo código para iniciar sesión.</li>}
        </ul>
      </>,
      onConfirm: () => save(values),
    });
  });

  // El grupo actual puede no estar en la lista (por ejemplo, si el profesor ya no tiene cursos).
  const teacherOptions = teachers.data ?? [];
  const currentMissing = initial.teacher_id !== "" && !teacherOptions.some((teacher) => teacher.id === initial.teacher_id);

  return <Card className={className}>
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-bold">Datos del usuario</h2>
      <Badge tone={user.is_active ? "success" : "warning"}>{user.is_active ? "Activo" : "Inactivo"}</Badge>
    </div>
    <form className="grid gap-4" onSubmit={submit} noValidate>
      {/* 1 columna en móvil, 2 en tablet, 3 y 4 cuando la tarjeta ocupa todo el ancho. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Field label="Nombres" error={errors.given_names?.message}><Input autoComplete="off" {...register("given_names")} /></Field>
        <Field label="Apellidos" error={errors.family_names?.message}><Input autoComplete="off" {...register("family_names")} /></Field>
        <Field label="Correo electrónico" error={errors.email?.message}>
          <Input type="email" autoComplete="off" placeholder="Sin correo registrado" {...register("email")} />
        </Field>
        <Field label="Celular" error={errors.phone?.message}><Input type="tel" autoComplete="off" {...register("phone")} /></Field>
        <Field label="Tipo de documento"><Select {...register("identity_document_type")}>{DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
        <Field label="Número de documento" error={errors.identity_document_number?.message}><Input autoComplete="off" {...register("identity_document_number")} /></Field>
        <Field label="Grupo" error={errors.teacher_id?.message}>
          <Select disabled={teachers.isPending} {...register("teacher_id")}>
            {initial.teacher_id === "" && <option value="" disabled>{profile.group_name ? `${profile.group_name} (varios grupos)` : "Sin grupo asignado"}</option>}
            {currentMissing && <option value={initial.teacher_id}>{profile.group_name}</option>}
            {teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} — {teacher.college_name}</option>)}
          </Select>
        </Field>
        <Field label="Código de acceso" error={errors.user_code?.message}><Input autoComplete="off" {...register("user_code")} /></Field>
      </div>
      <Button disabled={isSubmitting || !isDirty}>{isSubmitting ? "Guardando…" : "Guardar cambios"}</Button>
    </form>
  </Card>;
}

/** Envía al correo del estudiante el link para crear una nueva contraseña, como desde su perfil. */
export function StudentPasswordResetCard({ user, email }: { user: StudentUser; email: string }) {
  const toast = useToast();
  const modal = useModal();
  const [delivery, setDelivery] = useState<PasswordResetDelivery | null>(null);
  const [busy, setBusy] = useState<"send" | "cancel" | null>(null);
  const now = useNow();
  const waitSeconds = delivery ? secondsUntil(delivery.resend_available_at, now) : 0;

  const send = async () => {
    try {
      setBusy("send");
      setDelivery(await requestStudentPasswordReset(user.id));
    } catch (reason) { toast.error((await normalizeError(reason)).message); }
    finally { setBusy(null); }
  };
  // Por si se envió por error: el link deja de servir.
  const cancel = async () => {
    try {
      setBusy("cancel");
      await cancelStudentPasswordReset(user.id);
      setDelivery(null);
      toast.success("Anulamos el link enviado.");
    } catch (reason) { toast.error((await normalizeError(reason)).message); }
    finally { setBusy(null); }
  };

  return <Card>
    <h2 className="font-bold">Credenciales</h2>
    <p className="mt-1 text-sm text-slate-600">
      Se enviará a <strong>{email}</strong> un link para crear una nueva contraseña. El link vence en 1 hora y solo se puede usar una vez. Al cambiarla, se cerrará su sesión en todos sus dispositivos.
    </p>
    {delivery && <div className="mt-3"><Alert tone="success">Enviamos el link a <strong>{delivery.email}</strong>. Pídele que revise también la carpeta de spam.</Alert></div>}
    <div className="mt-4 flex flex-wrap gap-3">
      <Button type="button" variant="secondary" disabled={Boolean(busy) || waitSeconds > 0} onClick={() => modal.warning({
        title: "Restablecer contraseña",
        confirmLabel: "Enviar link",
        body: <p>Se enviará a {user.full_name} un link para crear una nueva contraseña. Su contraseña actual seguirá funcionando hasta que la cambie.</p>,
        onConfirm: send,
      })}>
        <KeyRound size={16} className="mr-2" />
        {busy === "send" ? "Enviando…" : waitSeconds > 0 ? `Reenviar link en ${waitSeconds} s` : delivery ? "Reenviar link" : "Enviar link de restablecimiento"}
      </Button>
      {delivery && <Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => void cancel()}>{busy === "cancel" ? "Cancelando…" : "Anular link"}</Button>}
    </div>
  </Card>;
}
