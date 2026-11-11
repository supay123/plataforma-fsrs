import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Card, PageHeader } from "../../components/ui";
import { PageSkeleton } from "../../components/ui/skeleton";
import { courseProgress, sessionResults, topicProgress } from "../../features/progress/api";
export function StudentResultsPage() {
  const { studentId = "" } = useParams();
  const topics = useQuery({ queryKey: ["topic-progress", studentId], queryFn: () => topicProgress(studentId) });
  const courses = useQuery({ queryKey: ["course-progress", studentId], queryFn: () => courseProgress(studentId) });
  const sessions = useQuery({ queryKey: ["session-results", studentId], queryFn: () => sessionResults(studentId) });
  if (topics.isLoading || courses.isLoading || sessions.isLoading) return <PageSkeleton rows={4} rowHeight={140} columns={2} />;
  return <><PageHeader title={topics.data?.[0]?.student_name ?? "Resultados"} description="Progreso acumulado y exámenes completados." /><div className="grid gap-4 sm:grid-cols-2">{courses.data?.map((row) => <Card key={row.course_id}><strong>{row.course_name}</strong><p className="mt-2 text-3xl font-bold text-primary-light">{row.course_correct_percentage ?? 0}%</p><span className="text-sm text-fg-muted">{row.completed_sessions} sesiones</span></Card>)}</div><Card className="mt-6"><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Curso / tema</th><th>Resultado</th><th /></tr></thead><tbody>{sessions.data?.map((row) => <tr key={row.session_id}><td>{row.completed_at ? new Date(row.completed_at).toLocaleDateString("es-PE") : "—"}</td><td>{row.course_name} / {row.topic_name}</td><td>{row.correct_percentage}%</td><td><Link className="font-semibold text-primary-light" to={`/profesor/sesiones/${row.session_id}`}>Revisar</Link></td></tr>)}</tbody></table></div></Card></>;
}
