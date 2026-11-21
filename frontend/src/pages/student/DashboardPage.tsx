import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, EmptyState, Eyebrow, PageHeader, ProgressBar } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { listStudentCourses } from "../../features/courses/api";
import { dashboardAdvice, type Advice } from "../../features/mascot/dashboard-advice";
import { MascotAdvice } from "../../features/mascot/MascotAdvice";
import { courseProgress, topicAccess, topicDueReviews, topicProgress } from "../../features/progress/api";
import { averageCourseScore, formatPercentage, percentageToGrade } from "../../features/progress/metrics";
import { strongestTopic, topicsToReview, type StrongestTopic, type TopicToReview } from "../../features/progress/topic-review";
import { normalizeSearch } from "../../lib/text";

interface CourseRow { id: string; name: string; description: string | null; percentage: number | null; sessions: number }

function DashboardSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando" className="grid grid-cols-[minmax(0,1fr)] gap-8">
    <div>
      <Skeleton height={40} width="14rem" />
      <Skeleton className="mt-1" height={24} width="min(20rem, 100%)" />
    </div>
    <div className="grid grid-cols-1 gap-4 @xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className="h-[200px] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4"><Skeleton height={14} width="7rem" /><Skeleton height={32} width="6rem" /></div>
        <Skeleton className="mt-3" height={48} width="8rem" />
        <Skeleton className="mt-3" height={12} rounded="full" />
        <Skeleton className="mt-4" height={52} rounded="2xl" />
      </Card>
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">{[0, 1].map((item) => <div key={item} className="grid h-9 content-between"><Skeleton height={12} width="5rem" /><Skeleton height={18} width="70%" /></div>)}</div>
        <Skeleton className="mt-auto" height={32} rounded="xl" />
        <Skeleton height={16} width="60%" className="-mt-2" />
      </Card>
    </div>
    <section className="grid grid-cols-1 gap-4">
      <Skeleton height={32} width="10rem" />
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-3">{[0, 1, 2].map((item) => <Card key={item} className="h-[138px] p-4">
        <div className="flex items-center gap-3">
          <Skeleton height={44} width={44} rounded="xl" className="shrink-0" />
          <div className="grid min-w-0 flex-1 gap-2"><Skeleton height={20} width="60%" /><Skeleton height={14} width="80%" /></div>
        </div>
        <Skeleton className="mt-2" height={20} width="70%" />
        <Skeleton className="mt-3" height={6} rounded="full" />
      </Card>)}</div>
    </section>
  </div>;
}

/** Acierto total de todos los cursos, con la mascota asomando por la esquina de la tarjeta. */
function GradeCard({ totalScore, advice }: { totalScore: number | null; advice: Advice }) {
  return <Card glow className="relative flex flex-col justify-between overflow-hidden p-4 sm:p-5">
    <div>
      <div className="flex items-start justify-between gap-4">
        <Eyebrow>Acierto total</Eyebrow>
        {totalScore !== null && <p className="flex shrink-0 items-baseline gap-2">
          <span className="text-xs text-fg-muted">Nota</span>
          <span className="type-heading text-2xl tabular-nums sm:text-3xl">{percentageToGrade(totalScore)}<span className="type-body text-sm text-fg-faint sm:text-base"> / 20</span></span>
        </p>}
      </div>
      <strong className="type-display -mt-1 block text-4xl leading-none tabular-nums md:text-5xl">{totalScore === null ? "—" : `${formatPercentage(totalScore)}%`}</strong>
      {totalScore !== null && <div className="mt-3"><ProgressBar value={totalScore} label="Acierto total" /></div>}
    </div>
    <MascotAdvice peeking className="-mx-4 -mb-4 mt-4 sm:-mx-5 sm:-mb-5" event={advice.event}>{advice.text}</MascotAdvice>
  </Card>;
}

/** Qué tema va mejor y cuál repasar primero; el botón se activa solo si hay preguntas vencidas. */
function FocusCard({ strongest, topicsToRepeat }: { strongest: StrongestTopic | undefined; topicsToRepeat: TopicToReview[] }) {
  const mostOverdue = topicsToRepeat[0];
  const items = [
    { label: "Más fuerte", name: strongest?.topicName, detail: strongest ? percentageToGrade(strongest.percentage) : undefined },
    { label: "Por repasar", name: mostOverdue?.topicName, detail: mostOverdue?.dueQuestions },
  ];
  return <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-1">
      {items.map((item) => <div key={item.label} className="min-w-0">
        <dt className="text-xs text-fg-faint">{item.label}</dt>
        <dd className="flex min-w-0 items-baseline gap-2 text-fg-muted">
          <span className="truncate">{item.name ?? "Aún sin datos"}</span>
          {item.detail !== undefined && <span className="tabular-nums text-fg">{item.detail}</span>}
        </dd>
      </div>)}
    </dl>
    <div className="mt-auto">
      {topicsToRepeat.length
        ? <Link to="/estudiante/repasar" className="block"><Button size="sm" className="w-full">Repasar temas ({topicsToRepeat.length})</Button></Link>
        : <Button size="sm" className="w-full" disabled>Repasar temas</Button>}
      {!topicsToRepeat.length && <p className="mt-2 text-xs text-fg-faint">Se activa cuando tengas preguntas por repasar.</p>}
    </div>
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
  const topics = useQuery({ queryKey: ["topic-progress"], queryFn: () => topicProgress() });
  const access = useQuery({ queryKey: ["topic-access", "all"], queryFn: () => topicAccess() });
  const dueReviews = useQuery({ queryKey: ["topic-due-reviews"], queryFn: topicDueReviews });
  const [query, setQuery] = useState("");
  if (courses.isLoading || progress.isLoading || topics.isLoading || access.isLoading || dueReviews.isLoading) return <DashboardSkeleton />;
  const rows: CourseRow[] = (courses.data ?? []).map((course) => {
    const result = progress.data?.find((row) => row.course_id === course.id);
    const percentage = result?.course_correct_percentage;
    return { id: course.id, name: course.name, description: course.description, percentage: percentage === null || percentage === undefined ? null : Number(percentage), sessions: result?.completed_sessions ?? 0 };
  });
  const lastCompletedAt = (progress.data ?? []).map((row) => row.last_completed_at).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const topicsToRepeat = topicsToReview(dueReviews.data ?? [], access.data ?? []);
  const advice = dashboardAdvice({ courseCount: rows.length, lastCompletedAt, topicsToReview: topicsToRepeat.length, now: new Date() });
  const totalScore = averageCourseScore(rows.map((row) => row.percentage));
  const visible = rows.filter((row) => normalizeSearch(row.name).includes(normalizeSearch(query)));
  return <div className="grid grid-cols-1 gap-8">
    <PageHeader className="mb-0! portal:mb-0!" title="Mi aprendizaje" description="Cursos activos y progreso observado." />
    <div className="grid grid-cols-1 gap-4 @xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <GradeCard totalScore={totalScore} advice={advice} />
      <FocusCard strongest={strongestTopic(topics.data ?? [], access.data ?? [])} topicsToRepeat={topicsToRepeat} />
    </div>
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
