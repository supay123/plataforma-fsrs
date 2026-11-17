import { useQuery } from "@tanstack/react-query";
import { Flame, Medal, Star, TrendingUp } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Card, Eyebrow, PageHeader, ProgressBar } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/use-toast";
import { daysLabel, levelProgress, xpMissingForNextLevel } from "../../features/achievements/achievements";
import { getLastGrades, getStreak } from "../../features/achievements/api";
import { listStudentCourses } from "../../features/courses/api";
import { getMedalSettings, getMyMedal } from "../../features/medals/api";
import { MedalRulesBody } from "../../features/medals/MedalRulesHelp";
import { courseProgress } from "../../features/progress/api";
import { averageCourseScore, formatPercentage, percentageToGrade } from "../../features/progress/metrics";
import { getXpRules } from "../../features/sessions/api";
import { normalizeError } from "../../lib/api/errors";

/** Un error de carga se avisa con un toast; la tarjeta queda con un texto corto. */
function useErrorToast(failed: boolean, error: unknown) {
  const toast = useToast();
  useEffect(() => {
    if (!failed) return;
    void normalizeError(error).then((normalized) => toast.error(normalized.message));
  }, [failed, error, toast]);
}

function CardSkeleton({ height = 160 }: { height?: number }) {
  return <Skeleton height={height} rounded="2xl" />;
}

function AchievementCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <Card className="min-w-0 p-5 sm:p-6">
    <div className="flex items-center gap-2 text-secondary-text">{icon}<Eyebrow>{title}</Eyebrow></div>
    <div className="mt-3">{children}</div>
  </Card>;
}

const unavailable = <p className="text-sm text-fg-muted">No se pudo cargar. Vuelve a intentarlo más tarde.</p>;

/** Promedio general (el mismo de "Mi aprendizaje") en grande y la nota de la última sesión en pequeño. */
function GradeCard() {
  const courses = useQuery({ queryKey: ["student-courses"], queryFn: listStudentCourses });
  const progress = useQuery({ queryKey: ["course-progress"], queryFn: () => courseProgress() });
  const lastGrades = useQuery({ queryKey: ["last-grades"], queryFn: getLastGrades });
  useErrorToast(courses.isError || progress.isError, courses.error ?? progress.error);
  useErrorToast(lastGrades.isError, lastGrades.error);
  if (courses.isLoading || progress.isLoading || lastGrades.isLoading) return <CardSkeleton />;
  if (courses.isError || progress.isError) return <AchievementCard icon={<TrendingUp aria-hidden size={18} />} title="Nota">{unavailable}</AchievementCard>;
  const percentages = (courses.data ?? []).map((course) => {
    const value = progress.data?.find((row) => row.course_id === course.id)?.course_correct_percentage;
    return value === null || value === undefined ? null : Number(value);
  });
  const average = averageCourseScore(percentages);
  const lastSession = lastGrades.data?.last_session;
  const lastRouteLesson = lastGrades.data?.last_route_lesson;
  return <AchievementCard icon={<TrendingUp aria-hidden size={18} />} title="Nota">
    <p className="text-xs text-fg-muted">Promedio general</p>
    <strong className="type-display block text-5xl leading-none tabular-nums" aria-label="Promedio general">
      {average === null ? "—" : <>{percentageToGrade(average)}<span className="type-body text-base text-fg-faint"> / 20</span></>}
    </strong>
    {average !== null && <p className="mt-1 text-xs text-fg-faint">{formatPercentage(average)}% de acierto total</p>}
    <p className="mt-4 border-t border-line pt-3 text-sm text-fg-muted">
      {lastSession
        ? <>Última sesión{lastSession.topic_name ? ` (${lastSession.topic_name})` : ""}: <strong className="tabular-nums text-fg">{lastSession.grade}</strong> / 20</>
        : "Aún no completas ninguna sesión."}
    </p>
    {lastRouteLesson && <p className="mt-1 text-sm text-fg-muted">
      Última lección del modo ruta{lastRouteLesson.lesson_title ? ` (${lastRouteLesson.lesson_title})` : ""}: <strong className="tabular-nums text-fg">{lastRouteLesson.grade}</strong> / 20
    </p>}
  </AchievementCard>;
}

