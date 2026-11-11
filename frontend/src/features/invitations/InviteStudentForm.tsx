import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button, Field, Input, Select } from "../../components/ui";
import { useToast } from "../../components/ui/use-toast";
import { normalizeError } from "../../lib/api/errors";
import { listRegistrationTeachers } from "../registration/api";
import { EMAIL_PATTERN } from "../registration/rules";
import { createInvitation, invitationsQueryKey } from "./api";

const empty = { email: "", teacher_id: "", access_valid_from: "", access_valid_until: "" };

/**
 * El administrador invita a un estudiante: le llega un link para completar sus
 * datos. Puede fijar el grupo (profesor) o dejar que el estudiante lo elija.
 */
export function InviteStudentForm() {
  const toast = useToast();
  const client = useQueryClient();
  const [form, setForm] = useState(empty);
  const [emailError, setEmailError] = useState("");
  const invite = useMutation({ mutationFn: createInvitation });
  const teachers = useQuery({ queryKey: ["registration-teachers"], queryFn: listRegistrationTeachers });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const email = form.email.trim();
    if (!EMAIL_PATTERN.test(email)) return setEmailError("Ingresa un correo válido.");
    setEmailError("");
    try {
      // Sin grupo, el estudiante lo elige al aceptar la invitación.
      await invite.mutateAsync({
        email,
        ...(form.teacher_id ? { teacher_id: form.teacher_id } : {}),
        access_valid_from: form.access_valid_from,
        access_valid_until: form.access_valid_until,
      });
      toast.success(`Enviamos la invitación a ${email}.`);
      // Se conservan grupo y fechas para invitar a varios alumnos seguidos.
      setForm((current) => ({ ...current, email: "" }));
      void client.invalidateQueries({ queryKey: invitationsQueryKey });
    } catch (reason) { toast.error((await normalizeError(reason)).message); }
  };

  return <form className="grid gap-3" onSubmit={(event) => void submit(event)} noValidate>
    <Field label="Grupo (opcional)"><Select value={form.teacher_id} disabled={!teachers.data} onChange={(event) => setForm({ ...form, teacher_id: event.target.value })}><option value="">{teachers.isPending ? "Cargando grupos…" : "El estudiante elegirá su grupo"}</option>{teachers.data?.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</Select></Field>
    <Field label="Correo del estudiante" error={emailError}><Input type="email" required placeholder="estudiante@correo.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
    <Field label="Inicio"><Input required type="date" value={form.access_valid_from} onChange={(event) => setForm({ ...form, access_valid_from: event.target.value })} /></Field>
    <Field label="Vencimiento"><Input required type="date" value={form.access_valid_until} onChange={(event) => setForm({ ...form, access_valid_until: event.target.value })} /></Field>
    <p className="text-xs text-fg-muted">Le enviaremos un link para que complete sus datos y cree su contraseña. Si no eliges un grupo, el estudiante elegirá el suyo al aceptar. El link vence en 7 días.</p>
    <Button disabled={invite.isPending || !form.email || !form.access_valid_from || !form.access_valid_until}>
      {invite.isPending ? "Enviando…" : "Enviar invitación"}
    </Button>
  </form>;
}
