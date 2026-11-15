import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Card, PageHeader } from "../../components/ui";
import { PageSkeleton } from "../../components/ui/skeleton";
import { exportData } from "../../features/exports/api";
import { MascotHelp } from "../../features/mascot/MascotHelp";
import { teacherStudentsAdvice } from "../../features/mascot/teacher-advice";
import { teacherStudents } from "../../features/progress/api";
import { formatDate } from "../../lib/dates";
const STUDENTS_TIPS = [
  "Toca el nombre de un estudiante para ver su progreso por curso y las prácticas que completó.",
  "«Última sesión» es la fecha de su práctica más reciente; si está vacía, aún no empieza.",
  "«Exportar CSV» descarga los datos para trabajarlos en una hoja de cálculo.",
];

export function StudentsPage() {
  const query = useQuery({ queryKey: ["teacher-students"], queryFn: teacherStudents });
  if (query.isLoading) return <PageSkeleton rows={6} rowHeight={52} />;
  const advice = teacherStudentsAdvice(query.data ?? [], new Date());
  return <><PageHeader title="Estudiantes" description="Asignaciones y última actividad." actions={<Button variant="secondary" onClick={() => void exportData()}>Exportar CSV</Button>} /><MascotHelp className="mb-6" screen="teacher-students" advice={advice} tips={STUDENTS_TIPS} /><Card><div className="table-wrap"><table><thead><tr><th>Estudiante</th><th>Curso</th><th>Vigencia</th><th>Última sesión</th></tr></thead><tbody>{query.data?.map((row) => <tr key={`${row.student_id}-${row.course_id}`}><td><Link className="font-semibold text-primary-text" to={`/profesor/estudiantes/${row.student_id}/resultados`}>{row.student_name}</Link><br /><span className="text-xs text-fg-muted">{row.student_code}</span></td><td>{row.course_name}</td><td>{formatDate(row.access_valid_until)}</td><td>{formatDate(row.last_completed_session_at)}</td></tr>)}</tbody></table></div></Card></>;
}
