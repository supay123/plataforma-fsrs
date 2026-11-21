import { useQuery } from "@tanstack/react-query";
import { Check, Flame, Medal, Star, TrendingUp } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Card, Eyebrow, PageHeader, ProgressBar } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/use-toast";
import { daysLabel, levelProgress, streakTrack, xpMissingForNextLevel } from "../../features/achievements/achievements";
import { getLastGrades, getStreak } from "../../features/achievements/api";
import { GradeGauge } from "../../features/achievements/GradeGauge";
import { LevelBadge } from "../../features/achievements/LevelBadge";
import { listStudentCourses } from "../../features/courses/api";
import { getMedalSettings, getMyMedal } from "../../features/medals/api";
import { MedalBadge } from "../../features/medals/MedalBadge";
import { MedalGuideBody, StarsGuideBody } from "../../features/medals/MedalGuideBody";
import { medalLabel } from "../../features/medals/medals";
import { MedalRulesHelp } from "../../features/medals/MedalRulesHelp";
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

/** Esqueletos con la misma estructura y medidas que el contenido real, para que nada salte al cargar. Las formas redondas llevan `borderRadius` en línea porque `portal:rounded-xl` de `Skeleton` pisa a `rounded`. */
function EyebrowSkeleton({ width = 72 }: { width?: number }) {
  return <div className="flex h-[18px] items-center"><Skeleton height={12} width={width} /></div>;
}

function GradeSkeleton() {
  return <Card className="min-w-0 p-5 sm:p-6">
    <EyebrowSkeleton width={56} />
    <div className="mt-3">
      <Skeleton height={14} width={96} />
      <Skeleton className="mt-2 max-w-full" height={104} width={192} style={{ borderRadius: "96px 96px 8px 8px" }} />
      <Skeleton className="mt-2" height={14} width={160} />
      <div className="mt-4 grid gap-2 border-t border-line pt-3">
        <Skeleton height={18} width="80%" />
        <Skeleton height={18} width="70%" />
      </div>
    </div>
  </Card>;
}

function StreakSkeleton() {
  return <Card className="min-w-0 p-5 sm:p-6">
    <EyebrowSkeleton width={64} />
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-3"><Skeleton height={74} rounded="2xl" /><Skeleton height={74} rounded="2xl" /></div>
      <Skeleton className="mt-5" height={20} width={112} />
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, index) => <div key={index} className="grid justify-items-center gap-1.5">
          <Skeleton height={16} width={24} /><Skeleton height={44} width={44} style={{ borderRadius: "9999px" }} /><Skeleton height={16} width={20} />
        </div>)}
      </div>
      <Skeleton className="mt-4" height={20} width="55%" />
      <Skeleton className="mt-1" height={16} width="80%" />
    </div>
  </Card>;
}

function MedalSkeleton() {
  return <div className="flex flex-wrap items-center gap-6 sm:flex-nowrap">
    <div className="grid h-52 w-52 shrink-0 place-items-center"><Skeleton height={168} width={168} style={{ borderRadius: "9999px" }} /></div>
    <div className="min-w-0 flex-1">
      <EyebrowSkeleton width={80} />
      <Skeleton className="mt-2" height={36} width="70%" />
      <Skeleton className="mt-2" height={24} width="40%" />
      <Skeleton className="mt-5" height={12} rounded="full" />
      <Skeleton className="mt-2" height={18} width="75%" />
    </div>
  </div>;
}

