import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Spinner } from "../../components/ui";
import { createCollege, listColleges, updateCollege } from "../../features/colleges/api";

const empty = { code: "", name: "", description: "" };

export function CollegesPage() {
  const client = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["colleges"], queryFn: listColleges });
  const save = useMutation({
    mutationFn: () => editingId ? updateCollege(editingId, form) : createCollege(form),
    onSuccess: () => {
      setForm(empty);
      setEditingId(null);
      void client.invalidateQueries({ queryKey: ["colleges"] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateCollege(id, { is_active: active }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["colleges"] }),
  });
  if (query.isLoading) return <Spinner />;
  return <>
    <PageHeader title="Colegios" description="Instituciones habilitadas en la plataforma." />
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>{query.data?.length ? <div className="table-wrap"><table>
        <thead><tr><th>Código</th><th>Nombre</th><th>Estado</th><th /></tr></thead>
        <tbody>{query.data.map((college) => <tr key={college.id}>
          <td>{college.code}</td>
          <td><strong>{college.name}</strong><br /><span className="text-xs text-slate-500">{college.description}</span></td>
          <td><Badge tone={college.is_active ? "success" : "warning"}>{college.is_active ? "Activo" : "Inactivo"}</Badge></td>
          <td className="space-x-2">
            <Button variant="ghost" onClick={() => {
              setEditingId(college.id);
              setForm({ code: college.code, name: college.name, description: college.description ?? "" });
            }}>Editar</Button>
            <Button variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate({ id: college.id, active: !college.is_active })}>{college.is_active ? "Desactivar" : "Activar"}</Button>
          </td>
        </tr>)}</tbody>
      </table></div> : <EmptyState>No hay colegios registrados.</EmptyState>}</Card>
      <Card>
        <h2 className="mb-4 font-bold">{editingId ? "Editar colegio" : "Nuevo colegio"}</h2>
        {save.error && <Alert tone="error">{save.error.message}</Alert>}
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <Field label="Código"><Input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
          <Field label="Nombre"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Descripción"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <Button disabled={save.isPending}>{editingId ? "Guardar cambios" : "Crear colegio"}</Button>
          {editingId && <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</Button>}
        </form>
      </Card>
    </div>
  </>;
}
