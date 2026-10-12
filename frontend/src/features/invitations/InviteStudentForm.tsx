import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button, Field, Input, Select } from "../../components/ui";
import { useToast } from "../../components/ui/use-toast";
import { normalizeError } from "../../lib/api/errors";
import { EMAIL_PATTERN } from "../registration/rules";
import { createInvitation, invitationsQueryKey } from "./api";

const empty = { email: "", college_id: "", access_valid_from: "", access_valid_until: "" };

/** El administrador invita a un estudiante: le llega un link para completar sus datos. */
export function InviteStudentForm({ colleges }: { colleges: Array<{ id: string; name: string }> }) {
  const toast = useToast();
  const client = useQueryClient();
  const [form, setForm] = useState(empty);
  const [emailError, setEmailError] = useState("");
  const invite = useMutation({ mutationFn: createInvitation });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const email = form.email.trim();
    if (!EMAIL_PATTERN.test(email)) return setEmailError("Ingresa un correo válido.");
    setEmailError("");
    try {
      await invite.mutateAsync({ ...form, email });
      toast.success(`Enviamos la invitación a ${email}.`);
      // Se conservan institución y fechas para invitar a varios alumnos seguidos.
      setForm((current) => ({ ...current, email: "" }));
      void client.invalidateQueries({ queryKey: invitationsQueryKey });
    } catch (reason) { toast.error((await normalizeError(reason)).message); }
  };

  return <form className="grid gap-3" onSubmit={(event) => void submit(event)} noValidate>
    <Field label="Colegio"><Select required value={form.college_id} onChange={(event) => setForm({ ...form, college_id: event.target.value })}><option value="">Seleccionar</option>{colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</Select></Field>
    <Field label="Correo del estudiante" error={emailError}><Input type="email" required placeholder="estudiante@correo.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
    <Field label="Inicio"><Input required type="date" value={form.access_valid_from} onChange={(event) => setForm({ ...form, access_valid_from: event.target.value })} /></Field>
    <Field label="Vencimiento"><Input required type="date" value={form.access_valid_until} onChange={(event) => setForm({ ...form, access_valid_until: event.target.value })} /></Field>
    <p className="text-xs text-slate-500">Le enviaremos un link para que complete sus datos y cree su contraseña. El link vence en 7 días.</p>
    <Button disabled={invite.isPending || !form.college_id || !form.email || !form.access_valid_from || !form.access_valid_until}>
      {invite.isPending ? "Enviando…" : "Enviar invitación"}
    </Button>
  </form>;
}
