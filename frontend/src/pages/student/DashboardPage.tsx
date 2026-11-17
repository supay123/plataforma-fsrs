import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, EmptyState, Eyebrow, PageHeader, ProgressBar } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { listStudentCourses } from "../../features/courses/api";
import { dashboardAdvice } from "../../features/mascot/dashboard-advice";
import { MascotAdvice } from "../../features/mascot/MascotAdvice";
import { countDueReviews, courseProgress } from "../../features/progress/api";
import { averageCourseScore, formatPercentage, percentageToGrade } from "../../features/progress/metrics";
import { normalizeSearch } from "../../lib/text";

interface CourseRow { id: string; name: string; description: string | null; percentage: number | null; sessions: number }

function DashboardSkeleton() {
  return <div aria-busy="true">
    <Skeleton height={36} width="16rem" />
    <Skeleton className="mt-3" height={16} width="22rem" />
    <Skeleton className="mt-8" height={170} rounded="2xl" />
    <div className="mt-6 grid gap-4 @xl:grid-cols-2 @5xl:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} height={110} rounded="2xl" />)}</div>
  </div>;
}

/** La nota de siempre. Con muchos cursos no se listan todos: solo el más fuerte y el que hay que reforzar. */
function GradeCard({ totalScore, rows }: { totalScore: number | null; rows: CourseRow[] }) {
  const practiced = rows.filter((row) => row.percentage !== null).sort((a, b) => b.percentage! - a.percentage!);
  const best = practiced[0];
  const weakest = practiced[practiced.length - 1];
  return <Card glow className="p-5 sm:p-6">
    <Eyebrow>Acierto total</Eyebrow>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
      <strong className="type-display block text-5xl leading-none tabular-nums md:text-6xl">{totalScore === null ? "—" : `${formatPercentage(totalScore)}%`}</strong>
      {totalScore !== null && <p className="text-right">
        <span className="text-xs text-fg-muted">Nota</span><br />
        <span className="type-heading text-3xl tabular-nums">{percentageToGrade(totalScore)}<span className="type-body text-base text-fg-faint"> / 20</span></span>
      </p>}
    </div>
    {totalScore !== null && <div className="mt-5"><ProgressBar value={totalScore} label="Acierto total" /></div>}
    <p className="mt-3 text-sm text-fg-muted">Promedio de los cursos con sesiones completadas.</p>
    {best && weakest && best !== weakest && <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
      {([["Más fuerte", best], ["Por reforzar", weakest]] as const).map(([label, row]) => <div key={label} className="min-w-0">
        <dt className="text-xs text-fg-faint">{label}</dt>
        <dd className="flex justify-between gap-2 text-fg-muted"><span className="truncate">{row.name}</span><span className="tabular-nums text-fg">{percentageToGrade(row.percentage!)}</span></dd>
      </div>)}
    </dl>}
  </Card>;
}

function CourseTile({ row, index }: { row: CourseRow; index: number }) {
  return <Link to={`/estudiante/cursos/${row.id}`} className="block min-w-0 rounded-2xl">
    <Card className="h-full p-4 transition hover:border-primary active:translate-y-0.5">
      <div className="flex items-center gap-3">
        <span className={`type-heading grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg ${index % 2 ? "bg-secondary-soft text-secondary-text" : "bg-primary-soft text-primary-text"}`}>{row.name[0]}</span>
        <div className="min-w-0 flex-1">
          <h2 className="type-heading truncate text-lg">{row.name}</h2>
          <p className="truncate text-sm text-fg-muted">{row.percentage === null ? "Sin practicar" : `${formatPercentage(row.percentage)}% de acierto · ${row.sessions} ${row.sessions === 1 ? "sesión" : "sesiones"}`}</p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-fg-faint" />
      </div>
      {row.description && <p className="mt-2 line-clamp-2 text-sm text-fg-muted">{row.description}</p>}
      <div className="mt-3"><ProgressBar value={row.percentage ?? 0} size="sm" /></div>
    </Card>
  </Link>;
}

export function StudentDashboardPage() {
  const courses = useQuery({ queryKey: ["student-courses"], queryFn: listStudentCourses });
  const progress = useQuery({ queryKey: ["course-progress"], queryFn: () => courseProgress() });
  const dueReviews = useQuery({ queryKey: ["due-reviews"], queryFn: countDueReviews });
  const [query, setQuery] = useState("");
  if (courses.isLoading || progress.isLoading) return <DashboardSkeleton />;
  const rows: CourseRow[] = (courses.data ?? []).map((course) => {
    const result = progress.data?.find((row) => row.course_id === course.id);
    const percentage = result?.course_correct_percentage;
    return { id: course.id, name: course.name, description: course.description, percentage: percentage === null || percentage === undefined ? null : Number(percentage), sessions: result?.completed_sessions ?? 0 };
  });
  const lastCompletedAt = (progress.data ?? []).map((row) => row.last_completed_at).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const advice = dashboardAdvice({ courseCount: rows.length, lastCompletedAt, dueReviews: dueReviews.data ?? null, now: new Date() });
  const totalScore = averageCourseScore(rows.map((row) => row.percentage));
  const visible = rows.filter((row) => normalizeSearch(row.name).includes(normalizeSearch(query)));
  return <div className="grid grid-cols-1 gap-8">
    <PageHeader className="mb-0! portal:mb-0!" title="Mi aprendizaje" description="Cursos activos y progreso observado." />
    <MascotAdvice event={advice.event}>{advice.text}</MascotAdvice>
    <GradeCard totalScore={totalScore} rows={rows} />
    <section className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="type-display text-2xl">Mis cursos <span className="type-body text-base text-fg-faint">({rows.length})</span></h2>
        {rows.length > 4 && <label className="relative block w-full @xl:max-w-xs">
          <span className="sr-only">Buscar curso</span>
          <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-faint" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar curso"
            className="w-full rounded-xl border-2 border-line-strong bg-sunken py-2.5 pr-4 pl-11 text-on-blocks placeholder:text-fg-faint focus:border-primary focus:outline-none" />
        </label>}
      </div>
      {!rows.length ? <EmptyState>No tienes cursos activos.</EmptyState>
        : visible.length ? <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-3">{visible.map((row) => <CourseTile key={row.id} row={row} index={rows.indexOf(row)} />)}</div>
        : <p className="text-fg-muted">Ningún curso coincide con «{query}».</p>}
    </section>
  </div>;
}
