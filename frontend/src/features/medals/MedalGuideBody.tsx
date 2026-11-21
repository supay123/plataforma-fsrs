import type { MedalCode, MedalSettings } from "./api";
import { MedalBadge } from "./MedalBadge";
import { medalFamily, medalLabel } from "./medals";
import { MedalRulesBody } from "./MedalRulesHelp";

type MedalRanges = Pick<MedalSettings, "medals">;
type GradeRanges = Pick<MedalSettings, "grade_ranges">;

/** Contenido del modal "¿Cómo se ganan las estrellas?": regla por tema y estrellas según la nota. */
export function StarsGuideBody({ settings }: { settings: GradeRanges | undefined }) {
  return <div className="grid gap-4">
    <p>Cada sesión te da o te quita estrellas según tu nota (de 0 a 20).</p>
    <MedalRulesBody />
    {settings && <div>
      <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100 portal:text-fg">Estrellas por nota</p>
      <ul className="grid gap-0.5">{settings.grade_ranges.map((range) => <li key={range.stars} className="flex justify-between gap-2"><span>Nota {range.min_grade} a {range.max_grade}</span><span className="tabular-nums portal:text-fg">{range.stars > 0 ? `+${range.stars}` : range.stars} ★</span></li>)}</ul>
    </div>}
  </div>;
}

/** Contenido del modal "¿Cómo funcionan las medallas?": cuántas estrellas pide cada medalla. */
export function MedalGuideBody({ settings, currentCode }: { settings: MedalRanges | undefined; currentCode: MedalCode }) {
  return <div className="grid gap-4">
    <p>Tu medalla depende del total de estrellas que acumulas.</p>
    {settings && <ol aria-label="Rango de cada medalla" className="grid gap-1.5">{settings.medals.map((range, position) => {
      const currentPosition = settings.medals.findIndex((candidate) => candidate.code === currentCode);
      const startsFamily = position > 0 && medalFamily(range.code) !== medalFamily(settings.medals[position - 1]!.code);
      return <li key={range.code} className={`flex items-center gap-3 ${startsFamily ? "mt-1.5 border-t-2 border-dashed border-line-strong pt-3" : ""} ${range.code === currentCode ? "font-semibold text-primary-text" : ""}`}>
        <MedalBadge code={range.code} size={36} locked={position > currentPosition} glow={position <= currentPosition} />
        <span className="flex-1">{medalLabel(range.name)}</span>
        <span className="tabular-nums">{range.max_stars === null ? `${range.min_stars} o más` : `${range.min_stars} a ${range.max_stars}`} ★</span>
      </li>;
    })}</ol>}
  </div>;
}
