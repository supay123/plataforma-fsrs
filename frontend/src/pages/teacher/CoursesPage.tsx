import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Spinner, Textarea } from "../../components/ui";
import { createCourse, listCourses, updateCourse } from "../../features/courses/api";
import { useAuth } from "../../features/auth/AuthProvider";

const empty = { name: "", description: "" };

export function CoursesPage() {
  const { profile } = useAuth();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => editingId
      ? updateCourse(editingId, { name: form.name, description: form.description || null })
      : createCourse({ name: form.name, description: form.description || null, college_id: profile!.college_id!, teacher_id: profile!.id, created_by: profile!.id }),
    onSuccess: () => {
      setForm(empty);
      setEditingId(null);
      void client.invalidateQueries({ queryKey: ["courses"] });
    },
  });
  if (query.isLoading) return <Spinner />;
  return <>
    <PageHeader title="Mis cursos" description="Administra cursos y sus temas." />
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid gap-4">{query.data?.length ? query.data.map((course) => <Card key={course.id} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><div className="flex items-center gap-2"><h2 className="font-bold">{course.name}</h2><Badge tone={course.status === "active" ? "success" : "warning"}>{course.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{course.description}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => { setEditingId(course.id); setForm({ name: course.name, description: course.description ?? "" }); }}>Editar</Button>
          <Button variant="ghost" onClick={() => void updateCourse(course.id, { status: course.status === "active" ? "inactive" : "active" }).then(() => client.invalidateQueries({ queryKey: ["courses"] }))}>{course.status === "active" ? "Desactivar" : "Activar"}</Button>
          <Link to={`/profesor/cursos/${course.id}`}><Button>Temas</Button></Link>
        </div>
      </Card>) : <EmptyState>No tienes cursos registrados.</EmptyState>}</div>
      <Card>
        <h2 className="mb-4 font-bold">{editingId ? "Editar curso" : "Nuevo curso"}</h2>
        {save.error && <Alert tone="error">{save.error.message}</Alert>}
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <Field label="Nombre"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Descripción"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <Button disabled={save.isPending}>{editingId ? "Guardar cambios" : "Crear curso"}</Button>
          {editingId && <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</Button>}
        </form>
      </Card>
    </div>
  </>;
}
