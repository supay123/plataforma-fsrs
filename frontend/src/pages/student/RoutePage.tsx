import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, EmptyState, Eyebrow, PageHeader, ProgressBar } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/use-toast";
import { RouteIsland } from "../../features/route-mode/RouteIsland";
import { RouteCourseSelector } from "../../features/route-mode/RouteCourseSelector";
import { getRouteProgress, routeProgressKey, routeTopicTitle, type RouteCourseProgress, type RouteLessonProgress, type RouteTopicProgress } from "../../features/route-mode/api";

/** Curso elegido por última vez: así al volver de una lección se queda en el mismo curso. */
const SELECTED_COURSE_STORAGE_KEY = "routeCourseId";

const SKELETON_POSITIONS = ["justify-start", "justify-center", "justify-end", "justify-center"] as const;

function RouteSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando">
    <Skeleton height={40} width="10rem" />
    <Skeleton className="mt-1" height={24} width="min(32rem, 100%)" />
    <div className="mt-8 grid gap-10">{[0, 1].map((topic) => <div key={topic}>
      <Skeleton className="mx-auto" height={68} width="min(16.5rem, 100%)" rounded="2xl" />
      <ul className="mx-auto mt-6 grid max-w-xl list-none gap-8 overflow-x-clip pb-4">{[0, 1, 2, 3].map((node) => <li key={node} className={clsx("flex", SKELETON_POSITIONS[(topic * 4 + node) % 4])}>
        <div className="flex items-center gap-4">
          <Skeleton height={70} width={112} rounded="full" />
          <div className="grid gap-2"><Skeleton height={16} width={112} /><Skeleton height={12} width={72} /></div>
        </div>
      </li>)}</ul>
    </div>)}</div>
  </div>;
}

interface LessonNodeProps {
  lesson: RouteLessonProgress;
  /** Posición en el zigzag; sigue contando de un tema al siguiente. */
  index: number;
  selected: boolean;
}

function LessonNode({ lesson, index, selected }: LessonNodeProps) {
  // El camino serpentea a lo ancho: izquierda, centro, derecha, centro. El título siempre va a la derecha de la isla.
  const position = ["left", "center", "right", "center"][index % 4]!;
  const caption = lesson.status === "locked" ? "Bloqueada" : lesson.best_percent === null ? "Sin intentos" : `Mejor: ${lesson.best_percent}%`;
  const content = <>
    <RouteIsland status={lesson.status} selected={selected} />
    <span className={clsx("min-w-0 max-w-32 sm:max-w-44", lesson.status === "locked" && "text-fg-faint")}>
      <span className="block truncate font-semibold">{lesson.position}. {lesson.title}</span>
      <span className="block text-xs text-fg-muted">{caption}</span>
    </span>
  </>;
  const row = clsx("flex items-center gap-4", selected && "pt-16");
  return <li className={clsx("flex", position === "left" && "justify-start", position === "center" && "justify-center", position === "right" && "justify-end")}>
    {lesson.status === "locked"
      ? <div className={row} aria-disabled="true" aria-label={`${lesson.title}: bloqueada. Aprueba la lección anterior para abrirla.`}>{content}</div>
      : <Link to={`/estudiante/ruta/lecciones/${lesson.id}`} className={clsx(row, "transition hover:brightness-110")}>{content}</Link>}
  </li>;
}

/** La lección donde está el estudiante: la primera abierta sin completar (o la última si ya terminó todo). */
function currentLessonId(topics: RouteTopicProgress[]): string | null {
  const lessons = topics.flatMap((topic) => topic.lessons);
  return (lessons.find((lesson) => lesson.status === "available") ?? lessons[lessons.length - 1])?.id ?? null;
}

/** Cursos con al menos una lección lista, en el orden del profesor. */
function coursesWithLessons(courses: RouteCourseProgress[], topics: RouteTopicProgress[]): RouteCourseProgress[] {
  return courses.filter((course) => topics.some((topic) => topic.route_course_id === course.id));
}

