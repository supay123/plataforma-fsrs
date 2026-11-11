import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, EmptyState, Eyebrow, PageHeader, ProgressBar } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { listStudentCourses } from "../../features/courses/api";
import { courseProgress } from "../../features/progress/api";
import { averageCourseScore, formatPercentage } from "../../features/progress/metrics";

function DashboardSkeleton() {
  return <div aria-busy="true">
    <Skeleton height={36} width="16rem" rounded="none" />
    <Skeleton className="mt-3" height={16} width="22rem" rounded="none" />
    <Skeleton className="mt-8" height={170} rounded="none" />
    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} height={170} rounded="none" />)}</div>
  </div>;
}

export function StudentDashboardPage() {
  const courses = useQuery({ queryKey: ["student-courses"], queryFn: listStudentCourses });
  const progress = useQuery({ queryKey: ["course-progress"], queryFn: () => courseProgress() });
  if (courses.isLoading || progress.isLoading) return <DashboardSkeleton />;
  const totalScore = averageCourseScore(
    (progress.data ?? []).map((row) => row.course_correct_percentage),
  );
  return <>
    <PageHeader title="Mi aprendizaje" description="Cursos activos y progreso observado." />
    <Card glow className="relative mb-6 overflow-hidden p-6 md:p-8">
      <div aria-hidden className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Acierto total</Eyebrow>
          <strong className="mt-3 block font-display text-5xl font-normal leading-none text-primary-light md:text-6xl">
            {totalScore === null ? "—" : `${formatPercentage(totalScore)}%`}
          </strong>
          <p className="mt-3 text-sm text-fg-muted">Promedio de los cursos con sesiones completadas.</p>
        </div>
        {totalScore !== null && <div className="text-right">
          <Eyebrow>Nota</Eyebrow>
          <p className="mt-2 font-display text-3xl text-primary-pale">{Number((totalScore / 5).toFixed(1))}<span className="text-fg-faint"> / 20</span></p>
        </div>}
      </div>
      {totalScore !== null && <div className="relative mt-6"><ProgressBar value={totalScore} label="Acierto total" /></div>}
    </Card>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{courses.data?.length ? courses.data.map((course) => {
      const result = progress.data?.find((row) => row.course_id === course.id);
      const percentage = result?.course_correct_percentage ?? null;
      return <Link key={course.id} to={`/estudiante/cursos/${course.id}`}>
        <Card className="flex h-full flex-col transition-all duration-200 hover:border-primary/45 hover:shadow-[0_0_30px_-16px_var(--color-primary)]">
          <Eyebrow>Curso</Eyebrow>
          <h2 className="mt-2 font-display text-xl tracking-wide text-primary-pale">{course.name}</h2>
          <p className="mt-1 min-h-5 text-sm text-fg-muted">{course.description}</p>
          <div className="mt-6 flex items-end justify-between">
            <strong className="text-3xl font-semibold leading-none tabular-nums text-primary-light">{percentage ?? "—"}{percentage !== null && "%"}</strong>
            <span className="text-xs text-fg-faint">{result?.completed_sessions ?? 0} sesiones</span>
          </div>
          {percentage !== null && <div className="mt-3"><ProgressBar value={percentage} /></div>}
        </Card>
      </Link>;
    }) : <EmptyState>No tienes cursos activos.</EmptyState>}</div>
  </>;
}
