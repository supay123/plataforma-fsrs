import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Spinner } from "../../components/ui";
import { listColleges } from "../../features/colleges/api";
import { createUser, listUsers, roleLabel, updateUser } from "../../features/users/api";
import type { Credentials } from "../../types/contracts";

const emptyForm = {
  role: "student" as "student" | "teacher",
  user_code: "",
  full_name: "",
  college_id: "",
  password: "",
  access_valid_from: "",
  access_valid_until: "",
};

export function UsersPage() {
  const client = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const colleges = useQuery({ queryKey: ["colleges"], queryFn: listColleges });
  const [filter, setFilter] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [form, setForm] = useState(emptyForm);
  const create = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      setCredentials(data.credentials ?? null);
      setForm((current) => ({ ...current, user_code: "", full_name: "", password: "" }));
      void client.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateUser({ user_id: id, is_active: active }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["users"] }),
  });
  const visible = useMemo(
    () => users.data?.filter((user) =>
      `${user.full_name} ${user.user_code}`.toLowerCase().includes(filter.toLowerCase())),
    [users.data, filter],
  );

  if (users.isLoading) return <Spinner />;
  return <>
    <PageHeader title="Usuarios" description="Profesores, estudiantes y vigencias de acceso." />
    <div className="grid gap-6 xl:grid-cols-[1fr_23rem]">
      <Card>
        <Input aria-label="Buscar usuarios" placeholder="Buscar por nombre o código…" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <div className="table-wrap mt-4"><table>
          <thead><tr><th>Usuario</th><th>Rol</th><th>Acceso</th><th /></tr></thead>
          <tbody>{visible?.map((user) => <tr key={user.id}>
            <td><strong>{user.full_name}</strong><br /><span className="text-xs text-slate-500">{user.user_code}</span></td>
            <td>{roleLabel(user.role)}</td>
            <td><Badge tone={user.is_active ? "success" : "warning"}>{user.is_active ? "Activo" : "Inactivo"}</Badge></td>
            <td className="space-x-2">
              <Link className="text-sm font-semibold text-indigo-600" to={`/admin/usuarios/${user.id}`}>Editar</Link>
              {user.role === "teacher" && <Link className="text-sm font-semibold text-indigo-600" to={`/admin/asignaciones?profesor=${user.id}`}>Asignaciones</Link>}
              <Button variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: user.id, active: !user.is_active })}>
                {user.is_active ? "Desactivar" : "Activar"}
              </Button>
            </td>
          </tr>)}</tbody>
        </table></div>
      </Card>
      <Card>
        <h2 className="mb-4 font-bold">Registrar usuario</h2>
        {create.error && <Alert tone="error">{create.error.message}</Alert>}
        {credentials && <Alert tone="success">
          <strong>Credencial temporal</strong><br />{credentials.user_code} / {credentials.temporary_password}
          <Button type="button" variant="ghost" onClick={() => void navigator.clipboard.writeText(`${credentials.user_code}\n${credentials.temporary_password ?? ""}`)}>Copiar</Button>
        </Alert>}
        <form className="mt-4 grid gap-3" onSubmit={(event) => {
          event.preventDefault();
          create.mutate({
            ...form,
            password: form.password || undefined,
            access_valid_from: form.role === "student" ? form.access_valid_from : undefined,
            access_valid_until: form.role === "student" ? form.access_valid_until : undefined,
          });
        }}>
          <Field label="Rol"><Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "student" | "teacher" })}><option value="student">Estudiante</option><option value="teacher">Profesor</option></Select></Field>
          <Field label="Colegio"><Select required value={form.college_id} onChange={(event) => setForm({ ...form, college_id: event.target.value })}><option value="">Seleccionar</option>{colleges.data?.filter((college) => college.is_active).map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</Select></Field>
          <Field label="Nombre"><Input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></Field>
          <Field label="Código"><Input required value={form.user_code} onChange={(event) => setForm({ ...form, user_code: event.target.value })} /></Field>
          <Field label={form.role === "student" ? "PIN o contraseña (opcional)" : "Contraseña (opcional)"}><Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
          {form.role === "student" && <>
            <Field label="Inicio"><Input required type="date" value={form.access_valid_from} onChange={(event) => setForm({ ...form, access_valid_from: event.target.value })} /></Field>
            <Field label="Vencimiento"><Input required type="date" value={form.access_valid_until} onChange={(event) => setForm({ ...form, access_valid_until: event.target.value })} /></Field>
          </>}
          <Button disabled={create.isPending}>Crear usuario</Button>
        </form>
      </Card>
    </div>
  </>;
}
