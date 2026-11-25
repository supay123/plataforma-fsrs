import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select } from "../../components/ui";
import { InfiniteScrollTrigger } from "../../components/ui/infinite-scroll-trigger";
import { ModalForm } from "../../components/ui/modal-form";
import { Skeleton } from "../../components/ui/skeleton";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { routeTopicLessonsPath } from "../../lib/portal-paths";
import { useAuth } from "../auth/AuthProvider";
import { listColleges } from "../colleges/api";
import { listUsers } from "../users/api";
import {
  createRouteCourse, createRouteTopic, deleteRouteCourse, deleteRouteTopic, listRouteCourses, listRouteTopics,
  routeCoursesKey, routeTopicsKey, routeTopicTitle, updateRouteCourse, updateRouteTopic,
} from "./api";
import { MascotAdvice } from "../mascot/MascotAdvice";
import { routeAdminAdvice } from "../mascot/route-advice";

const emptyTopicForm = { name: "", description: "" };
const emptyCourseForm = { name: "", description: "" };

/** `null` es el formulario cerrado; `id: null` es un curso nuevo. */
interface CourseFormState { id: string | null; name: string; description: string }

function ManagementSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando">
    <Skeleton height={36} width="14rem" />
    <Skeleton className="mt-3" height={16} width="22rem" />
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]"><Skeleton height={260} rounded="2xl" /><Skeleton height={260} rounded="2xl" /></div>
  </div>;
}

