import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Card, Field, PageHeader, Select, Spinner } from "../../components/ui";
import { teacherStudents, setTopicAccess, topicAccess } from "../../features/progress/api";
import { useAuth } from "../../features/auth/AuthProvider";
import { enrollStudent, listCourses } from "../../features/courses/api";
import { listUsers } from "../../features/users/api";

export function TeacherDetailPage() {
  const { teacherId = "" } = useParams(); const { profile } = useAuth(); const client = useQueryClient();
  const [courseId, setCourseId] = useState(""); const [studentId, setStudentId] = useState("");
  const query = useQuery({ queryKey: ["teacher-students", teacherId], queryFn: teacherStudents });
  const courses = useQuery({ queryKey: ["courses"], queryFn: listCourses });
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const access = useQuery({ queryKey: ["topic-access"], queryFn: () => topicAccess() });
  const enroll = useMutation({ mutationFn: () => enrollStudent({ course_id: courseId, student_id: studentId, enrolled_by: profile!.id }), onSuccess: () => { void client.invalidateQueries({ queryKey: ["teacher-students"] }); void client.invalidateQueries({ queryKey: ["topic-access"] }); } });
  if (query.isLoading) return <Spinner />;
  const rows = query.data?.filter((row) => row.teacher_id === teacherId) ?? [];
  const teacherCourses = courses.data?.filter((course) => course.teacher_id === teacherId) ?? [];
  const students = users.data?.filter((user) => user.role === "student") ?? [];
  const teacherAccess = access.data?.filter((row) => teacherCourses.some((course) => course.id === row.course_id)) ?? [];
  return <><PageHeader title={rows[0]?.teacher_name ?? "Profesor"} description="Cursos, estudiantes asignados y bloqueos por tema." /><div className="grid gap-6 lg:grid-cols-[1fr_22rem]"><Card><div className="table-wrap"><table><thead><tr><th>Curso</th><th>Estudiante</th><th>Acceso</th><th>Última sesión</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.course_id}-${row.student_id}`}><td>{row.course_name}</td><td>{row.student_name}<br /><span className="text-xs text-slate-500">{row.student_code}</span></td><td>{row.student_is_active ? "Activo" : "Inactivo"}</td><td>{row.last_completed_session_at ? new Date(row.last_completed_session_at).toLocaleDateString("es-PE") : "Sin actividad"}</td></tr>)}</tbody></table></div></Card><Card><h2 className="mb-4 font-bold">Asignar estudiante</h2><div className="grid gap-3"><Field label="Curso"><Select value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">Seleccionar</option>{teacherCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</Select></Field><Field label="Estudiante"><Select value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Seleccionar</option>{students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</Select></Field><Button disabled={!courseId || !studentId || enroll.isPending} onClick={() => enroll.mutate()}>Asignar</Button></div></Card></div>{teacherAccess.length ? <Card className="mt-6"><h2 className="mb-3 font-bold">Acceso a temas</h2><div className="table-wrap"><table><thead><tr><th>Estudiante</th><th>Tema</th><th>Estado</th><th /></tr></thead><tbody>{teacherAccess.map((row) => <tr key={`${row.student_id}-${row.topic_id}`}><td>{row.student_name}</td><td>{row.topic_name}</td><td>{row.is_blocked ? "Bloqueado" : "Habilitado"}</td><td><TopicAccessButton studentId={row.student_id!} topicId={row.topic_id!} blocked={row.is_blocked ?? false} /></td></tr>)}</tbody></table></div></Card> : null}</>;
}

export function TopicAccessButton({ studentId, topicId, blocked }: { studentId: string; topicId: string; blocked: boolean }) {
  const { profile } = useAuth(); const client = useQueryClient();
  const mutation = useMutation({ mutationFn: () => setTopicAccess({ student_id: studentId, topic_id: topicId, is_blocked: !blocked, updated_by: profile!.id }), onSuccess: () => client.invalidateQueries({ queryKey: ["topic-access"] }) });
  return <Button variant="ghost" onClick={() => mutation.mutate()}>{blocked ? "Desbloquear" : "Bloquear"}</Button>;
}
