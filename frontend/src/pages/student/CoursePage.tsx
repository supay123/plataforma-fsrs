import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ExternalLink, Lock } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card, PageHeader, ProgressBar } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { listStudentCourses, listTopics } from "../../features/courses/api";
import { MascotAdvice } from "../../features/mascot/MascotAdvice";
import { topicAccess, topicProgress } from "../../features/progress/api";
import { prefersReducedMotion } from "../../features/sessions/mascot-support";

// Lo que dura el saltito de la mascota antes de abrir la práctica.
const HOP_BEFORE_NAVIGATING_MS = 600;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

function CourseSkeleton() {
  return <div aria-busy="true">
    <Skeleton height={36} width="16rem" />
    <Skeleton className="mt-3" height={16} width="20rem" />
    <div className="mt-8 grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} height={170} rounded="2xl" />)}</div>
  </div>;
}

export function StudentCoursePage() {
  const { courseId = "" } = useParams();
  const courses = useQuery({ queryKey: ["student-courses"], queryFn: listStudentCourses });
  const topics = useQuery({ queryKey: ["topics", courseId], queryFn: () => listTopics(courseId) });
  const access = useQuery({ queryKey: ["topic-access", courseId], queryFn: () => topicAccess(courseId) });
  const progress = useQuery({ queryKey: ["topic-progress"], queryFn: () => topicProgress() });
  const navigate = useNavigate();
  const [pickedTopic, setPickedTopic] = useState<{ name: string; count: number } | null>(null);
  const navigationTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(navigationTimer.current), []);
  if (topics.isLoading || access.isLoading) return <CourseSkeleton />;
  const active = topics.data?.filter((topic) => topic.status === "active") ?? [];
  function pickTopic(event: MouseEvent<HTMLAnchorElement>, topic: { id: string; name: string }): void {
    const opensInNewTab = event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;
    if (opensInNewTab || prefersReducedMotion()) return;
    event.preventDefault();
    setPickedTopic((current) => ({ name: topic.name, count: (current?.count ?? 0) + 1 }));
    window.clearTimeout(navigationTimer.current);
    navigationTimer.current = window.setTimeout(() => navigate(`/estudiante/temas/${topic.id}/sesion`), HOP_BEFORE_NAVIGATING_MS);
  }
  return <div className="grid grid-cols-1 gap-6">
    <Link to="/estudiante" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-fg-muted transition hover:text-fg"><ChevronLeft size={16} />Mi aprendizaje</Link>
    <PageHeader className="mb-0! portal:mb-0!" title={courses.data?.find((c) => c.id === courseId)?.name ?? "Curso"} description="Temas, materiales y sesiones disponibles." />
    <MascotAdvice event={pickedTopic ? "correct" : active.length ? "rest" : "sleep"} eventKey={pickedTopic?.count}>
      {pickedTopic ? `¡Vamos con «${pickedTopic.name}»!` : active.length ? "Elige un tema para practicar. Los marcados como «Nuevo» todavía no los has practicado." : "Este curso aún no tiene temas disponibles. Vuelve pronto."}
    </MascotAdvice>
    {/* Los temas se eligen libremente: solo uno que el profesor bloqueó no se puede abrir. */}
    <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">{active.map((topic, index) => {
      const blocked = access.data?.find((row) => row.topic_id === topic.id)?.is_blocked ?? false;
      const result = progress.data?.find((row) => row.topic_id === topic.id);
      return <Card key={topic.id} className={`flex min-h-44 flex-col gap-4 p-5 ${blocked ? "opacity-55" : "transition hover:border-primary"}`}>
        <div className="flex items-start justify-between gap-3">
          <span aria-hidden className="type-display text-3xl leading-none text-secondary-text">{ROMAN[index] ?? index + 1}</span>
          {blocked ? <span className="inline-flex items-center gap-1 rounded-lg bg-sunken px-2 py-1 text-xs font-semibold text-fg-muted"><Lock size={12} />Bloqueado</span>
            : result ? <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-on-primary" role="img" aria-label="Practicado"><Check size={16} strokeWidth={3} /></span>
            : <span className="rounded-lg bg-primary-soft px-2 py-1 text-xs font-semibold text-primary-text">Nuevo</span>}
        </div>
        <h2 className="type-heading mt-auto text-lg leading-snug">
          {blocked ? topic.name : <Link to={`/estudiante/temas/${topic.id}/sesion`} aria-label={`${result ? "Continuar práctica" : "Iniciar práctica"}: ${topic.name}`} onClick={(event) => pickTopic(event, topic)} className="after:absolute after:inset-0 after:rounded-2xl">{topic.name}</Link>}
        </h2>
        <div>
          <ProgressBar value={result?.correct_percentage ?? 0} size="sm" />
          <p className="mt-2 text-sm text-fg-muted">{result ? <><span className="font-semibold tabular-nums text-primary-text">{result.correct_percentage}%</span> · {result.completed_sessions} sesiones</> : "Sin datos"}</p>
          {topic.material_url && <a className="relative z-10 mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline" href={topic.material_url} target="_blank" rel="noreferrer">Material <ExternalLink size={13} /></a>}
        </div>
      </Card>;
    })}</div>
  </div>;
}
