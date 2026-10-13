import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Spinner } from "../../components/ui";
import { useModal } from "../../components/ui/use-modal";
import { listColleges } from "../../features/colleges/api";
import { InviteStudentForm } from "../../features/invitations/InviteStudentForm";
import { PendingInvitations } from "../../features/invitations/PendingInvitations";
import { PaymentsToReview } from "../../features/payments/PaymentsToReview";
import { createUser, deleteUser, listUsers, roleLabel, updateUser } from "../../features/users/api";
import { EXPIRED_REVIEW_DAYS, studentAccess } from "../../lib/student-access";
import type { Credentials } from "../../types/contracts";

// Los profesores se crean directamente; los estudiantes, por invitación.
const emptyForm = { user_code: "", full_name: "", college_id: "", password: "" };

type ListedUser = Awaited<ReturnType<typeof listUsers>>[number];

/** Estudiante con el plan vencido hace más de EXPIRED_REVIEW_DAYS días: el administrador decide si lo borra. */
function longExpired(user: ListedUser) {
  if (user.role !== "student") return false;
  const access = studentAccess(user);
  return access.state === "expired" && access.daysSinceExpiry > EXPIRED_REVIEW_DAYS;
}

function expiredLabel(user: ListedUser) {
  if (user.role !== "student") return "";
  const access = studentAccess(user);
  if (access.state !== "expired") return "";
  return `Plan vencido hace ${access.daysSinceExpiry} ${access.daysSinceExpiry === 1 ? "día" : "días"}`;
}

/** Estado de la columna Acceso: la cuenta desactivada manda; luego, el plan vencido del estudiante. */
function accessBadge(user: ListedUser) {
  if (!user.is_active) return <Badge tone="warning">Inactivo</Badge>;
  if (user.role === "student" && studentAccess(user).state === "expired") return <Badge tone="danger">Vencido</Badge>;
  return <Badge tone="success">Activo</Badge>;
}

export function UsersPage() {
  const client = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const colleges = useQuery({ queryKey: ["colleges"], queryFn: listColleges });
  const [filter, setFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [onlyLongExpired, setOnlyLongExpired] = useState(false);
  const modal = useModal();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [form, setForm] = useState(emptyForm);
  const activeColleges = colleges.data?.filter((college) => college.is_active) ?? [];
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
  const remove = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const visible = useMemo(
    () => users.data?.filter((user) => {
      const matchesText = `${user.full_name} ${user.user_code}`.toLowerCase().includes(filter.toLowerCase());
      const matchesCollege = !collegeFilter || user.college_id === collegeFilter;
      return matchesText && matchesCollege && (!onlyLongExpired || longExpired(user));
    }),
    [users.data, filter, collegeFilter, onlyLongExpired],
  );

  if (users.isLoading) return <Spinner />;
  return <>
    <PageHeader title="Usuarios" description="Profesores, estudiantes y vigencias de acceso." />
    <div className="grid gap-6 xl:grid-cols-[1fr_23rem]">
      <Card>
        {remove.error && <Alert tone="error">{remove.error.message}</Alert>}
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem_14rem]">
          <Input aria-label="Buscar usuarios" placeholder="Buscar por nombre o código…" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <Select aria-label="Filtrar por colegio" value={collegeFilter} onChange={(event) => setCollegeFilter(event.target.value)}>
            <option value="">Todos los colegios</option>
            {colleges.data?.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
          </Select>
          <Select aria-label="Filtrar por vigencia" value={onlyLongExpired ? "expired" : ""} onChange={(event) => setOnlyLongExpired(event.target.value === "expired")}>
            <option value="">Cualquier vigencia</option>
            <option value="expired">Vencidos hace más de {EXPIRED_REVIEW_DAYS} días</option>
          </Select>
        </div>
        <div className="table-wrap mt-4"><table>
          <thead><tr><th>Usuario</th><th>Rol</th><th>Colegio</th><th>Acceso</th><th /></tr></thead>
          <tbody>{visible?.map((user) => <tr key={user.id}>
            <td><strong>{user.full_name}</strong><br /><span className="text-xs text-slate-500">{user.user_code}</span></td>
            <td>{roleLabel(user.role)}</td>
            <td>{colleges.data?.find((college) => college.id === user.college_id)?.name ?? "—"}</td>
            <td>{accessBadge(user)}{expiredLabel(user) && <span className="mt-1 block text-xs text-slate-500">{expiredLabel(user)}</span>}</td>
            <td className="space-x-2">
              <Link className="text-sm font-semibold text-indigo-600" to={`/admin/usuarios/${user.id}`}>Editar</Link>
              {user.role === "teacher" && <Link className="text-sm font-semibold text-indigo-600" to={`/admin/asignaciones?profesor=${user.id}`}>Asignaciones</Link>}
              <Button variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: user.id, active: !user.is_active })}>
                {user.is_active ? "Desactivar" : "Activar"}
              </Button>
              <Button variant="danger" disabled={remove.isPending} onClick={() => modal.delete({
                title: "Eliminar usuario",
                confirmLabel: "Eliminar definitivamente",
                body: <>
                  <p><strong>Esta acción no se puede deshacer.</strong></p>
                  <p className="mt-2">Se eliminará a {user.full_name} y toda la información relacionada con este usuario, incluyendo cursos, matrículas, sesiones, resultados y accesos asociados.</p>
                </>,
                onConfirm: () => remove.mutateAsync(user.id),
              })}>Eliminar</Button>
            </td>
          </tr>)}</tbody>
        </table></div>
      </Card>
      <div className="grid content-start gap-6">
        <Card>
          <h2 className="mb-4 font-bold">Registrar usuario</h2>
          <Field label="Rol"><Select value={role} onChange={(event) => setRole(event.target.value as "student" | "teacher")}><option value="student">Estudiante</option><option value="teacher">Profesor</option></Select></Field>
          <div className="mt-3">
            {role === "student"
              ? <InviteStudentForm colleges={activeColleges} />
              : <>
                {create.error && <Alert tone="error">{create.error.message}</Alert>}
                {credentials && <Alert tone="success">
                  <strong>Credencial temporal</strong><br />{credentials.user_code} / {credentials.temporary_password}
                  <Button type="button" variant="ghost" onClick={() => void navigator.clipboard.writeText(`${credentials.user_code}
${credentials.temporary_password ?? ""}`)}>Copiar</Button>
                </Alert>}
                <form className="mt-3 grid gap-3" onSubmit={(event) => {
                  event.preventDefault();
                  create.mutate({ ...form, role: "teacher", password: form.password || undefined });
                }}>
                  <Field label="Colegio"><Select required value={form.college_id} onChange={(event) => setForm({ ...form, college_id: event.target.value })}><option value="">Seleccionar</option>{activeColleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</Select></Field>
                  <Field label="Nombre"><Input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></Field>
                  <Field label="Código"><Input required value={form.user_code} onChange={(event) => setForm({ ...form, user_code: event.target.value })} /></Field>
                  <Field label="Contraseña (opcional)"><Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
                  <Button disabled={create.isPending}>Crear usuario</Button>
                </form>
              </>}
          </div>
        </Card>
        <PaymentsToReview />
        <PendingInvitations />
      </div>
    </div>
  </>;
}
