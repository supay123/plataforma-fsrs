import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { BookOpen, Check, Lock } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, EmptyState, Eyebrow, PageHeader, ProgressBar } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/use-toast";
import { getRouteProgress, routeProgressKey, routeTopicTitle, type RouteLessonProgress } from "../../features/route-mode/api";

function RouteSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando">
    <Skeleton height={36} width="16rem" />
    <Skeleton className="mt-3" height={16} width="22rem" />
    {[0, 1].map((topic) => <div key={topic} className="mt-8">
      <Skeleton height={72} rounded="2xl" />
      <div className="mt-6 grid justify-items-center gap-6">{[0, 1, 2].map((node) => <Skeleton key={node} height={72} width={72} rounded="full" />)}</div>
    </div>)}
  </div>;
}

const nodeStyle = {
  locked: "border-line bg-sunken text-fg-faint",
  available: "border-primary bg-primary-soft text-primary-text shadow-[0_4px_0_var(--c-primary-strong)]",
  completed: "border-success bg-success-soft text-success-text shadow-[0_4px_0_var(--c-success-strong)]",
} as const;
const nodeIcon = { locked: Lock, available: BookOpen, completed: Check } as const;

function LessonNode({ lesson, index }: { lesson: RouteLessonProgress; index: number }) {
  const Icon = nodeIcon[lesson.status];
  // El camino serpentea: cada nodo se desplaza un poco a un lado, sin salir del contenedor.
  const offset = [0, 1, 0, -1][index % 4]! * 3;
  const caption = lesson.status === "locked" ? "Bloqueada" : lesson.best_percent === null ? "Sin intentos" : `Mejor: ${lesson.best_percent}%`;
  const circle = <span className={clsx("grid h-[72px] w-[72px] place-items-center rounded-full border-2 transition", nodeStyle[lesson.status], lesson.status !== "locked" && "group-hover:brightness-110 group-active:translate-y-1 group-active:shadow-none")}>
    <Icon size={28} />
  </span>;
  const label = <span className="mt-2 block min-w-0 max-w-56 text-center">
    <span className="block truncate font-semibold">{lesson.position}. {lesson.title}</span>
    <span className="block text-xs text-fg-muted">{caption}</span>
  </span>;
  const wrapper = clsx("group flex flex-col items-center");
  return <li style={{ transform: `translateX(${offset}rem)` }}>
    {lesson.status === "locked"
      ? <div className={wrapper} aria-disabled="true" aria-label={`${lesson.title}: bloqueada. Aprueba la lección anterior para abrirla.`}>{circle}{label}</div>
      : <Link to={`/estudiante/ruta/lecciones/${lesson.id}`} className={wrapper}>{circle}{label}</Link>}
  </li>;
}

export function RoutePage() {
  const toast = useToast();
  const progress = useQuery({ queryKey: routeProgressKey, queryFn: getRouteProgress });
  useEffect(() => { if (progress.error) toast.error(progress.error.message); }, [progress.error, toast]);
  if (progress.isLoading) return <RouteSkeleton />;
  const topics = (progress.data?.topics ?? []).filter((topic) => topic.lessons.length > 0);
  const passPercent = progress.data?.pass_percent ?? 80;
  return <>
    <PageHeader title="Modo ruta" description={`Aprende paso a paso. Para abrir la siguiente lección necesitas al menos ${passPercent}% de acierto en la anterior.`} />
    {topics.length === 0
      ? <EmptyState mascot>{progress.error ? "No pudimos cargar tu ruta." : "Tu profesor aún no publicó lecciones en el modo ruta."}</EmptyState>
      : <div className="grid gap-10">{topics.map((topic) => <section key={topic.id} aria-label={routeTopicTitle(topic)}>
        <Card glow className="p-4 sm:p-5">
          <Eyebrow>{`Tema ${topic.position}`}</Eyebrow>
          <h2 className="type-heading mt-2 text-xl sm:text-2xl">{topic.name}</h2>
          {topic.description && <p className="mt-1 text-sm text-fg-muted">{topic.description}</p>}
          <div className="mt-4"><ProgressBar value={(topic.completed_lessons / topic.lessons.length) * 100} size="sm" label={`Lecciones completadas del tema ${topic.position}`} /></div>
          <p className="mt-2 text-xs text-fg-muted">{topic.completed_lessons} de {topic.lessons.length} lecciones completadas</p>
        </Card>
        <ol className="mt-8 grid list-none justify-items-center gap-7 overflow-x-clip">{topic.lessons.map((lesson, index) => <LessonNode key={lesson.id} lesson={lesson} index={index} />)}</ol>
      </section>)}</div>}
  </>;
}