/** Medalla, estrellas y cómo funcionan los rangos. No se muestra si el colegio desactivó las medallas. */
function MedalCard() {
  const medal = useQuery({ queryKey: ["my-medal"], queryFn: getMyMedal });
  const settings = useQuery({ queryKey: ["medal-settings", "own"], queryFn: () => getMedalSettings(), enabled: medal.data?.enabled === true });
  useErrorToast(medal.isError, medal.error);
  useErrorToast(settings.isError, settings.error);
  if (medal.isLoading) return <CardSkeleton height={260} />;
  if (medal.isError) return <AchievementCard icon={<Medal aria-hidden size={18} />} title="Medalla">{unavailable}</AchievementCard>;
  if (!medal.data?.enabled) return null;
  const { stars, medal: current, next_medal: next, stars_to_next: missing } = medal.data;
  return <AchievementCard icon={<Medal aria-hidden size={18} />} title="Medalla">
    <p className="type-heading text-3xl">{current.name}</p>
    <p className="mt-1 inline-flex items-center gap-1.5 text-fg-muted"><Star aria-hidden size={16} className="fill-secondary text-secondary" /><strong className="tabular-nums text-fg">{stars}</strong> {stars === 1 ? "estrella" : "estrellas"}</p>
    <p className="mt-2 text-sm text-fg-muted">
      {next && missing !== null ? <>Te {missing === 1 ? "falta" : "faltan"} <strong className="tabular-nums text-fg">{missing}</strong> {missing === 1 ? "estrella" : "estrellas"} para <strong className="text-fg">{next.name}</strong>.</> : "Alcanzaste la medalla más alta."}
    </p>
    <details className="mt-4 border-t border-line pt-3 text-sm">
      <summary className="cursor-pointer font-semibold text-fg">¿Cómo funcionan las medallas?</summary>
      <div className="mt-3 grid gap-3 text-fg-muted">
        <p>Cada sesión te da o te quita estrellas según tu nota (de 0 a 20) y tu medalla depende del total de estrellas.</p>
        <MedalRulesBody />
        {settings.data && <>
          <div>
            <p className="mb-1 font-semibold text-fg">Estrellas por nota</p>
            <ul className="grid gap-0.5">{settings.data.grade_ranges.map((range) => <li key={range.stars} className="flex justify-between gap-2"><span>Nota {range.min_grade} a {range.max_grade}</span><span className="tabular-nums text-fg">{range.stars > 0 ? `+${range.stars}` : range.stars} ★</span></li>)}</ul>
          </div>
          <div>
            <p className="mb-1 font-semibold text-fg">Rango de cada medalla</p>
            <ul className="grid gap-0.5">{settings.data.medals.map((range) => <li key={range.code} className={`flex justify-between gap-2 ${range.code === current.code ? "font-semibold text-primary-text" : ""}`}><span>{range.name}</span><span className="tabular-nums">{range.max_stars === null ? `${range.min_stars} o más` : `${range.min_stars} a ${range.max_stars}`} ★</span></li>)}</ul>
          </div>
        </>}
      </div>
    </details>
  </AchievementCard>;
}

function StreakCard() {
  const streak = useQuery({ queryKey: ["streak"], queryFn: getStreak });
  useErrorToast(streak.isError, streak.error);
  if (streak.isLoading) return <CardSkeleton />;
  if (streak.isError || !streak.data) return <AchievementCard icon={<Flame aria-hidden size={18} />} title="Racha">{unavailable}</AchievementCard>;
  const { current_streak: current, best_streak: best, active_today: activeToday } = streak.data;
  return <AchievementCard icon={<Flame aria-hidden size={18} />} title="Racha">
    <strong className="type-display block text-5xl leading-none tabular-nums" aria-label={`Racha actual: ${daysLabel(current)}`}>{current}<span className="type-body text-base text-fg-faint"> {current === 1 ? "día seguido" : "días seguidos"}</span></strong>
    <p className="mt-2 text-sm text-fg-muted">
      {current === 0 ? "Completa una sesión hoy para empezar tu racha." : activeToday ? "Ya estuviste activo hoy." : "Completa una sesión hoy para no perder tu racha."}
    </p>
    <p className="mt-4 border-t border-line pt-3 text-sm text-fg-muted">Mejor racha: <strong className="tabular-nums text-fg">{daysLabel(best)}</strong></p>
    <p className="mt-1 text-xs text-fg-faint">Un día cuenta cuando completas al menos una sesión (hora de Lima).</p>
  </AchievementCard>;
}

function LevelCard() {
  const level = useQuery({ queryKey: ["xp-rules"], queryFn: getXpRules });
  useErrorToast(level.isError, level.error);
  if (level.isLoading) return <CardSkeleton />;
  if (level.isError || !level.data) return <AchievementCard icon={<Star aria-hidden size={18} />} title="Nivel">{unavailable}</AchievementCard>;
  const missing = xpMissingForNextLevel(level.data);
  return <AchievementCard icon={<Star aria-hidden size={18} />} title="Nivel">
    <strong className="type-display block text-5xl leading-none tabular-nums" aria-label={`Nivel ${level.data.level}`}>{level.data.level}</strong>
    <div className="mt-4"><ProgressBar value={levelProgress(level.data) * 100} label="Avance al siguiente nivel" /></div>
    <p className="mt-2 text-sm text-fg-muted">
      <span className="tabular-nums">{level.data.xp} / {level.data.xp_to_next}</span> xp · te {missing === 1 ? "falta" : "faltan"} <strong className="tabular-nums text-fg">{missing}</strong> xp para el nivel {level.data.level + 1}.
    </p>
  </AchievementCard>;
}

export function StudentAchievementsPage() {
  return <div className="grid grid-cols-1 gap-8">
    <PageHeader className="mb-0! portal:mb-0!" title="Mis logros" description="Tu nota, medalla, racha y nivel." />
    <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
      <GradeCard />
      <MedalCard />
      <StreakCard />
      <LevelCard />
    </div>
  </div>;
}
