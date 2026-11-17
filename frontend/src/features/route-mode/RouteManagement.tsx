import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { useAuth } from "../auth/AuthProvider";
import { listUsers } from "../users/api";
import {
  createRouteTopic, deleteRouteLesson, deleteRouteTopic, listRouteLessons, listRouteTopics, routeLessonsKey,
  routeTopicsKey, routeTopicTitle, updateRouteTopic, type RouteTopic,
} from "./api";
import { LessonEditor } from "./LessonEditor";

const emptyTopicForm = { name: "", description: "" };

function ManagementSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando">
    <Skeleton height={36} width="14rem" />
    <Skeleton className="mt-3" height={16} width="22rem" />
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]"><Skeleton height={260} rounded="2xl" /><Skeleton height={260} rounded="2xl" /></div>
  </div>;
}

function LessonsList({ topic, teacherId }: { topic: RouteTopic; teacherId: string | null }) {
  const toast = useToast();
  const modal = useModal();
  const client = useQueryClient();
  const [editor, setEditor] = useState<{ lessonId: string | null } | null>(null);
  const lessons = useQuery({ queryKey: routeLessonsKey(topic.id), queryFn: () => listRouteLessons(topic.id) });
  useEffect(() => { if (lessons.error) toast.error(lessons.error.message); }, [lessons.error, toast]);
  const remove = useMutation({
    mutationFn: deleteRouteLesson,
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: routeLessonsKey(topic.id) }), client.invalidateQueries({ queryKey: routeTopicsKey(teacherId) })]),
    onError: (error) => toast.error(error.message),
  });

  if (editor) return <LessonEditor topicId={topic.id} lessonId={editor.lessonId} teacherId={teacherId} onClose={() => setEditor(null)} />;
  return <Card>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="type-heading text-lg">Lecciones de {routeTopicTitle(topic)}</h2>
      <Button size="sm" onClick={() => setEditor({ lessonId: null })}>Nueva lección</Button>
    </div>
    {lessons.isLoading ? <div className="grid gap-3">{[0, 1, 2].map((item) => <Skeleton key={item} height={64} rounded="2xl" />)}</div>
      : lessons.data?.length ? <div className="grid gap-3">{lessons.data.map((lesson) => <div key={lesson.id} className="flex flex-col justify-between gap-3 rounded-2xl border-2 border-line p-4 sm:flex-row sm:items-center">
        <div className="min-w-0"><strong className="block truncate">{lesson.position}. {lesson.title}</strong>
          <Badge tone={lesson.is_ready ? "success" : "warning"}>{lesson.is_ready ? "Lista para estudiantes" : "Faltan las preguntas"}</Badge></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditor({ lessonId: lesson.id })}>Editar</Button>
          <Button size="sm" variant="ghost" onClick={() => modal.delete({ title: "Eliminar lección", body: `Se eliminará «${lesson.title}» con sus preguntas y los intentos de los estudiantes.`, onConfirm: () => remove.mutateAsync(lesson.id) })}>Eliminar</Button>
        </div>
      </div>)}</div> : <EmptyState>Este tema aún no tiene lecciones.</EmptyState>}
  </Card>;
}

/**
 * Gestión del modo ruta para administrador y profesor: temas (con sus lecciones) del grupo de un profesor.
 * El administrador elige primero de qué profesor son los temas.
 */
export function RouteManagement() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const toast = useToast();
  const modal = useModal();
  const client = useQueryClient();
  const [pickedTeacherId, setPickedTeacherId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTopicForm);

  const teachers = useQuery({ queryKey: ["route-teachers"], queryFn: async () => (await listUsers()).filter((user) => user.role === "teacher"), enabled: isAdmin });
  const teacherId = isAdmin ? pickedTeacherId ?? teachers.data?.[0]?.id ?? null : profile?.id ?? null;
  const topics = useQuery({ queryKey: routeTopicsKey(teacherId), queryFn: () => listRouteTopics(teacherId), enabled: Boolean(teacherId) });
  useEffect(() => { if (topics.error) toast.error(topics.error.message); }, [topics.error, toast]);
  const selectedTopic = topics.data?.find((topic) => topic.id === topicId) ?? null;
  const invalidateTopics = () => client.invalidateQueries({ queryKey: routeTopicsKey(teacherId) });

  const save = useMutation({
    mutationFn: () => editingId
      ? updateRouteTopic(editingId, { name: form.name, description: form.description || null })
      : createRouteTopic({ name: form.name, description: form.description || undefined, ...(isAdmin ? { teacher_id: teacherId! } : {}) }),
    onSuccess: () => { setForm(emptyTopicForm); setEditingId(null); void invalidateTopics(); },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: deleteRouteTopic,
    onSuccess: (_data, deletedId) => { if (topicId === deletedId) setTopicId(null); void invalidateTopics(); },
    onError: (error) => toast.error(error.message),
  });

  if (isAdmin ? teachers.isLoading : false) return <ManagementSkeleton />;
  return <>
    <PageHeader title="Modo ruta" description="Crea temas y lecciones que tus estudiantes desbloquean en orden con un 80% de acierto."
      actions={isAdmin && <div className="w-full sm:w-64"><Field label="Profesor"><Select value={teacherId ?? ""} onChange={(event) => { setPickedTeacherId(event.target.value); setTopicId(null); setEditingId(null); setForm(emptyTopicForm); }}>
        {teachers.data?.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
      </Select></Field></div>} />
    {!teacherId ? <EmptyState>No hay profesores registrados.</EmptyState>
      : topics.isLoading ? <ManagementSkeleton />
      : <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <h2 className="type-heading mb-4 text-lg">Temas</h2>
            {topics.data?.length ? <div className="grid gap-3">{topics.data.map((topic) => <div key={topic.id} className="flex flex-col justify-between gap-3 rounded-2xl border-2 border-line p-4 sm:flex-row sm:items-center">
              <div className="min-w-0"><strong className="block truncate">{routeTopicTitle(topic)}</strong>
                <span className="text-sm text-fg-muted">{topic.lesson_count} {topic.lesson_count === 1 ? "lección" : "lecciones"} ({topic.ready_lesson_count} listas)</span></div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={topic.id === topicId ? "primary" : "secondary"} onClick={() => setTopicId(topic.id)}>Lecciones</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingId(topic.id); setForm({ name: topic.name, description: topic.description ?? "" }); }}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => modal.delete({ title: "Eliminar tema", body: `Se eliminará «${topic.name}» con todas sus lecciones y los intentos de los estudiantes.`, onConfirm: () => remove.mutateAsync(topic.id) })}>Eliminar</Button>
              </div>
            </div>)}</div> : <EmptyState>Aún no hay temas. Crea el primero con el formulario.</EmptyState>}
          </Card>
          {selectedTopic && <LessonsList key={selectedTopic.id} topic={selectedTopic} teacherId={teacherId} />}
        </div>
        <Card className="h-fit">
          <h2 className="type-heading mb-4 text-lg">{editingId ? "Editar tema" : "Nuevo tema"}</h2>
          <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <Field label="Nombre"><Input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Descripción (opcional)"><Input maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <Button disabled={save.isPending}>{editingId ? "Guardar cambios" : "Crear tema"}</Button>
            {editingId && <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(emptyTopicForm); }}>Cancelar</Button>}
          </form>
        </Card>
      </div>}
  </>;
}
