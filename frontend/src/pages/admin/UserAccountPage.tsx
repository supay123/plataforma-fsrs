import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Spinner } from "../../components/ui";
import { listUsers, renewAccess, resetCredentials, roleLabel, updateUser } from "../../features/users/api";
import type { Credentials } from "../../types/contracts";

export function UserAccountPage() {
  const { userId = "" } = useParams();
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const user = users.data?.find((item) => item.id === userId);
  if (users.isLoading) return <Spinner />;
  if (!user) return <Alert tone="error">No se encontró el usuario solicitado.</Alert>;
  return <UserAccountForm key={user.id} user={user} />;
}

function UserAccountForm({ user }: { user: NonNullable<Awaited<ReturnType<typeof listUsers>>>[number] }) {
  const client = useQueryClient();
  const [name, setName] = useState(user.full_name);
  const [code, setCode] = useState(user.user_code);
  const [validFrom, setValidFrom] = useState(user.access_valid_from ?? "");
  const [validUntil, setValidUntil] = useState(user.access_valid_until ?? "");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const refresh = () => client.invalidateQueries({ queryKey: ["users"] });
  const update = useMutation({
    mutationFn: () => updateUser({ user_id: user.id, full_name: name, user_code: code }),
    onSuccess: refresh,
  });
  const reset = useMutation({
    mutationFn: () => resetCredentials({ user_id: user.id }),
    onSuccess: (data) => {
      setCredentials(data.credentials ?? null);
      void refresh();
    },
  });
  const renew = useMutation({
    mutationFn: () => renewAccess({
      user_id: user.id,
      access_valid_from: validFrom,
      access_valid_until: validUntil,
      reactivate: true,
    }),
    onSuccess: refresh,
  });

  const error = update.error ?? reset.error ?? renew.error;
  return <>
    <PageHeader
      title={user.full_name}
      description={`${roleLabel(user.role)} · ${user.user_code}`}
      actions={<Link className="text-sm font-semibold text-indigo-600" to="/admin/usuarios">Volver a usuarios</Link>}
    />
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Datos del usuario</h2>
          <Badge tone={user.is_active ? "success" : "warning"}>{user.is_active ? "Activo" : "Inactivo"}</Badge>
        </div>
        {error && <Alert tone="error">{error.message}</Alert>}
        <form className="mt-4 grid gap-4" onSubmit={(event) => { event.preventDefault(); update.mutate(); }}>
          <Field label="Nombre completo"><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Código de acceso"><Input required value={code} onChange={(event) => setCode(event.target.value)} /></Field>
          <Button disabled={update.isPending}>Guardar cambios</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-bold">Credenciales</h2>
        <p className="mt-1 text-sm text-slate-600">
          Se generará {user.role === "student" ? "un PIN numérico de seis dígitos" : "una contraseña segura"} y se mostrará una sola vez.
        </p>
        {credentials && <Alert tone="success">
          <strong>Nueva credencial</strong><br />{credentials.user_code} / {credentials.temporary_password}
          <Button type="button" variant="ghost" onClick={() => void navigator.clipboard.writeText(`${credentials.user_code}\n${credentials.temporary_password ?? ""}`)}>Copiar</Button>
        </Alert>}
        <Button className="mt-4" variant="secondary" disabled={reset.isPending} onClick={() => reset.mutate()}>
          Restablecer credencial
        </Button>
      </Card>
      {user.role === "student" && <Card className="lg:col-span-2">
        <h2 className="font-bold">Vigencia de acceso</h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); renew.mutate(); }}>
          <Field label="Desde"><Input required type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></Field>
          <Field label="Hasta"><Input required type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></Field>
          <Button className="sm:col-span-2" disabled={renew.isPending}>Renovar y reactivar</Button>
        </form>
      </Card>}
    </div>
  </>;
}
