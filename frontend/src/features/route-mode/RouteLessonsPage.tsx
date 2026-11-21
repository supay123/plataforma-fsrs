import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { routeLessonJsonPath, routeManagementPath } from "../../lib/portal-paths";
import { useAuth } from "../auth/AuthProvider";
import {
  createRouteLesson, deleteRouteLesson, listRouteLessons, renameRouteLesson, routeLessonsKey, routeTopicsPrefix, routeTopicTitle,
} from "./api";

/** Lecciones de un tema del modo ruta: se crean con su nombre y cada una recibe su JSON (texto y preguntas). */
export function RouteLessonsPage() {
  const { topicId = "" } = useParams();
  const { profile } = useAuth();
  const toast = useToast();
  const modal = useModal();
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const lessons = useQuery({ queryKey: routeLessonsKey(topicId), queryFn: () => listRouteLessons(topicId), enabled: Boolean(topicId) });
  useEffect(() => { if (lessons.error) toast.error(lessons.error.message); }, [lessons.error, toast]);
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: routeLessonsKey(topicId) }),
    client.invalidateQueries({ queryKey: routeTopicsPrefix }),
  ]);

  const save = useMutation({
    mutationFn: () => editingId ? renameRouteLesson(editingId, name) : createRouteLesson({ topic_id: topicId, title: name }),
    onSuccess: () => { setName(""); setEditingId(null); void refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: deleteRouteLesson,
    onSuccess: () => refresh(),
    onError: (error) => toast.error(error.message),
  });

  if (lessons.isLoading) return <div role="status" aria-busy="true" aria-label="Cargando">
    <Skeleton height={36} width="16rem" />
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]"><Skeleton height={260} rounded="2xl" /><Skeleton height={200} rounded="2xl" /></div>
  </div>;
  const topic = lessons.data?.topic;
  return <>
    <PageHeader title={topic ? routeTopicTitle(topic) : "Lecciones"} description="Crea cada lección con su nombre y agrégale su JSON con el texto y las preguntas."
      actions={<Link to={routeManagementPath(profile?.role)}><Button variant="secondary">Volver a los temas</Button></Link>} />
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card className="min-w-0">
        {lessons.data?.lessons.length ? <div className="grid gap-3">{lessons.data.lessons.map((lesson) => <div key={lesson.id} className="flex flex-col justify-between gap-3 rounded-2xl border-2 border-line p-4 sm:flex-row sm:items-center">
          <div className="min-w-0"><strong className="block truncate">{lesson.position}. {lesson.title}</strong>
            <Badge tone={lesson.is_ready ? "success" : "warning"}>{lesson.is_ready ? "Lista para estudiantes" : "Falta el JSON"}</Badge></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditingId(lesson.id); setName(lesson.title); }}>Editar</Button>
            <Link to={routeLessonJsonPath(profile?.role, lesson.id)}><Button size="sm">JSON</Button></Link>
            <Button size="sm" variant="ghost" onClick={() => modal.delete({ title: "Eliminar lección", body: `Se eliminará «${lesson.title}» con sus preguntas y los intentos de los estudiantes.`, onConfirm: () => remove.mutateAsync(lesson.id) })}>Eliminar</Button>
          </div>
        </div>)}</div> : <EmptyState>Este tema aún no tiene lecciones. Crea la primera con el formulario.</EmptyState>}
      </Card>
      <Card className="h-fit">
        <h2 className="type-heading mb-4 text-lg">{editingId ? "Editar lección" : "Nueva lección"}</h2>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <Field label="Nombre"><Input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Button disabled={save.isPending}>{editingId ? "Guardar cambios" : "Crear lección"}</Button>
          {editingId && <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setName(""); }}>Cancelar</Button>}
        </form>
      </Card>
    </div>
  </>;
}
