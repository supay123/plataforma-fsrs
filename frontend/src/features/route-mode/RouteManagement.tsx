import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { routeTopicLessonsPath } from "../../lib/portal-paths";
import { useAuth } from "../auth/AuthProvider";
import { listColleges } from "../colleges/api";
import { listUsers } from "../users/api";
import {
  createRouteTopic, deleteRouteTopic, listRouteTopics, routeTopicsKey, routeTopicTitle, updateRouteTopic,
} from "./api";
import { MascotAdvice } from "../mascot/MascotAdvice";
import { routeAdminAdvice } from "../mascot/route-advice";

const emptyTopicForm = { name: "", description: "" };

function ManagementSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando">
    <Skeleton height={36} width="14rem" />
    <Skeleton className="mt-3" height={16} width="22rem" />
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]"><Skeleton height={260} rounded="2xl" /><Skeleton height={260} rounded="2xl" /></div>
  </div>;
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
  const [collegeId, setCollegeId] = useState("");
  const [pickedTeacherId, setPickedTeacherId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyTopicForm);

  const teachers = useQuery({ queryKey: ["route-teachers"], queryFn: async () => (await listUsers()).filter((user) => user.role === "teacher"), enabled: isAdmin });
  const colleges = useQuery({ queryKey: ["colleges"], queryFn: listColleges, enabled: isAdmin });
  const collegeTeachers = (teachers.data ?? []).filter((teacher) => teacher.college_id === collegeId);
  const teacherId = isAdmin ? pickedTeacherId : profile?.id ?? null;
  const topics = useQuery({ queryKey: routeTopicsKey(teacherId), queryFn: () => listRouteTopics(teacherId), enabled: Boolean(teacherId) });
  useEffect(() => { if (topics.error) toast.error(topics.error.message); }, [topics.error, toast]);
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
    onSuccess: () => { void invalidateTopics(); },
    onError: (error) => toast.error(error.message),
  });

  const guide = routeAdminAdvice({ hasCollege: Boolean(collegeId), teacherCount: collegeTeachers.length, hasTeacher: Boolean(teacherId) });
  if (isAdmin && (teachers.isLoading || colleges.isLoading)) return <ManagementSkeleton />;
  return <>
    <PageHeader title="Modo ruta" description="Crea temas y sus lecciones; tus estudiantes las desbloquean en orden con un 80% de acierto."
      actions={isAdmin && <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <div className="w-full sm:w-64"><Field label="Institución"><Select value={collegeId} onChange={(event) => { setCollegeId(event.target.value); setPickedTeacherId(null); setEditingId(null); setForm(emptyTopicForm); }}>
          <option value="">Elige una institución</option>
          {colleges.data?.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
        </Select></Field></div>
        <div className="w-full sm:w-64"><Field label="Profesor"><Select value={teacherId ?? ""} disabled={!collegeId} onChange={(event) => { setPickedTeacherId(event.target.value || null); setEditingId(null); setForm(emptyTopicForm); }}>
          <option value="">{collegeId ? "Elige un profesor" : "Elige primero una institución"}</option>
          {collegeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
        </Select></Field></div>
      </div>} />
    {isAdmin && <MascotAdvice className="mb-6" event={guide.event} tone={guide.tone}>{guide.text}</MascotAdvice>}
    {!teacherId ? (isAdmin ? null : <EmptyState>No se pudo cargar tu perfil.</EmptyState>)
      : topics.isLoading ? <ManagementSkeleton />
      : <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <h2 className="type-heading mb-4 text-lg">Temas</h2>
            {topics.data?.length ? <div className="grid gap-3">{topics.data.map((topic) => <div key={topic.id} className="flex flex-col justify-between gap-3 rounded-2xl border-2 border-line p-4 sm:flex-row sm:items-center">
              <div className="min-w-0"><strong className="block truncate">{routeTopicTitle(topic)}</strong>
                <span className="text-sm text-fg-muted">{topic.lesson_count} {topic.lesson_count === 1 ? "lección" : "lecciones"} ({topic.ready_lesson_count} listas)</span></div>
              <div className="flex flex-wrap gap-2">
                <Link to={routeTopicLessonsPath(profile?.role, topic.id)}><Button size="sm" variant="secondary">Lecciones</Button></Link>
                <Button size="sm" variant="ghost" onClick={() => { setEditingId(topic.id); setForm({ name: topic.name, description: topic.description ?? "" }); }}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => modal.delete({ title: "Eliminar tema", body: `Se eliminará «${topic.name}» con todas sus lecciones y los intentos de los estudiantes.`, onConfirm: () => remove.mutateAsync(topic.id) })}>Eliminar</Button>
              </div>
            </div>)}</div> : <EmptyState>Aún no hay temas. Crea el primero con el formulario.</EmptyState>}
          </Card>
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
