import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader } from "../../components/ui";
import { PageSkeleton } from "../../components/ui/skeleton";
import { createTopic, listCourses, listTopics, updateTopic } from "../../features/courses/api";
import { useAuth } from "../../features/auth/AuthProvider";
import { MascotHelp } from "../../features/mascot/MascotHelp";
import { importQuestionsPath } from "../../lib/portal-paths";

const TOPICS_TIPS = [
  "Los estudiantes practican por tema: cada práctica toma 20 preguntas, así que conviene importar al menos 20 por tema.",
  "Usa las flechas para ordenar los temas y «Desactivar» para ocultar uno sin borrarlo.",
  "«Importar» abre la plantilla para cargar preguntas en el tema.",
  "El enlace de Google Drive es el material de estudio que verá el estudiante.",
];

const empty = { name: "", material_url: "" };

export function TopicsPage() {
  const { courseId = "" } = useParams();
  const { profile } = useAuth();
  const client = useQueryClient();
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const query = useQuery({ queryKey: ["topics", courseId], queryFn: () => listTopics(courseId), enabled: Boolean(courseId) });
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const invalidate = () => client.invalidateQueries({ queryKey: ["topics", courseId] });
  const save = useMutation({
    mutationFn: () => editingId
      ? updateTopic(editingId, { name: form.name, material_url: form.material_url || null })
      : createTopic({ course_id: courseId, name: form.name, material_url: form.material_url || null, position: (query.data?.length ?? 0) + 1, status: "active", created_by: profile!.id }),
    onSuccess: () => {
      setForm(empty);
      setEditingId(null);
      void invalidate();
    },
  });
  const move = async (index: number, direction: -1 | 1) => {
    const current = query.data?.[index];
    const other = query.data?.[index + direction];
    if (!current || !other) return;
    const temporaryPosition = Math.max(...(query.data?.map((topic) => topic.position) ?? [0])) + 1000;
    await updateTopic(current.id, { position: temporaryPosition });
    await updateTopic(other.id, { position: current.position });
    await updateTopic(current.id, { position: other.position });
    await invalidate();
  };
  if (query.isLoading) return <PageSkeleton />;
  const course = courses.data?.find((item) => item.id === courseId);
  return <>
    <PageHeader title={course?.name ?? "Temas"} description="Orden, material y banco de preguntas." />
    <MascotHelp className="mb-6" screen="topics" tips={TOPICS_TIPS} advice={query.data?.length
      ? { event: "rest", tone: "neutral", text: "Revisa que cada tema tenga suficientes preguntas: una práctica pide 20." }
      : { event: "sleep", tone: "neutral", text: "Este curso aún no tiene temas. Crea el primero con el formulario de la derecha." }} />
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>{query.data?.length ? <div className="grid gap-3">{query.data.map((topic, index) => <div key={topic.id} className="flex flex-col justify-between gap-3 rounded-2xl border-2 border-line p-4 sm:flex-row sm:items-center">
        <div><div className="flex gap-2"><strong>{topic.position}. {topic.name}</strong><Badge tone={topic.status === "active" ? "success" : "warning"}>{topic.status}</Badge></div>{topic.material_url && <a className="text-sm text-primary-text" href={topic.material_url} target="_blank" rel="noreferrer">Abrir material</a>}</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" aria-label={`Subir ${topic.name}`} disabled={index === 0} onClick={() => void move(index, -1)}>↑</Button>
          <Button size="sm" variant="ghost" aria-label={`Bajar ${topic.name}`} disabled={index === (query.data?.length ?? 0) - 1} onClick={() => void move(index, 1)}>↓</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditingId(topic.id); setForm({ name: topic.name, material_url: topic.material_url ?? "" }); }}>Editar</Button>
          <Button size="sm" variant="ghost" onClick={() => void updateTopic(topic.id, { status: topic.status === "active" ? "inactive" : "active" }).then(invalidate)}>{topic.status === "active" ? "Desactivar" : "Activar"}</Button>
          <Link to={importQuestionsPath(profile?.role, topic.id)}><Button size="sm">Importar</Button></Link>
        </div>
      </div>)}</div> : <EmptyState>No hay temas registrados.</EmptyState>}</Card>
      <Card>
        <h2 className="mb-4 font-bold">{editingId ? "Editar tema" : "Nuevo tema"}</h2>
        {save.error && <Alert tone="error">{save.error.message}</Alert>}
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <Field label="Nombre"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Enlace de Google Drive"><Input type="url" value={form.material_url} onChange={(event) => setForm({ ...form, material_url: event.target.value })} /></Field>
          <Button disabled={save.isPending}>{editingId ? "Guardar cambios" : "Crear tema"}</Button>
          {editingId && <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</Button>}
        </form>
      </Card>
    </div>
  </>;
}