/**
 * Gestión del modo ruta para administrador y profesor: cursos de ruta de un profesor, y dentro de cada uno sus temas
 * (con sus lecciones). Los cursos de ruta no tienen relación con los de "Mi aprendizaje".
 * El administrador elige primero de qué profesor son los cursos.
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
  const [courseForm, setCourseForm] = useState<CourseFormState | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const teachers = useQuery({ queryKey: ["route-teachers"], queryFn: async () => (await listUsers()).filter((user) => user.role === "teacher"), enabled: isAdmin });
  const colleges = useQuery({ queryKey: ["colleges"], queryFn: listColleges, enabled: isAdmin });
  const collegeTeachers = (teachers.data ?? []).filter((teacher) => teacher.college_id === collegeId);
  const teacherId = isAdmin ? pickedTeacherId : profile?.id ?? null;
  const courses = useInfiniteQuery({
    queryKey: routeCoursesKey(teacherId),
    queryFn: ({ pageParam }) => listRouteCourses(teacherId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, loadedPages) => loadedPages.length < lastPage.total_pages ? loadedPages.length + 1 : undefined,
    enabled: Boolean(teacherId),
  });
  useEffect(() => { if (courses.error) toast.error(courses.error.message); }, [courses.error, toast]);
  const courseList = courses.data?.pages.flatMap((loadedPage) => loadedPage.courses);
  // El curso elegido va en la URL para volver a él desde las lecciones; si ya no existe, se usa el primero.
  const selectedCourse = courseList?.find((course) => course.id === searchParams.get("curso")) ?? courseList?.[0] ?? null;
  const selectedCourseId = selectedCourse?.id ?? null;
  const topics = useQuery({ queryKey: routeTopicsKey(selectedCourseId), queryFn: () => listRouteTopics(selectedCourseId!), enabled: Boolean(selectedCourseId) });
  useEffect(() => { if (topics.error) toast.error(topics.error.message); }, [topics.error, toast]);
  const invalidateTopics = () => client.invalidateQueries({ queryKey: routeTopicsKey(selectedCourseId) });
  const invalidateCourses = () => client.invalidateQueries({ queryKey: routeCoursesKey(teacherId) });
  const resetTopicForm = () => { setEditingId(null); setForm(emptyTopicForm); };
  const selectCourse = (courseId: string) => { setSearchParams({ curso: courseId }, { replace: true }); resetTopicForm(); };

  const saveCourse = useMutation({
    mutationFn: (values: CourseFormState) => {
      const body = { name: values.name, description: values.description || undefined };
      return values.id
        ? updateRouteCourse(values.id, { name: values.name, description: values.description || null })
        : createRouteCourse({ ...body, ...(isAdmin ? { teacher_id: teacherId! } : {}) });
    },
    onSuccess: (result, values) => {
      setCourseForm(null);
      void invalidateCourses();
      if (!values.id) selectCourse(result.course.id);
    },
  });
  const removeCourse = useMutation({
    mutationFn: deleteRouteCourse,
    onSuccess: () => { void invalidateCourses(); setSearchParams({}, { replace: true }); resetTopicForm(); },
    onError: (error) => toast.error(error.message),
  });
  const save = useMutation({
    mutationFn: () => editingId
      ? updateRouteTopic(editingId, { name: form.name, description: form.description || null })
      : createRouteTopic({ route_course_id: selectedCourseId!, name: form.name, description: form.description || undefined }),
    onSuccess: () => { resetTopicForm(); void invalidateTopics(); void invalidateCourses(); },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: deleteRouteTopic,
    onSuccess: () => { void invalidateTopics(); void invalidateCourses(); },
    onError: (error) => toast.error(error.message),
  });

  const guide = routeAdminAdvice({ hasCollege: Boolean(collegeId), teacherCount: collegeTeachers.length, hasTeacher: Boolean(teacherId), courseCount: courses.data?.pages[0]?.total ?? 0 });
  if (isAdmin && (teachers.isLoading || colleges.isLoading)) return <ManagementSkeleton />;
  return <>
    <PageHeader title="Modo ruta" description="Crea cursos de ruta, y dentro de cada uno sus temas y lecciones; tus estudiantes las desbloquean en orden con un 80% de acierto."
      actions={isAdmin && <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <div className="w-full sm:w-64"><Field label="Institución"><Select value={collegeId} onChange={(event) => { setCollegeId(event.target.value); setPickedTeacherId(null); setSearchParams({}, { replace: true }); resetTopicForm(); }}>
          <option value="">Elige una institución</option>
          {colleges.data?.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
        </Select></Field></div>
        <div className="w-full sm:w-64"><Field label="Profesor"><Select value={teacherId ?? ""} disabled={!collegeId} onChange={(event) => { setPickedTeacherId(event.target.value || null); setSearchParams({}, { replace: true }); resetTopicForm(); }}>
          <option value="">{collegeId ? "Elige un profesor" : "Elige primero una institución"}</option>
          {collegeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
        </Select></Field></div>
      </div>} />
    {isAdmin && !courses.isLoading && <MascotAdvice className="mb-6" event={guide.event} tone={guide.tone}>{guide.text}</MascotAdvice>}
    {!teacherId ? (isAdmin ? null : <EmptyState>No se pudo cargar tu perfil.</EmptyState>)
      : courses.isLoading ? <ManagementSkeleton />
      : <div className="grid gap-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="type-heading text-lg">Cursos de ruta</h2>
            <Button size="sm" onClick={() => setCourseForm({ id: null, ...emptyCourseForm })}>Nuevo curso</Button>
          </div>
          {courseList?.length ? <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cursos de ruta">{courseList.map((course) => <Button key={course.id} size="sm" variant={course.id === selectedCourseId ? "primary" : "secondary"} aria-pressed={course.id === selectedCourseId} onClick={() => selectCourse(course.id)}>{course.name}</Button>)}</div>
            <InfiniteScrollTrigger hasNextPage={courses.hasNextPage} isFetchingNextPage={courses.isFetchingNextPage} onLoadMore={() => void courses.fetchNextPage()} />
            {selectedCourse && <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border-2 border-line p-4 sm:flex-row sm:items-center">
              <div className="min-w-0"><strong className="block truncate">{selectedCourse.name}</strong>
                <span className="text-sm text-fg-muted">{selectedCourse.description || `${selectedCourse.topic_count} ${selectedCourse.topic_count === 1 ? "tema" : "temas"}`}</span></div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCourseForm({ id: selectedCourse.id, name: selectedCourse.name, description: selectedCourse.description ?? "" })}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => modal.delete({ title: "Eliminar curso", body: `Se eliminará «${selectedCourse.name}» con todos sus temas, lecciones y los intentos de los estudiantes.`, onConfirm: () => removeCourse.mutateAsync(selectedCourse.id) })}>Eliminar</Button>
              </div>
            </div>}
          </> : <EmptyState>Aún no hay cursos de ruta. Crea el primero.</EmptyState>}
        </Card>
        {selectedCourse && (topics.isLoading ? <ManagementSkeleton /> : <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="grid min-w-0 content-start gap-6">
            <Card>
              <h2 className="type-heading mb-4 text-lg">Temas de {selectedCourse.name}</h2>
              {topics.data?.length ? <div className="grid gap-3">{topics.data.map((topic) => <div key={topic.id} className="flex flex-col justify-between gap-3 rounded-2xl border-2 border-line p-4 sm:flex-row sm:items-center">
                <div className="min-w-0"><strong className="block truncate">{routeTopicTitle(topic)}</strong>
                  <span className="text-sm text-fg-muted">{topic.lesson_count} {topic.lesson_count === 1 ? "lección" : "lecciones"} ({topic.ready_lesson_count} listas)</span></div>
                <div className="flex flex-wrap gap-2">
                  <Link to={routeTopicLessonsPath(profile?.role, topic.id)}><Button size="sm" variant="secondary">Lecciones</Button></Link>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(topic.id); setForm({ name: topic.name, description: topic.description ?? "" }); }}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => modal.delete({ title: "Eliminar tema", body: `Se eliminará «${topic.name}» con todas sus lecciones y los intentos de los estudiantes.`, onConfirm: () => remove.mutateAsync(topic.id) })}>Eliminar</Button>
                </div>
              </div>)}</div> : <EmptyState>Este curso aún no tiene temas. Crea el primero con el formulario.</EmptyState>}
            </Card>
          </div>
          <Card className="h-fit">
            <h2 className="type-heading mb-4 text-lg">{editingId ? "Editar tema" : "Nuevo tema"}</h2>
            <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
              <Field label="Nombre"><Input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
              <Field label="Descripción (opcional)"><Input maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
              <Button disabled={save.isPending}>{editingId ? "Guardar cambios" : "Crear tema"}</Button>
              {editingId && <Button type="button" variant="secondary" onClick={resetTopicForm}>Cancelar</Button>}
            </form>
          </Card>
        </div>)}
      </div>}
    {courseForm && <ModalForm
      title={courseForm.id ? "Editar curso de ruta" : "Nuevo curso de ruta"}
      confirmLabel={courseForm.id ? "Guardar cambios" : "Crear curso"}
      pending={saveCourse.isPending}
      onCancel={() => { saveCourse.reset(); setCourseForm(null); }}
      onSubmit={() => saveCourse.mutate(courseForm)}
      error={saveCourse.error?.message}
    >
      <div className="grid gap-4">
        <Field label="Nombre"><Input required maxLength={120} value={courseForm.name} onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} /></Field>
        <Field label="Descripción (opcional)"><Input maxLength={500} value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} /></Field>
      </div>
    </ModalForm>}
  </>;
}
