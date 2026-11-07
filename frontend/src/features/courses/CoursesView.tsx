import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner, Textarea } from "../../components/ui";
import { ModalForm } from "../../components/ui/modal-form";
import { useModal } from "../../components/ui/use-modal";
import { courseTopicsPath } from "../../lib/portal-paths";
import type { Tables } from "../../types/database";
import { useAuth } from "../auth/AuthProvider";
import { listColleges } from "../colleges/api";
import { listUsers } from "../users/api";
import { archiveCourse, createCourse, duplicateCourse, listCourses, moveCourse, updateCourse } from "./api";

type CourseFormState = { name: string; description: string; teacher_id: string; college_id: string };
type TeacherOption = { id: string; full_name: string; college_id: string | null };
type CollegeOption = { id: string; name: string };

const empty: CourseFormState = { name: "", description: "", teacher_id: "", college_id: "" };

type CourseRow = Tables<"courses"> & {
  colleges: { name: string } | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

type CourseGroup = { teacherId: string; teacherName: string; courses: CourseRow[] };

const normalize = (value: string | null | undefined) => value?.trim().toLocaleLowerCase("es-PE") ?? "";

/** El embed de profesor puede llegar como objeto o arreglo según la versión de PostgREST. */
function teacherName(course: CourseRow) {
  const relation = course.profiles;
  const teacher = Array.isArray(relation) ? relation[0] : relation;
  return teacher?.full_name?.trim() || "Sin profesor";
}

function statusTone(status: Tables<"courses">["status"]) {
  return status === "active" ? "success" : "warning";
}

function courseCount(count: number) {
  return `${count} ${count === 1 ? "curso" : "cursos"}`;
}

/**
 * Campos del formulario de curso, compartidos por el formulario del profesor y
 * el modal del administrador. El admin además elige colegio y profesor.
 */
function CourseFormFields({ form, onChange, teachers, colleges }: {
  form: CourseFormState;
  onChange: (form: CourseFormState) => void;
  teachers?: TeacherOption[];
  colleges?: CollegeOption[];
}) {
  const staffFields = Boolean(teachers && colleges);
  const availableTeachers = (teachers ?? []).filter((teacher) => !form.college_id || teacher.college_id === form.college_id);

  return <>
    {staffFields && <>
      <Field label="Colegio del curso">
        <Select required value={form.college_id} onChange={(event) => onChange({ ...form, college_id: event.target.value, teacher_id: "" })}>
          <option value="">Selecciona un colegio</option>
          {colleges!.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
        </Select>
      </Field>
      <Field label={`Profesor del curso ${form.college_id ? "" : " - Elige primero un colegio"}`}>
        <Select required value={form.teacher_id} disabled={!form.college_id} onChange={(event) => onChange({ ...form, teacher_id: event.target.value })}>
          <option value="">Selecciona un profesor</option>
          {availableTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
        </Select>
      </Field>
    </>}
    <Field label="Nombre"><Input required value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} /></Field>
    <Field label="Descripción"><Textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} /></Field>
  </>;
}

/**
 * Vista única de cursos para profesor y administrador.
 * El rol define el alcance (RLS) y la interfaz: el admin ve todos los cursos
 * agrupados por profesor con buscador y filtro; el profesor administra los suyos.
 */
export function CoursesView() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const client = useQueryClient();
  const modal = useModal();
  const query = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers, enabled: isAdmin });
  const colleges = useQuery({ queryKey: ["colleges"], queryFn: listColleges, enabled: isAdmin });
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adminFormOpen, setAdminFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [moving, setMoving] = useState<CourseRow | null>(null);
  const [moveTeacherId, setMoveTeacherId] = useState("");

  const courses = useMemo(() => (query.data ?? []) as unknown as CourseRow[], [query.data]);
  const teacherDirectory = useMemo<TeacherOption[]>(
    () => (users.data ?? []).filter((user) => user.role === "teacher")
      .map((user) => ({ id: user.id, full_name: user.full_name, college_id: user.college_id })),
    [users.data],
  );

  // Todos los profesores del directorio (tengan o no cursos), más los que aparezcan en cursos.
  const allTeachers = useMemo(() => {
    const byId = new Map<string, TeacherOption>();
    for (const teacher of teacherDirectory) byId.set(teacher.id, teacher);
    for (const course of courses) {
      if (!byId.has(course.teacher_id)) byId.set(course.teacher_id, { id: course.teacher_id, full_name: teacherName(course), college_id: course.college_id });
    }
    return [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  }, [teacherDirectory, courses]);

  const teacherOptions = useMemo(
    () => allTeachers.filter((teacher) => !collegeFilter || teacher.college_id === collegeFilter)
      .map((teacher) => ({ id: teacher.id, name: teacher.full_name })),
    [allTeachers, collegeFilter],
  );

  const adminGroups = useMemo(() => {
    const needle = normalize(search);
    const result: CourseGroup[] = [];
    for (const teacher of allTeachers) {
      if (teacherFilter && teacher.id !== teacherFilter) continue;
      if (collegeFilter && teacher.college_id !== collegeFilter) continue;
      const teacherCourses = courses.filter((course) => {
        if (course.teacher_id !== teacher.id) return false;
        if (collegeFilter && course.college_id !== collegeFilter) return false;
        if (!needle) return true;
        return normalize([
          course.name,
          course.description ?? "",
          teacherName(course),
          course.colleges?.name ?? "",
        ].join(" ")).includes(needle);
      });
      if (needle && !teacherCourses.length && !normalize(teacher.full_name).includes(needle)) continue;
      result.push({ teacherId: teacher.id, teacherName: teacher.full_name, courses: teacherCourses });
    }
    return result;
  }, [allTeachers, courses, search, teacherFilter, collegeFilter]);

  const save = useMutation({
    mutationFn: () => {
      if (isAdmin) {
        const payload = {
          name: form.name,
          description: form.description || null,
          teacher_id: form.teacher_id,
          college_id: form.college_id,
        };
        return editingId
          ? updateCourse(editingId, payload)
          : createCourse({ ...payload, created_by: profile!.id });
      }
      return editingId
        ? updateCourse(editingId, { name: form.name, description: form.description || null })
        : createCourse({ name: form.name, description: form.description || null, college_id: profile!.college_id!, teacher_id: profile!.id, created_by: profile!.id });
    },
    onSuccess: () => {
      setForm(empty);
      setEditingId(null);
      setAdminFormOpen(false);
      void client.invalidateQueries({ queryKey: ["courses"] });
    },
  });
  const archive = useMutation({
    mutationFn: archiveCourse,
    onSuccess: (_course, courseId) => {
      if (editingId === courseId) { setEditingId(null); setForm(empty); }
      setAdminFormOpen(false);
      void client.invalidateQueries({ queryKey: ["courses"] });
    },
  });
  const move = useMutation({
    mutationFn: () => moveCourse({ courseId: moving!.id, teacherId: moveTeacherId }),
    onSuccess: () => {
      setMoving(null);
      setMoveTeacherId("");
      void client.invalidateQueries({ queryKey: ["courses"] });
    },
  });
  const duplicate = useMutation({
    mutationFn: duplicateCourse,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["courses"] }); },
  });
  const toggle = useMutation({
    mutationFn: (course: CourseRow) => updateCourse(course.id, { status: course.status === "active" ? "inactive" : "active" }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["courses"] }); },
  });

  const openCreate = () => {
    save.reset();
    setEditingId(null);
    setForm(empty);
    setAdminFormOpen(true);
  };
  const openEdit = (course: CourseRow) => {
    save.reset();
    setEditingId(course.id);
    setForm({
      name: course.name,
      description: course.description ?? "",
      teacher_id: course.teacher_id,
      college_id: course.college_id,
    });
    setAdminFormOpen(true);
  };
  const closeAdminForm = () => {
    if (save.isPending) return;
    setAdminFormOpen(false);
    setEditingId(null);
    setForm(empty);
  };
  const openMove = (course: CourseRow) => {
    move.reset();
    setMoveTeacherId("");
    setMoving(course);
  };
  const closeMove = () => {
    if (move.isPending) return;
    setMoving(null);
  };
  const confirmDuplicate = (course: CourseRow) => {
    duplicate.reset();
    modal.create({
      title: "Duplicar curso",
      body: <div className="grid gap-2">
        <p>Se creará una copia de <strong className="text-slate-900">{course.name}</strong> con sus temas y preguntas, para el mismo profesor.</p>
        <p>La copia se llamará «{course.name} - duplicado» y empezará sin progreso de estudiantes.</p>
      </div>,
      confirmLabel: "Duplicar curso",
      onConfirm: () => duplicate.mutateAsync(course.id),
    });
  };
  const confirmDelete = (course: CourseRow) => {
    modal.delete({
      title: "Eliminar curso",
      body: <div className="grid gap-2">
        <p>¿Seguro que quieres eliminar <strong className="text-slate-900">{course.name}</strong>?</p>
        <p>
          Esta acción es permanente: el curso dejará de estar disponible para estudiantes y profesores.
        </p>
      </div>,
      confirmLabel: "Eliminar curso",
      onConfirm: () => archive.mutateAsync(course.id),
    });
  };

  if (query.isLoading) return <Spinner />;

  if (isAdmin) return <>
    <PageHeader title="Cursos" description="Todos los cursos de la plataforma, agrupados por profesor." actions={<Button onClick={openCreate}>Nuevo Curso</Button>} />
    <Card>
      <div className="grid gap-4 md:grid-cols-[1fr_16rem_16rem]">
        <Field label="Buscar curso o profesor"><Input placeholder="Nombre del curso o del profesor" value={search} onChange={(event) => setSearch(event.target.value)} /></Field>
        <Field label="Institución"><Select value={collegeFilter} onChange={(event) => { setCollegeFilter(event.target.value); setTeacherFilter(""); }}><option value="">Todas las instituciones</option>{(colleges.data ?? []).map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</Select></Field>
        <Field label="Profesor"><Select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}><option value="">Todos los profesores</option>{teacherOptions.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</Select></Field>
      </div>
    </Card>
    {query.error && <div className="mt-4"><Alert tone="error">{query.error.message}</Alert></div>}
    {duplicate.error && <div className="mt-4"><Alert tone="error">{duplicate.error.message}</Alert></div>}
    {adminGroups.length ? <div className="mt-6 grid gap-6">{adminGroups.map((group) => <section key={group.teacherId}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-950">{group.teacherName}</h2>
        <span className="text-sm text-slate-500">{courseCount(group.courses.length)}</span>
      </div>
      <div className="grid gap-4">{!group.courses.length && <EmptyState>No hay cursos disponibles. Crea uno.</EmptyState>}{group.courses.map((course) => <Card key={course.id} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{course.name}</h3>
            <Badge tone={statusTone(course.status)}>{course.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">{course.description || "Sin descripción"}</p>
          <p className="mt-1 text-xs text-slate-400">{course.colleges?.name ?? "Sin colegio"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => openEdit(course)}>Editar</Button>
          <Button variant="ghost" onClick={() => openMove(course)}>Mover</Button>
          <Button variant="ghost" disabled={duplicate.isPending && duplicate.variables === course.id} onClick={() => confirmDuplicate(course)}>Duplicar</Button>
          <Button variant="ghost" disabled={toggle.isPending && toggle.variables?.id === course.id} onClick={() => toggle.mutate(course)}>{course.status === "active" ? "Desactivar" : "Activar"}</Button>
          <Button variant="danger" disabled={archive.isPending && archive.variables === course.id} onClick={() => confirmDelete(course)}>Eliminar</Button>
          <Link to={courseTopicsPath(profile?.role, course.id)}><Button>Temas</Button></Link>
        </div>
      </Card>)}</div>
    </section>)}</div> : <div className="mt-6"><EmptyState>No hay profesores que coincidan con los filtros.</EmptyState></div>}
    {adminFormOpen && <ModalForm
      title={editingId ? "Editar curso" : "Nuevo curso"}
      confirmLabel={editingId ? "Guardar cambios" : "Crear curso"}
      pending={save.isPending}
      onCancel={closeAdminForm}
      onSubmit={() => save.mutate()}
      error={save.error?.message}
    >
      <CourseFormFields form={form} onChange={setForm} teachers={teacherDirectory} colleges={colleges.data ?? []} />
    </ModalForm>}
    {moving && <ModalForm
      title="Mover curso"
      confirmLabel="Mover curso"
      pending={move.isPending}
      onCancel={closeMove}
      onSubmit={() => move.mutate()}
      error={move.error?.message}
    >
      <p className="text-sm text-slate-600">Elige el profesor que se quedará con <strong className="text-slate-900">{moving.name}</strong>. Solo se muestran profesores del mismo colegio. Los estudiantes del curso pasarán a ser los del nuevo profesor.</p>
      <Field label="Nuevo profesor">
        <Select required value={moveTeacherId} onChange={(event) => setMoveTeacherId(event.target.value)}>
          <option value="">Selecciona un profesor</option>
          {allTeachers.filter((teacher) => teacher.college_id === moving.college_id && teacher.id !== moving.teacher_id)
            .map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
        </Select>
      </Field>
    </ModalForm>}
  </>;

  return <>
    <PageHeader title="Mis cursos" description="Administra cursos y sus temas." />
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid gap-4">{courses.length ? courses.map((course) => <Card key={course.id} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><div className="flex items-center gap-2"><h2 className="font-bold">{course.name}</h2><Badge tone={statusTone(course.status)}>{course.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{course.description}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => { save.reset(); setEditingId(course.id); setForm({ name: course.name, description: course.description ?? "", teacher_id: course.teacher_id, college_id: course.college_id }); }}>Editar</Button>
          <Button variant="ghost" disabled={toggle.isPending && toggle.variables?.id === course.id} onClick={() => toggle.mutate(course)}>{course.status === "active" ? "Desactivar" : "Activar"}</Button>
          <Button variant="danger" disabled={archive.isPending && archive.variables === course.id} onClick={() => confirmDelete(course)}>Eliminar</Button>
          <Link to={courseTopicsPath(profile?.role, course.id)}><Button>Temas</Button></Link>
        </div>
      </Card>) : <EmptyState>No tienes cursos registrados.</EmptyState>}</div>
      <Card>
        <h2 className="mb-4 font-bold">{editingId ? "Editar curso" : "Nuevo curso"}</h2>
        {save.error && <Alert tone="error">{save.error.message}</Alert>}
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <CourseFormFields form={form} onChange={setForm} />
          <Button disabled={save.isPending}>{editingId ? "Guardar cambios" : "Crear curso"}</Button>
          {editingId && <Button type="button" variant="secondary" onClick={() => { save.reset(); setEditingId(null); setForm(empty); }}>Cancelar</Button>}
        </form>
      </Card>
    </div>
  </>;
}
