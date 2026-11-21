import clsx from "clsx";
import { medalLabel } from "../../features/medals/medals";
import { RefreshCw, Trophy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert, Button, Card, EmptyState, Field, PageHeader, Select, Spinner } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { RANKING_LABELS, type RankingItem, type RankingType } from "../../features/ranking/api";
import { useRankingFeed } from "../../features/ranking/use-ranking-feed";
import { useRankingSettings } from "../../features/ranking/use-ranking-visible";
import { formatPercentage } from "../../features/progress/metrics";

const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`;

/** Valor principal y dato secundario de una fila según la categoría. */
function rowValue(type: RankingType, item: RankingItem): { main: string; detail: string } {
  if (type === "NIVEL") return { main: `Nivel ${item.level ?? 0}`, detail: `${item.xp ?? 0} XP` };
  if (type === "MEDALLAS") return { main: item.medal ? medalLabel(item.medal.name) : "—", detail: `${item.stars ?? 0} ★` };
  return { main: `${formatPercentage(item.grade ?? 0)}%`, detail: plural(item.completed_sessions ?? 0, "sesión", "sesiones") };
}

function RankingRow({ type, item }: { type: RankingType; item: RankingItem }) {
  const { main, detail } = rowValue(type, item);
  return <li className={clsx("grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border-2 px-4 py-3", item.is_me ? "border-primary bg-primary-soft" : "border-line bg-blocks text-on-blocks")}>
    <span className={clsx("type-display text-xl tabular-nums", item.position <= 3 ? "text-secondary-text" : "text-fg-muted")}>{item.position}</span>
    <span className="min-w-0 truncate font-semibold">{item.display_name}{item.is_me && <span className="ml-2 text-sm font-normal text-primary-text">(Tú)</span>}</span>
    <span className="text-right"><span className="block font-semibold">{main}</span><span className="block text-xs text-fg-muted">{detail}</span></span>
  </li>;
}

/** Misma tarjeta que el ranking cargado: el título ya se sabe, solo cambian el valor y los controles. */
function SummaryCard({ role, value, controls }: { role: "student" | "teacher"; value: ReactNode; controls: ReactNode }) {
  return <Card glow className="mb-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-fg-muted">{role === "student" ? "Tu posición" : "Tu grupo"}</p>
        {value}
      </div>
      <div className="flex flex-wrap items-end gap-3">{controls}</div>
    </div>
  </Card>;
}

/** Esqueletos con las medidas del contenido real (fila de 68 px, cifra de 61 px, selector de 70 px) para que nada salte al cargar. */
function ValueSkeleton() {
  return <div className="mt-1 flex h-[50px] items-center md:h-[61px]"><Skeleton height={48} width="10rem" /></div>;
}

function ControlsSkeleton() {
  return <><Skeleton height={70} width="11rem" /><Skeleton height={44} width="12rem" /></>;
}

function FeedSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando" className="grid gap-3">
    {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} height={68} rounded="2xl" />)}
  </div>;
}

function RankingBoard({ role, categories }: { role: "student" | "teacher"; categories: RankingType[] }) {
  const [selected, setSelected] = useState<RankingType | null>(null);
  const type = selected && categories.includes(selected) ? selected : categories.includes("MEDALLAS") ? "MEDALLAS" : categories[0]!;
  const { feed, loadMore, reload } = useRankingFeed(type);
  const ready = feed.status === "ready" ? feed : null;

  return <>
    <SummaryCard role={role}
      value={!ready ? <ValueSkeleton />
        : role === "teacher" ? <p className="mt-1"><strong className="type-display text-5xl leading-none tabular-nums md:text-6xl">{ready.totalParticipants}</strong>
          <span className="ml-2 text-fg-muted">{ready.totalParticipants === 1 ? "participante" : "participantes"}</span></p>
          : ready.myPosition === null
            ? <p className="mt-1 text-fg-muted">{type === "NOTA" ? "Completa una práctica para aparecer en el ranking de nota." : "Todavía no apareces en este ranking."}</p>
            : <p className="mt-1"><strong className="type-display text-5xl leading-none tabular-nums md:text-6xl"><span aria-hidden className="text-fg-faint">#</span>{ready.myPosition}</strong>
              <span className="ml-2 text-fg-muted">de {plural(ready.totalParticipants, "participante", "participantes")}</span></p>}
      controls={<>
        {categories.length > 1 && <div className="w-44"><Field label="Categoría">
          <Select value={type} onChange={(event) => setSelected(event.target.value as RankingType)}>{categories.map((category) => <option key={category} value={category}>{RANKING_LABELS[category]}</option>)}</Select>
        </Field></div>}
        <Button variant="secondary" disabled={feed.status === "loading"} onClick={() => void reload()}><RefreshCw aria-hidden size={16} className="mr-2 inline" />Actualizar ranking</Button>
      </>} />

    {feed.status === "loading" && <FeedSkeleton />}
    {feed.status === "error" && <div className="grid justify-items-start gap-3">
      <Alert tone="error">No se pudo cargar el ranking. {feed.message}</Alert>
      <Button onClick={() => void reload()}>Volver a intentar</Button>
    </div>}
    {ready && (ready.items.length === 0
      ? <EmptyState mascot>Todavía no hay participantes en este ranking.</EmptyState>
      : <>
        <ol aria-label={`Ranking por ${RANKING_LABELS[type].toLowerCase()}`} className="grid gap-3">{ready.items.map((item) => <RankingRow key={item.position} type={type} item={item} />)}</ol>
        {ready.loadingMore ? <Spinner />
          : ready.page < ready.totalPages && <div className="mt-6 flex justify-center"><Button variant="secondary" onClick={() => void loadMore()}>Ver más</Button></div>}
      </>)}
  </>;
}

/** Ranking del grupo (profesor) de la institución. El estudiante ve su posición; el profesor solo la lista. */
export function RankingPage({ role }: { role: "student" | "teacher" }) {
  const settings = useRankingSettings(true);
  return <>
    <PageHeader title="Ranking" description={role === "student" ? "Cómo vas frente a tus compañeros de grupo." : "Los mejores estudiantes de tu grupo."} />
    {settings.isLoading ? <><SummaryCard role={role} value={<ValueSkeleton />} controls={<ControlsSkeleton />} /><FeedSkeleton /></>
      : settings.error ? <Alert tone="error">{settings.error.message}</Alert>
        : !settings.data?.visible ? <EmptyState mascot><Trophy aria-hidden size={20} className="mr-2 inline" />El ranking no está activado en tu institución.</EmptyState>
          : <RankingBoard role={role} categories={settings.data.available_categories} />}
  </>;
}