export function RoutePage() {
  const toast = useToast();
  const progress = useQuery({ queryKey: routeProgressKey, queryFn: getRouteProgress });
  const [pickedCourseId, setPickedCourseId] = useState(() => sessionStorage.getItem(SELECTED_COURSE_STORAGE_KEY));
  useEffect(() => { if (progress.error) toast.error(progress.error.message); }, [progress.error, toast]);
  if (progress.isLoading) return <RouteSkeleton />;
  const allTopics = (progress.data?.topics ?? []).filter((topic) => topic.lessons.length > 0);
  const courses = coursesWithLessons(progress.data?.courses ?? [], allTopics);
  // Sin elección válida se abre el curso donde el estudiante tiene su próxima lección.
  const currentCourseId = allTopics.find((topic) => topic.lessons.some((lesson) => lesson.status === "available"))?.route_course_id;
  const selectedCourse = courses.find((course) => course.id === pickedCourseId) ?? courses.find((course) => course.id === currentCourseId) ?? courses[0] ?? null;
  const selectCourse = (courseId: string) => { sessionStorage.setItem(SELECTED_COURSE_STORAGE_KEY, courseId); setPickedCourseId(courseId); };
  const topics = allTopics.filter((topic) => topic.route_course_id === selectedCourse?.id);
  const showTeacherNames = new Set(courses.map((course) => course.teacher_id)).size > 1;
  // El zigzag no se reinicia en cada tema: la primera isla de un tema sigue donde terminó la del anterior.
  const firstIndexByTopic = topics.map((_, topicIndex) => topics.slice(0, topicIndex).reduce((total, topic) => total + topic.lessons.length, 0));
  const currentId = currentLessonId(topics);
  const passPercent = progress.data?.pass_percent ?? 80;
  return <>
    <PageHeader title="Modo ruta" description={`Aprende paso a paso. Para abrir la siguiente lección necesitas al menos ${passPercent}% de acierto en la anterior.`} />
    {courses.length > 1 && <>
      <RouteCourseSelector courses={courses} selectedCourseId={selectedCourse?.id ?? null} showTeacherNames={showTeacherNames} onSelect={selectCourse} />
      <hr className="mb-8 border-line" />
    </>}
    {topics.length === 0
      ? <EmptyState mascot>{progress.error ? "No pudimos cargar tu ruta." : "Tu profesor aún no publicó lecciones en el modo ruta."}</EmptyState>
      : <div className="grid gap-10">{topics.map((topic, topicIndex) => {
        // Un tema está alcanzado cuando el estudiante ya tiene alguna lección abierta en él.
        const reached = topic.lessons.some((lesson) => lesson.status !== "locked");
        return <section key={topic.id} aria-label={routeTopicTitle(topic)}>
        {/* Queda fijo mientras se recorre el tema; el del tema siguiente toma su lugar al llegar. */}
        <Card glow={reached} className={clsx("sticky top-14 z-10 mx-auto flex w-fit max-w-full items-center gap-4 px-4 py-2.5 md:top-2", reached ? "portal:bg-primary-soft! portal:border-primary!" : "portal:text-fg-faint")}>
          <div className="min-w-0">
            <Eyebrow>{`Tema ${topic.position}`}</Eyebrow>
            <h2 className="type-heading truncate text-base sm:text-lg">{topic.name}</h2>
          </div>
          <div className="w-20 shrink-0 sm:w-28"><ProgressBar value={(topic.completed_lessons / topic.lessons.length) * 100} size="sm" label={`Lecciones completadas del tema ${topic.position}`} /></div>
          <span className="shrink-0 text-xs tabular-nums text-fg-muted">{topic.completed_lessons}/{topic.lessons.length}</span>
        </Card>
        <ol className="mx-auto mt-6 grid max-w-xl list-none gap-8 overflow-x-clip pb-4">{topic.lessons.map((lesson, index) => <LessonNode key={lesson.id} lesson={lesson} index={firstIndexByTopic[topicIndex]! + index} selected={lesson.id === currentId} />)}</ol>
      </section>;
      })}</div>}
  </>;
}
