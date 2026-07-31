import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, PageHeader, Spinner } from "../../components/ui";
import { listStudentCourses, listTopics } from "../../features/courses/api";
import { topicAccess, topicProgress } from "../../features/progress/api";
export function StudentCoursePage() {
  const { courseId = "" } = useParams();
  const courses = useQuery({ queryKey: ["student-courses"], queryFn: listStudentCourses });
  const topics = useQuery({ queryKey: ["topics", courseId], queryFn: () => listTopics(courseId) });
  const access = useQuery({ queryKey: ["topic-access", courseId], queryFn: () => topicAccess(courseId) });
  const progress = useQuery({ queryKey: ["topic-progress"], queryFn: () => topicProgress() });
  if (topics.isLoading || access.isLoading) return <Spinner />;
  return <><PageHeader title={courses.data?.find((c) => c.id === courseId)?.name ?? "Curso"} description="Temas, materiales y sesiones disponibles." /><div className="grid gap-4">{topics.data?.filter((topic) => topic.status === "active").map((topic) => { const blocked = access.data?.find((row) => row.topic_id === topic.id)?.is_blocked ?? false; const result = progress.data?.find((row) => row.topic_id === topic.id); return <Card key={topic.id} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><h2 className="font-bold">{topic.name}</h2>{blocked && <Badge tone="warning">Bloqueado</Badge>}</div><p className="mt-1 text-sm text-slate-500">{result ? `${result.correct_percentage}% · ${result.completed_sessions} sesiones` : "Sin datos"}</p>{topic.material_url && <a className="mt-2 inline-flex items-center gap-1 text-sm text-indigo-600" href={topic.material_url} target="_blank" rel="noreferrer">Material <ExternalLink size={14} /></a>}</div><Link to={`/estudiante/temas/${topic.id}/sesion`}><Button disabled={blocked}>{result ? "Continuar práctica" : "Iniciar sesión"}</Button></Link></Card>; })}</div></>;
}
