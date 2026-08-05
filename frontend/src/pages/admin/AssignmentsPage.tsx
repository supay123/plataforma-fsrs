import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, PageHeader, Select, Spinner } from "../../components/ui";
import { listTeacherAssignments, setCourseEnrollmentStatus, syncTeacherStudents } from "../../features/assignments/api";
import { useAuth } from "../../features/auth/AuthProvider";
import { listColleges } from "../../features/colleges/api";
import { listCourses } from "../../features/courses/api";
import { setTopicAccess, topicAccess } from "../../features/progress/api";
import { listUsers } from "../../features/users/api";

type AssignmentPanel = "topics" | "courses" | "students";

const panelButtons: Array<{ id: AssignmentPanel; label: string }> = [
  { id: "topics", label: "Bloquear temas a alumnos" },
  { id: "courses", label: "Asignar o bloquear acceso de alumnos a un curso" },
  { id: "students", label: "Asignar alumnos a este profesor" },
];

const normalize = (value: string | null | undefined) => value?.trim().toLocaleLowerCase("es-PE") ?? "";

export function AssignmentsPage() {
  const { profile } = useAuth();
  const client = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const colleges = useQuery({ queryKey: ["colleges"], queryFn: listColleges });
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const assignments = useQuery({ queryKey: ["teacher-students"], queryFn: listTeacherAssignments });
  const access = useQuery({ queryKey: ["topic-access"], queryFn: () => topicAccess() });

  const [teacherSearch, setTeacherSearch] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState(() => searchParams.get("profesor") ?? "");
  const [activePanel, setActivePanel] = useState<AssignmentPanel | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [studentSelection, setStudentSelection] = useState<Set<string> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const collegeNames = useMemo(() => new Map(colleges.data?.map((college) => [college.id, college.name]) ?? []), [colleges.data]);
  const teachers = useMemo(() => users.data?.filter((user) => user.role === "teacher") ?? [], [users.data]);
  const students = useMemo(() => users.data?.filter((user) => user.role === "student") ?? [], [users.data]);
  const selectedTeacher = teachers.find((teacher) => teacher.id === selectedTeacherId);
  const teacherCourses = useMemo(
    () => courses.data?.filter((course) => course.teacher_id === selectedTeacherId) ?? [],
    [courses.data, selectedTeacherId],
  );
  const teacherAssignments = useMemo(
    () => assignments.data?.filter((row) => row.teacher_id === selectedTeacherId) ?? [],
    [assignments.data, selectedTeacherId],
  );
  const assignedStudentIds = useMemo(
    () => new Set(teacherAssignments.flatMap((row) => row.student_id ? [row.student_id] : [])),
    [teacherAssignments],
  );
  const selectedStudentIds = studentSelection ?? assignedStudentIds;

  const visibleTeachers = useMemo(() => {
    const needle = normalize(teacherSearch);
    return teachers.filter((teacher) =>
      (!collegeFilter || teacher.college_id === collegeFilter)
      && normalize(`${teacher.full_name} ${teacher.user_code}`).includes(needle));
  }, [collegeFilter, teacherSearch, teachers]);

  const collegeStudents = useMemo(
    () => students.filter((student) => student.college_id === selectedTeacher?.college_id),
    [selectedTeacher?.college_id, students],
  );

  const topicRows = useMemo(() => {
    const courseIds = new Set(teacherCourses.map((course) => course.id));
    const needle = normalize(studentSearch);
    return access.data?.filter((row) =>
      !!row.course_id
      && courseIds.has(row.course_id)
      && (!courseFilter || row.course_id === courseFilter)
      && normalize(`${row.student_name} ${row.student_code}`).includes(needle)) ?? [];
  }, [access.data, courseFilter, studentSearch, teacherCourses]);

  const courseRows = useMemo(() => {
    const courseIds = new Set(teacherCourses.map((course) => course.id));
    const needle = normalize(studentSearch);
    return teacherAssignments.filter((row) =>
      !!row.course_id
      && courseIds.has(row.course_id)
      && (!courseFilter || row.course_id === courseFilter)
      && normalize(`${row.student_name} ${row.student_code}`).includes(needle));
  }, [courseFilter, studentSearch, teacherAssignments, teacherCourses]);

  const visibleCollegeStudents = useMemo(() => {
    const needle = normalize(studentSearch);
    return collegeStudents.filter((student) => normalize(`${student.full_name} ${student.user_code}`).includes(needle));
  }, [collegeStudents, studentSearch]);

  const refreshAssignments = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["teacher-students"] }),
      client.invalidateQueries({ queryKey: ["topic-access"] }),
      client.invalidateQueries({ queryKey: ["student-courses"] }),
    ]);
  };

  const topicMutation = useMutation({
    mutationFn: ({ studentId, topicId, blocked }: { studentId: string; topicId: string; blocked: boolean }) =>
      setTopicAccess({ student_id: studentId, topic_id: topicId, is_blocked: !blocked, updated_by: profile!.id }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["topic-access"] }),
  });
  const courseMutation = useMutation({
    mutationFn: ({ courseId, studentId, status }: { courseId: string; studentId: string; status: "active" | "inactive" }) =>
      setCourseEnrollmentStatus({ courseId, studentId, status }),
    onSuccess: refreshAssignments,
  });
  const syncMutation = useMutation({
    mutationFn: () => syncTeacherStudents({ teacherId: selectedTeacherId, studentIds: [...selectedStudentIds] }),
    onSuccess: async () => {
      setConfirmOpen(false);
      setStudentSelection(null);
      await refreshAssignments();
    },
  });

  const selectTeacher = (teacherId: string) => {
    const nextTeacherId = teacherId === selectedTeacherId ? "" : teacherId;
    setSelectedTeacherId(nextTeacherId);
    setActivePanel(null);
    setStudentSearch("");
    setCourseFilter("");
    setStudentSelection(null);
    setSearchParams(nextTeacherId ? { profesor: nextTeacherId } : {}, { replace: true });
  };

  const changeCollege = (collegeId: string) => {
    setCollegeFilter(collegeId);
    if (selectedTeacherId && selectedTeacher?.college_id !== collegeId && collegeId) selectTeacher(selectedTeacherId);
  };

  const selectPanel = (panel: AssignmentPanel) => {
    setActivePanel(panel);
    setStudentSearch("");
    setCourseFilter("");
  };

  const toggleStudent = (studentId: string) => {
    setStudentSelection((current) => {
      const next = new Set(current ?? assignedStudentIds);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  };

  if (users.isLoading || colleges.isLoading || courses.isLoading || assignments.isLoading || access.isLoading) return <Spinner />;
  const loadError = users.error ?? colleges.error ?? courses.error ?? assignments.error ?? access.error;
  if (loadError) return <Alert tone="error">{loadError.message}</Alert>;

  return <>
    <PageHeader title="Editar asignaciones" description="Acá podrás administrar las asignaciones de temas, cursos y alumnos por profesor y colegio" />
    <Card>
      <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
        <Field label="Profesor"><Input placeholder="Busca un profesor" value={teacherSearch} onChange={(event) => setTeacherSearch(event.target.value)} /></Field>
        <Field label="Colegio"><Select value={collegeFilter} onChange={(event) => changeCollege(event.target.value)}><option value="">Todos los colegios</option>{colleges.data?.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</Select></Field>
      </div>
      <div className="table-wrap mt-4"><table>
        <thead><tr><th>Nombre</th><th>Código</th><th>Colegio</th><th>Seleccionar</th></tr></thead>
        <tbody>{visibleTeachers.map((teacher) => <tr key={teacher.id} className={selectedTeacherId === teacher.id ? "bg-indigo-50" : undefined}>
          <td><strong>{teacher.full_name}</strong></td><td>{teacher.user_code}</td><td>{teacher.college_id ? collegeNames.get(teacher.college_id) : "—"}</td>
          <td><input aria-label={`Seleccionar a ${teacher.full_name}`} className="h-4 w-4 accent-indigo-600" type="checkbox" checked={selectedTeacherId === teacher.id} onChange={() => selectTeacher(teacher.id)} /></td>
        </tr>)}</tbody>
      </table></div>
    </Card>

    <div className="mt-5 grid gap-3 lg:grid-cols-3">
      {panelButtons.map((panel) => <Button key={panel.id} variant={activePanel === panel.id ? "primary" : "secondary"} disabled={!selectedTeacher} className="disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500" onClick={() => selectPanel(panel.id)}>{panel.label}</Button>)}
    </div>

    {selectedTeacher && activePanel === "topics" && <TopicsPanel courses={teacherCourses} rows={topicRows} studentSearch={studentSearch} courseFilter={courseFilter} pending={topicMutation.isPending} error={topicMutation.error?.message} onStudentSearch={setStudentSearch} onCourseFilter={setCourseFilter} onToggle={(studentId, topicId, blocked) => topicMutation.mutate({ studentId, topicId, blocked })} />}
    {selectedTeacher && activePanel === "courses" && <CoursesPanel courses={teacherCourses} rows={courseRows} studentSearch={studentSearch} courseFilter={courseFilter} pending={courseMutation.isPending} error={courseMutation.error?.message} onStudentSearch={setStudentSearch} onCourseFilter={setCourseFilter} onToggle={(courseId, studentId, status) => courseMutation.mutate({ courseId, studentId, status })} />}
    {selectedTeacher && activePanel === "students" && <StudentsPanel students={visibleCollegeStudents} selectedStudentIds={selectedStudentIds} studentSearch={studentSearch} hasCourses={teacherCourses.length > 0} pending={syncMutation.isPending} error={syncMutation.error?.message} onStudentSearch={setStudentSearch} onToggle={toggleStudent} onConfirm={() => setConfirmOpen(true)} />}

    <ConfirmDialog open={confirmOpen} title="Confirmar asignaciones" pending={syncMutation.isPending} onCancel={() => setConfirmOpen(false)} onConfirm={() => syncMutation.mutate()}>
      Los alumnos que se asignen a un profesor serán automáticamente asignados a todos sus cursos, incluso a aquellos que se creen después de confirmar esta operación. Si se desactivan asignaciones en esta pantalla, los alumnos ya no estarán matriculados en los cursos de este profesor.
    </ConfirmDialog>
  </>;
}

function PanelFilters({ courses, studentSearch, courseFilter, onStudentSearch, onCourseFilter }: {
  courses: Array<{ id: string; name: string }>;
  studentSearch: string;
  courseFilter: string;
  onStudentSearch: (value: string) => void;
  onCourseFilter: (value: string) => void;
}) {
  return <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
    <Field label="Alumno"><Input placeholder="Buscar alumno por nombre o código" value={studentSearch} onChange={(event) => onStudentSearch(event.target.value)} /></Field>
    <Field label="Curso"><Select value={courseFilter} onChange={(event) => onCourseFilter(event.target.value)}><option value="">Todos los cursos</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</Select></Field>
  </div>;
}

function TopicsPanel({ courses, rows, studentSearch, courseFilter, pending, error, onStudentSearch, onCourseFilter, onToggle }: {
  courses: Array<{ id: string; name: string }>;
  rows: Array<{ student_id: string | null; student_name: string | null; student_code: string | null; course_id: string | null; course_name: string | null; topic_id: string | null; topic_name: string | null; is_blocked: boolean | null }>;
  studentSearch: string;
  courseFilter: string;
  pending: boolean;
  error?: string;
  onStudentSearch: (value: string) => void;
  onCourseFilter: (value: string) => void;
  onToggle: (studentId: string, topicId: string, blocked: boolean) => void;
}) {
  return <Card className="mt-5"><h2 className="mb-4 font-bold">Bloquear temas a alumnos</h2>{error && <Alert tone="error">{error}</Alert>}<PanelFilters courses={courses} studentSearch={studentSearch} courseFilter={courseFilter} onStudentSearch={onStudentSearch} onCourseFilter={onCourseFilter} />
    {rows.length ? <div className="table-wrap mt-4"><table><thead><tr><th>Alumno</th><th>Curso</th><th>Tema</th><th>Estado</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={`${row.student_id}-${row.topic_id}`}><td><strong>{row.student_name}</strong><br /><span className="text-xs text-slate-500">{row.student_code}</span></td><td>{row.course_name}</td><td>{row.topic_name}</td><td><Badge tone={row.is_blocked ? "warning" : "success"}>{row.is_blocked ? "Bloqueado" : "Habilitado"}</Badge></td><td><Button variant="ghost" disabled={pending || !row.student_id || !row.topic_id} onClick={() => onToggle(row.student_id!, row.topic_id!, row.is_blocked ?? false)}>{row.is_blocked ? "Desbloquear" : "Bloquear"}</Button></td></tr>)}</tbody></table></div> : <EmptyState>No hay temas disponibles para los filtros seleccionados.</EmptyState>}
  </Card>;
}

