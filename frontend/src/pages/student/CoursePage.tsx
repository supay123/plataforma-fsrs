import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ExternalLink, Lock } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, PageHeader } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { listStudentCourses, listTopics } from "../../features/courses/api";
import { topicAccess, topicProgress } from "../../features/progress/api";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

function CourseSkeleton() {
  return <div aria-busy="true">
    <Skeleton height={36} width="16rem" rounded="none" />
    <Skeleton className="mt-3" height={16} width="20rem" rounded="none" />
    <div className="mt-8 grid gap-4">{[0, 1, 2].map((item) => <Skeleton key={item} height={92} rounded="none" />)}</div>
  </div>;
}

export function StudentCoursePage() {
  const { courseId = "" } = useParams();
  const courses = useQuery({ queryKey: ["student-courses"], queryFn: listStudentCourses });
  const topics = useQuery({ queryKey: ["topics", courseId], queryFn: () => listTopics(courseId) });
  const access = useQuery({ queryKey: ["topic-access", courseId], queryFn: () => topicAccess(courseId) });
  const progress = useQuery({ queryKey: ["topic-progress"], queryFn: () => topicProgress() });
  if (topics.isLoading || access.isLoading) return <CourseSkeleton />;
  const active = topics.data?.filter((topic) => topic.status === "active") ?? [];
  return <>
    <Link to="/estudiante" className="mb-4 inline-flex items-center gap-1 text-sm text-fg-muted transition hover:text-fg-strong"><ChevronLeft size={16} />Mi aprendizaje</Link>
    <PageHeader title={courses.data?.find((c) => c.id === courseId)?.name ?? "Curso"} description="Temas, materiales y sesiones disponibles." />
    <div className="grid gap-4">{active.map((topic, index) => {
      const blocked = access.data?.find((row) => row.topic_id === topic.id)?.is_blocked ?? false;
      const result = progress.data?.find((row) => row.topic_id === topic.id);
      return <Card key={topic.id} className={`flex flex-col justify-between gap-4 sm:flex-row sm:items-center ${blocked ? "opacity-55" : "transition-all duration-200 hover:border-primary/45"}`}>
        <div className="flex items-center gap-5">
          <span aria-hidden className="hidden w-8 text-center font-display text-xl text-ornament/50 sm:block">{ROMAN[index] ?? index + 1}</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-fg-strong">{topic.name}</h2>
              {blocked && <span className="flex items-center gap-1 border border-danger/40 px-2 py-0.5 text-[11px] font-semibold text-danger-light"><Lock size={11} />Bloqueado</span>}
            </div>
            <p className="mt-1 text-sm text-fg-muted">{result ? <><span className="font-semibold tabular-nums text-primary-light">{result.correct_percentage}%</span> · {result.completed_sessions} sesiones</> : "Sin datos"}</p>
            {topic.material_url && <a className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary-light hover:underline" href={topic.material_url} target="_blank" rel="noreferrer">Material <ExternalLink size={13} /></a>}
          </div>
        </div>
        <Link to={`/estudiante/temas/${topic.id}/sesion`}><Button disabled={blocked}>{result ? "Continuar práctica" : "Iniciar práctica"}</Button></Link>
      </Card>;
    })}</div>
  </>;
}
