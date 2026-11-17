import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader } from "../../components/ui";
import { PageSkeleton } from "../../components/ui/skeleton";
import { useModal } from "../../components/ui/use-modal";
import { isDemoCollege } from "../../features/colleges/demo";
import { createCollege, deleteCollege, listColleges, updateCollege } from "../../features/colleges/api";

const empty = { code: "", name: "", description: "" };

export function CollegesPage() {
  const client = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const modal = useModal();
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
  const remove = useMutation({
    mutationFn: deleteCollege,
    onSuccess: (_result, collegeId) => {
      if (editingId === collegeId) {
        setEditingId(null);
        setForm(empty);
      }
      void client.invalidateQueries({ queryKey: ["colleges"] });
      void client.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const editingDemo = isDemoCollege(form.code) && editingId !== null;
  if (query.isLoading) return <PageSkeleton />;
  return <>
    <PageHeader title="Colegios" description="Instituciones habilitadas en la plataforma." />
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        {remove.error && <Alert tone="error">{remove.error.message}</Alert>}
        {query.data?.length ? <div className="table-wrap"><table>
        <thead><tr><th>Código</th><th>Nombre</th><th>Estado</th><th /></tr></thead>
        <tbody>{query.data.map((college) => <tr key={college.id}>
          <td>{college.code}</td>
          <td><strong>{college.name}</strong>{isDemoCollege(college.code) && <> <Badge>Protegido</Badge></>}<br /><span className="text-xs text-fg-muted">{college.description}</span></td>
          <td><Badge tone={college.is_active ? "success" : "warning"}>{college.is_active ? "Activo" : "Inactivo"}</Badge></td>
          <td className="space-x-2">
            <Button size="sm" variant="ghost" onClick={() => {
              setEditingId(college.id);
              setForm({ code: college.code, name: college.name, description: college.description ?? "" });
            }}>Editar</Button>
            <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => college.is_active ? modal.warning({
              title: "Desactivar colegio",
              mascot: "wrong",
              confirmLabel: "Desactivar",
              body: <p>Este cambio afecta a todas las personas de <strong>{college.name}</strong>: sus profesores y estudiantes. Puedes volver a activarlo cuando quieras.</p>,
              onConfirm: () => toggle.mutateAsync({ id: college.id, active: false }),
            }) : toggle.mutate({ id: college.id, active: true })}>{college.is_active ? "Desactivar" : "Activar"}</Button>
            <Button size="sm" variant="danger" disabled={remove.isPending} onClick={() => isDemoCollege(college.code) ? modal.info({
              title: "Esta institución no se puede eliminar",
              body: <p>{college.name} es la institución de pruebas del <strong>modo gratuito</strong>: de ella salen las preguntas que ve quien prueba Chancón desde el inicio del sitio. Por eso está protegida y tampoco se puede cambiar su código. Sí puedes editar sus preguntas, cursos y temas.</p>,
            }) : modal.delete({
              title: "Eliminar colegio",
              mascot: "wrong",
              confirmLabel: "Eliminar definitivamente",
              body: <>
                <p><strong>Esta acción no se puede deshacer.</strong></p>
                <p className="mt-2">Se eliminará el colegio {college.name}, sus usuarios, cursos y toda la información académica relacionada.</p>
              </>,
              onConfirm: () => remove.mutateAsync(college.id),
            })}>Eliminar</Button>
          </td>
        </tr>)}</tbody>
      </table></div> : <EmptyState mascot>No hay colegios registrados.</EmptyState>}</Card>
      <Card>
        <h2 className="mb-4 font-bold">{editingId ? "Editar colegio" : "Nuevo colegio"}</h2>
        {save.error && <Alert tone="error">{save.error.message}</Alert>}
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <Field label="Código" hint={editingDemo ? "El código de la institución del modo gratuito está reservado." : undefined}><Input required disabled={editingDemo} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
          <Field label="Nombre"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Descripción"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <Button disabled={save.isPending}>{editingId ? "Guardar cambios" : "Crear colegio"}</Button>
          {editingId && <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</Button>}
        </form>
      </Card>
    </div>
  </>;
}
