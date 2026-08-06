import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { listStudentCourses } from "../../features/courses/api";
import { courseProgress } from "../../features/progress/api";
import { averageCourseScore, formatPercentage } from "../../features/progress/metrics";
export function StudentDashboardPage() {
  const courses = useQuery({ queryKey: ["student-courses"], queryFn: listStudentCourses });
  const progress = useQuery({ queryKey: ["course-progress"], queryFn: () => courseProgress() });
  if (courses.isLoading || progress.isLoading) return <Spinner />;
  const totalScore = averageCourseScore(
    (progress.data ?? []).map((row) => row.course_correct_percentage),
  );
  return <>
    <PageHeader title="Mi aprendizaje" description="Cursos activos y progreso observado." />
    <Card className="mb-6 border-indigo-200 bg-gradient-to-r from-indigo-50 to-white">
      <span className="text-sm font-semibold text-indigo-700">Acierto total</span>
      <strong className="mt-2 block text-4xl text-indigo-700">
        {totalScore === null
          ? "—"
          : `${formatPercentage(totalScore)}% (${Number((totalScore / 5).toFixed(1))})`}
      </strong>
      <p className="mt-1 text-xs text-slate-500">Promedio de los cursos con sesiones completadas.</p>
    </Card>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{courses.data?.length ? courses.data.map((course) => {
      const result = progress.data?.find((row) => row.course_id === course.id);
      return <Link key={course.id} to={`/estudiante/cursos/${course.id}`}><Card className="h-full transition hover:-translate-y-0.5 hover:border-indigo-300"><span className="text-xs font-semibold uppercase text-indigo-600">Curso</span><h2 className="mt-2 text-lg font-bold">{course.name}</h2><p className="mt-1 text-sm text-slate-500">{course.description}</p><div className="mt-6 flex items-end justify-between"><strong className="text-3xl text-indigo-700">{result?.course_correct_percentage ?? "—"}{result?.course_correct_percentage != null && "%"}</strong><span className="text-xs text-slate-500">{result?.completed_sessions ?? 0} sesiones</span></div></Card></Link>;
    }) : <EmptyState>No tienes cursos activos.</EmptyState>}</div>
  </>;
}