function LevelSkeleton() {
  return <div className="rounded-2xl border-2 border-line bg-sunken/50 p-5">
    <EyebrowSkeleton width={56} />
    <div className="mt-3 flex items-center gap-4">
      <Skeleton className="shrink-0" height={132} width={132} rounded="3xl" />
      <div className="grid min-w-0 flex-1 gap-2"><Skeleton height={16} width="90%" /><Skeleton height={16} width="60%" /></div>
    </div>
  </div>;
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
  if (courses.isLoading || progress.isLoading || lastGrades.isLoading) return <GradeSkeleton />;
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
    <div className="mt-2"><GradeGauge grade={average === null ? null : percentageToGrade(average)}>
      <strong className="type-display block text-4xl leading-none tabular-nums" aria-label="Promedio general">
        {average === null ? "—" : <>{percentageToGrade(average)}<span className="type-body text-base text-fg-faint"> / 20</span></>}
      </strong>
    </GradeGauge></div>
    {average !== null && <p className="mt-2 text-xs text-fg-faint">{formatPercentage(average)}% de acierto total</p>}
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

const RAYS_BACKGROUND = {
  background: "repeating-conic-gradient(from 0deg, color-mix(in oklab, var(--c-secondary) 38%, transparent) 0 5deg, transparent 5deg 15deg)",
  maskImage: "radial-gradient(circle, #000 0%, transparent 68%)",
  WebkitMaskImage: "radial-gradient(circle, #000 0%, transparent 68%)",
};
const GLOW_BACKGROUND = { background: "radial-gradient(circle, color-mix(in oklab, var(--c-secondary) 30%, transparent) 0%, transparent 62%)" };

/** La medalla en grande, con rayos y brillo detrás, y el avance hacia la siguiente. No se muestra si el colegio desactivó las medallas. */
function MedalSection() {
  const medal = useQuery({ queryKey: ["my-medal"], queryFn: getMyMedal });
  const settings = useQuery({ queryKey: ["medal-settings", "own"], queryFn: () => getMedalSettings(), enabled: medal.data?.enabled === true });
  useErrorToast(medal.isError, medal.error);
  useErrorToast(settings.isError, settings.error);
  if (medal.isLoading) return <MedalSkeleton />;
  if (medal.isError) return <section aria-label="Medalla"><div className="flex items-center gap-2 text-secondary-text"><Medal aria-hidden size={18} /><Eyebrow>Medalla</Eyebrow></div><div className="mt-3">{unavailable}</div></section>;
  if (!medal.data?.enabled) return null;
  const { stars, medal: current, next_medal: next, stars_to_next: missing } = medal.data;
  const progress = next ? ((stars - current.min_stars) / Math.max(1, next.min_stars - current.min_stars)) * 100 : 100;
  return <section aria-label="Medalla" className="flex flex-wrap items-center gap-6 sm:flex-nowrap">
    <div className="relative grid h-52 w-52 shrink-0 place-items-center">
      <span aria-hidden className="absolute inset-0 rounded-full" style={GLOW_BACKGROUND} />
      <span aria-hidden className="absolute inset-0 rounded-full" style={RAYS_BACKGROUND} />
      <div className="relative motion-safe:animate-mascot-bob"><MedalBadge code={current.code} size={168} glow /></div>
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 text-secondary-text"><Medal aria-hidden size={18} /><Eyebrow>Medalla</Eyebrow></div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1">
        <p className="type-display text-3xl leading-tight">{medalLabel(current.name)}</p>
        <MedalRulesHelp title="¿Cómo funcionan las medallas?" body={<MedalGuideBody settings={settings.data} currentCode={current.code} />} />
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-fg-muted"><Star aria-hidden size={18} className="fill-secondary text-secondary" /><strong className="tabular-nums text-fg">{stars}</strong> {stars === 1 ? "estrella" : "estrellas"}<MedalRulesHelp body={<StarsGuideBody settings={settings.data} />} /></p>
      <div className="mt-5"><ProgressBar value={progress} label="Avance a la siguiente medalla" /></div>
      <p className="mt-2 text-sm text-fg-muted">
        {next && missing !== null ? <>Te {missing === 1 ? "falta" : "faltan"} <strong className="tabular-nums text-fg">{missing}</strong> {missing === 1 ? "estrella" : "estrellas"} para <strong className="text-fg">{medalLabel(next.name)}</strong>.</> : "Alcanzaste la medalla más alta."}
      </p>
    </div>
  </section>;
}

function LevelSection() {
  const level = useQuery({ queryKey: ["xp-rules"], queryFn: getXpRules });
  useErrorToast(level.isError, level.error);
  const panel = "rounded-2xl border-2 border-line bg-sunken/50 p-5";
  if (level.isLoading) return <LevelSkeleton />;
  if (level.isError || !level.data) return <section className={panel}><div className="flex items-center gap-2 text-secondary-text"><Star aria-hidden size={18} /><Eyebrow>Nivel</Eyebrow></div><div className="mt-3">{unavailable}</div></section>;
  const missing = xpMissingForNextLevel(level.data);
  return <section aria-label="Nivel" className={panel}>
    <div className="flex items-center gap-2 text-secondary-text"><Star aria-hidden size={18} /><Eyebrow>Nivel</Eyebrow></div>
    <div className="mt-3 flex items-center gap-4">
      <LevelBadge level={level.data.level} progress={levelProgress(level.data)} size={132} />
      <p className="min-w-0 text-sm text-fg-muted">
        <span className="tabular-nums">{level.data.xp} / {level.data.xp_to_next}</span> xp · te {missing === 1 ? "falta" : "faltan"} <strong className="tabular-nums text-fg">{missing}</strong> xp para el nivel {level.data.level + 1}.
      </p>
    </div>
  </section>;
}

/** Zona principal de la página: medalla y nivel juntos, en una sola tarjeta con luz propia. */
function PlayerHero() {
  return <Card glow className="relative min-w-0 overflow-hidden p-5 sm:p-8">
    <div className="grid items-center gap-8 @3xl:grid-cols-[3fr_2fr]">
      <MedalSection />
      <LevelSection />
    </div>
  </Card>;
}

function StreakTile({ value, label, hot }: { value: number; label: string; hot: boolean }) {
  return <div className="flex items-center gap-3 rounded-2xl border-2 border-line bg-sunken/50 p-3">
    <Flame aria-hidden size={30} strokeWidth={1.75} className={hot ? "fill-secondary text-secondary" : "text-fg-faint"} />
    <div className="min-w-0">
      <strong className="type-display block text-2xl leading-none tabular-nums" aria-label={`${label}: ${daysLabel(value)}`}>{daysLabel(value)}</strong>
      <span className="text-xs text-fg-muted">{label}</span>
    </div>
  </div>;
}

function StreakCard() {
  const streak = useQuery({ queryKey: ["streak"], queryFn: getStreak });
  useErrorToast(streak.isError, streak.error);
  if (streak.isLoading) return <StreakSkeleton />;
  if (streak.isError || !streak.data) return <AchievementCard icon={<Flame aria-hidden size={18} />} title="Racha">{unavailable}</AchievementCard>;
  const { current_streak: current, best_streak: best, active_today: activeToday, today } = streak.data;
  const track = streakTrack(today, current, activeToday);
  return <AchievementCard icon={<Flame aria-hidden size={18} />} title="Racha">
    <div className="grid grid-cols-2 gap-3">
      <StreakTile value={current} label="Racha actual" hot={current > 0} />
      <StreakTile value={best} label="Mejor racha" hot={best > 0} />
    </div>
    <p className="mt-5 font-semibold">Racha diaria</p>
    <ol aria-label="Racha diaria" className="mt-3 grid grid-cols-7 gap-1.5">
      {track.map((day) => <li key={day.date} className="grid justify-items-center gap-1.5">
        <span className={`text-xs ${day.isToday ? "font-bold text-fg" : "text-fg-muted"}`}>{day.label}</span>
        <span role="img" aria-label={`${day.date}: ${day.done ? "con sesión" : "pendiente"}`}
          className={`grid h-11 w-11 place-items-center rounded-full border-b-4 ${day.done ? "border-primary-strong bg-primary text-on-primary" : day.milestone ? "border-secondary/40 bg-secondary/20 text-secondary" : "border-line bg-sunken"} ${day.isToday ? "ring-2 ring-secondary ring-offset-2 ring-offset-blocks" : ""}`}>
          {day.done ? <Check aria-hidden size={20} strokeWidth={3} /> : day.milestone === 3 ? <Star aria-hidden size={20} className="fill-secondary" /> : day.milestone === 7 ? <Flame aria-hidden size={20} className="fill-secondary motion-safe:animate-flame" /> : null}
        </span>
        <span aria-hidden className="h-4 text-xs text-fg-faint">{day.milestone ? `${day.milestone}d` : ""}</span>
      </li>)}
    </ol>
    <p className="mt-4 text-sm text-fg-muted">
      {current === 0 ? "Completa una sesión hoy para empezar tu racha." : activeToday ? "Ya estuviste activo hoy." : "Completa una sesión hoy para no perder tu racha."}
    </p>
    <p className="mt-1 text-xs text-fg-faint">Un día cuenta cuando completas al menos una sesión (hora de Lima).</p>
  </AchievementCard>;
}

export function StudentAchievementsPage() {
  return <div className="grid grid-cols-1 gap-8">
    <PageHeader className="mb-0! portal:mb-0!" title="Mis logros" description="Tu nota, medalla, racha y nivel." />
    <PlayerHero />
    <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-[7fr_5fr]">
      <StreakCard />
      <GradeCard />
    </div>
  </div>;
}