function CoursesPanel({ courses, rows, studentSearch, courseFilter, pending, error, onStudentSearch, onCourseFilter, onToggle }: {
  courses: Array<{ id: string; name: string }>;
  rows: Array<{ student_id: string | null; student_name: string | null; student_code: string | null; course_id: string | null; course_name: string | null; enrollment_status: "active" | "inactive" | null }>;
  studentSearch: string;
  courseFilter: string;
  pending: boolean;
  error?: string;
  onStudentSearch: (value: string) => void;
  onCourseFilter: (value: string) => void;
  onToggle: (courseId: string, studentId: string, status: "active" | "inactive") => void;
}) {
  return <Card className="mt-5"><h2 className="mb-4 font-bold">Asignar o bloquear acceso de alumnos a un curso</h2>{error && <Alert tone="error">{error}</Alert>}<PanelFilters courses={courses} studentSearch={studentSearch} courseFilter={courseFilter} onStudentSearch={onStudentSearch} onCourseFilter={onCourseFilter} />
    {rows.length ? <div className="table-wrap mt-4"><table><thead><tr><th>Alumno</th><th>Curso</th><th>Estado</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={`${row.student_id}-${row.course_id}`}><td><strong>{row.student_name}</strong><br /><span className="text-xs text-slate-500">{row.student_code}</span></td><td>{row.course_name}</td><td><Badge tone={row.enrollment_status === "active" ? "success" : "warning"}>{row.enrollment_status === "active" ? "Activo" : "Bloqueado"}</Badge></td><td><Button variant="ghost" disabled={pending || !row.student_id || !row.course_id} onClick={() => onToggle(row.course_id!, row.student_id!, row.enrollment_status === "active" ? "inactive" : "active")}>{row.enrollment_status === "active" ? "Bloquear acceso" : "Restaurar acceso"}</Button></td></tr>)}</tbody></table></div> : <EmptyState>No hay asignaciones para los filtros seleccionados.</EmptyState>}
  </Card>;
}

