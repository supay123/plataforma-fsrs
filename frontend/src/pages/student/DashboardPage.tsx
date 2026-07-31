import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { listStudentCourses } from "../../features/courses/api";
import { courseProgress } from "../../features/progress/api";
export function StudentDashboardPage() {
  const courses = useQuery({ queryKey: ["student-courses"], queryFn: listStudentCourses });
  const progress = useQuery({ queryKey: ["course-progress"], queryFn: () => courseProgress() });
  if (courses.isLoading || progress.isLoading) return <Spinner />;
  return <><PageHeader title="Mi aprendizaje" description="Cursos activos y progreso observado." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{courses.data?.length ? courses.data.map((course) => { const result = progress.data?.find((row) => row.course_id === course.id); return <Link key={course.id} to={`/estudiante/cursos/${course.id}`}><Card className="h-full transition hover:-translate-y-0.5 hover:border-indigo-300"><span className="text-xs font-semibold uppercase text-indigo-600">Curso</span><h2 className="mt-2 text-lg font-bold">{course.name}</h2><p className="mt-1 text-sm text-slate-500">{course.description}</p><div className="mt-6 flex items-end justify-between"><strong className="text-3xl text-indigo-700">{result?.course_correct_percentage ?? "—"}{result?.course_correct_percentage != null && "%"}</strong><span className="text-xs text-slate-500">{result?.completed_sessions ?? 0} sesiones</span></div></Card></Link>; }) : <EmptyState>No tienes cursos activos.</EmptyState>}</div></>;
}
