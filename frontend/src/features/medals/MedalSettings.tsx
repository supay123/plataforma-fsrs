import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert, Button, Card, Field, Input } from "../../components/ui";
import { PageSkeleton } from "../../components/ui/skeleton";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { normalizeError } from "../../lib/api/errors";
import { DEFAULT_MEDAL_RULES, getMedalSettings, saveMedalSettings, type MedalRules } from "./api";
import { gradeRangeEndsSchema, MEDAL_NAMES, MEDAL_RULE_SUMMARY, starRangeEndsSchema, STARS_BY_GRADE_SECTION, validateEnds } from "./medals";

const MEDAL_CODES = Object.keys(MEDAL_NAMES) as Array<keyof typeof MEDAL_NAMES>;
const toTexts = (ends: number[]) => ends.map(String);
const signed = (stars: number) => (stars > 0 ? `+${stars}` : String(stars));

/** Casilla "Hasta N" de un rango; el "Desde" sale del fin del anterior y no se edita. */
function RangeRow({ label, from, children }: { label: string; from: number; children: ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 @xl:grid-cols-[minmax(0,12rem)_6rem_minmax(0,1fr)]">
    <p className="truncate pt-2 font-semibold">{label}</p>
    <p className="hidden pt-2 text-sm text-fg-muted @xl:block">Desde <strong className="text-fg tabular-nums">{from}</strong></p>
    <div className="col-span-2 @xl:col-span-1">{children}</div>
  </div>;
}

function Editor({ collegeId, collegeName, saved }: { collegeId: string; collegeName: string; saved: MedalRules }) {
  const client = useQueryClient();
  const modal = useModal();
  const toast = useToast();
  const [enabled, setEnabled] = useState(saved.enabled);
  const [starTexts, setStarTexts] = useState(toTexts(saved.star_range_ends));
  const [gradeTexts, setGradeTexts] = useState(toTexts(saved.grade_range_ends));
  const stars = validateEnds(starTexts, starRangeEndsSchema);
  const grades = validateEnds(gradeTexts, gradeRangeEndsSchema);
  const hasErrors = enabled && (Object.keys(stars.errors).length > 0 || Object.keys(grades.errors).length > 0);

  const save = useMutation({
    mutationFn: () => saveMedalSettings(collegeId, enabled ? { enabled, star_range_ends: stars.values, grade_range_ends: grades.values } : { enabled }),
    onSuccess: () => { toast.success(`Medallas de ${collegeName} guardadas.`); void client.invalidateQueries({ queryKey: ["medal-settings"] }); },
    onError: async (error) => toast.error((await normalizeError(error)).message),
  });

  const updateAt = (setter: typeof setStarTexts, index: number, text: string) => setter((current) => current.map((item, position) => (position === index ? text : item)));
  const startOf = (values: number[], index: number) => (index === 0 ? 0 : (Number.isFinite(values[index - 1]) ? values[index - 1]! + 1 : 0));

  return <>
    <Card>
      <label className="flex items-start gap-3">
        <input type="checkbox" role="switch" className="mt-1 h-5 w-5 accent-primary" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span><span className="type-heading block text-lg">Activar medallas</span>
          <span className="text-sm text-fg-muted">Si están desactivadas, los estudiantes de la institución no ven ni acumulan medallas ni estrellas.</span></span>
      </label>
    </Card>
    {enabled && <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="type-heading text-lg">Estrellas de cada medalla</h2>
        <p className="mt-1 text-sm text-fg-muted">Indica hasta cuántas estrellas llega cada medalla. Siempre en orden creciente, sin negativos ni decimales; Postulante 1 empieza en 0.</p>
        <div className="mt-4 grid gap-4">
          {MEDAL_CODES.map((code, index) => index < starTexts.length
            ? <RangeRow key={code} label={MEDAL_NAMES[code]} from={startOf(stars.values, index)}>
              <Field label={`${MEDAL_NAMES[code]}: hasta (estrellas)`} hideLabel error={stars.errors[index]}>
                <Input type="number" inputMode="numeric" min={0} step={1} value={starTexts[index]} onChange={(event) => updateAt(setStarTexts, index, event.target.value)} />
              </Field>
            </RangeRow>
            : <RangeRow key={code} label={MEDAL_NAMES[code]} from={startOf(stars.values, index)}>
              <p className="pt-2 text-sm text-fg-muted">Desde {startOf(stars.values, index)} estrellas en adelante.</p>
            </RangeRow>)}
        </div>
      </Card>
      <Card>
        <h2 className="type-heading text-lg">Notas que dan o quitan estrellas</h2>
        <p className="mt-1 text-sm text-fg-muted">Indica hasta qué nota llega cada sección (de 0 a 20, en orden creciente). Las notas con decimales caen en la sección de su parte entera.</p>
        <div className="mt-4 grid gap-4">
          {STARS_BY_GRADE_SECTION.map((sectionStars, index) => index < gradeTexts.length
            ? <RangeRow key={sectionStars} label={`${signed(sectionStars)} estrellas`} from={startOf(grades.values, index)}>
              <Field label={`${signed(sectionStars)} estrellas: hasta (nota)`} hideLabel error={grades.errors[index]}>
                <Input type="number" inputMode="numeric" min={0} max={19} step={1} value={gradeTexts[index]} onChange={(event) => updateAt(setGradeTexts, index, event.target.value)} />
              </Field>
            </RangeRow>
            : <RangeRow key={sectionStars} label={`${signed(sectionStars)} estrellas`} from={startOf(grades.values, index)}>
              <p className="pt-2 text-sm text-fg-muted">Hasta la nota 20.</p>
            </RangeRow>)}
        </div>
        <p className="mt-5 rounded-2xl border-2 border-line bg-sunken p-4 text-sm text-fg-muted">{MEDAL_RULE_SUMMARY}</p>
      </Card>
    </div>}
    {hasErrors && <div className="mt-4"><Alert tone="error">Corrige los rangos marcados para poder guardar.</Alert></div>}
    <div className="mt-6 flex flex-wrap gap-3">
      <Button disabled={save.isPending || hasErrors} onClick={() => modal.warning({
        title: "Guardar medallas",
        body: <p>Este cambio afecta a <strong>todos los estudiantes de la institución {collegeName}</strong>: {enabled
          ? "con los nuevos rangos de estrellas cambia la medalla que se les muestra, y con los de nota cambian las estrellas que ganan o pierden desde la próxima sesión."
          : "se dejarán de mostrar y calcular las medallas para todos ellos."} Las estrellas que ya tienen <strong>no se modifican</strong>.</p>,
        confirmLabel: "Guardar", onConfirm: () => save.mutateAsync(),
      })}>Guardar medallas</Button>
      <Button variant="secondary" disabled={save.isPending} onClick={() => { setStarTexts(toTexts(DEFAULT_MEDAL_RULES.star_range_ends)); setGradeTexts(toTexts(DEFAULT_MEDAL_RULES.grade_range_ends)); }}>
        <RotateCcw aria-hidden size={16} className="mr-2 inline" />Valores por defecto
      </Button>
    </div>
  </>;
}

/** Pestaña "Medallas" del admin: interruptor y rangos de la institución elegida. */
export function MedalSettings({ college }: { college: { id: string; name: string } }) {
  const settings = useQuery({ queryKey: ["medal-settings", college.id], queryFn: () => getMedalSettings(college.id) });
  if (settings.isLoading) return <PageSkeleton rows={2} rowHeight={220} columns={2} />;
  if (settings.error) return <Alert tone="error">{settings.error.message}</Alert>;
  // La clave reinicia el formulario al cambiar de institución o al recargar lo guardado.
  return <Editor key={`${college.id}-${settings.dataUpdatedAt}`} collegeId={college.id} collegeName={college.name} saved={settings.data ?? { ...DEFAULT_MEDAL_RULES }} />;
}