function StudentsPanel({ students, selectedStudentIds, studentSearch, hasCourses, pending, error, onStudentSearch, onToggle, onConfirm }: {
  students: Array<{ id: string; full_name: string; user_code: string; is_active: boolean }>;
  selectedStudentIds: Set<string>;
  studentSearch: string;
  hasCourses: boolean;
  pending: boolean;
  error?: string;
  onStudentSearch: (value: string) => void;
  onToggle: (studentId: string) => void;
  onConfirm: () => void;
}) {
  return <Card className="mt-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-bold">Asignar alumnos a este profesor</h2><p className="mt-1 text-sm text-slate-500">Selecciona todos los alumnos que deben permanecer asignados.</p></div><Button disabled={!hasCourses || pending} onClick={onConfirm}>Confirmar asignaciones</Button></div>
    {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}{!hasCourses && <div className="mt-4"><Alert tone="info">El profesor debe tener al menos un curso antes de recibir alumnos.</Alert></div>}
    <div className="mt-4"><Field label="Alumno"><Input placeholder="Buscar alumno por nombre o código" value={studentSearch} onChange={(event) => onStudentSearch(event.target.value)} /></Field></div>
    {students.length ? <div className="table-wrap mt-4"><table><thead><tr><th>Alumno</th><th>Código</th><th>Estado</th><th>Seleccionar</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><strong>{student.full_name}</strong></td><td>{student.user_code}</td><td><Badge tone={student.is_active ? "success" : "warning"}>{student.is_active ? "Activo" : "Inactivo"}</Badge></td><td><input aria-label={`Asignar a ${student.full_name}`} className="h-4 w-4 accent-indigo-600" type="checkbox" checked={selectedStudentIds.has(student.id)} onChange={() => onToggle(student.id)} /></td></tr>)}</tbody></table></div> : <EmptyState>No hay alumnos para los filtros seleccionados.</EmptyState>}
  </Card>;
}
