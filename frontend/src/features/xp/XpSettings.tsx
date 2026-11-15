import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Card, Field, Input } from "../../components/ui";
import { PageSkeleton } from "../../components/ui/skeleton";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { normalizeError } from "../../lib/api/errors";
import { DEFAULT_XP_SETTINGS, getCollegeXpSettings, saveCollegeXpSettings, type CollegeXpSettings } from "./api";
import { xpForLevel } from "./xp";

type Draft = Record<keyof CollegeXpSettings, string>;

interface FieldDefinition { key: keyof CollegeXpSettings; label: string; hint: string; min: number; max: number; step: number }

// Los rangos son los mismos que valida la BD (constraints de `college_xp_settings`).
const LEVEL_FIELDS: FieldDefinition[] = [
  { key: "base_xp", label: "XP base (B)", hint: "Lo que cuesta pasar del nivel 0 al 1.", min: 1, max: 100000, step: 1 },
  { key: "growth", label: "Incremento del XP por nivel (C)", hint: "Cuánto más cuesta cada nivel. 0 = todos cuestan lo mismo.", min: 0, max: 5, step: 0.05 },
];
const AWARD_FIELDS: FieldDefinition[] = [
  { key: "xp_per_correct", label: "Por pregunta acertada", hint: "XP por cada respuesta correcta.", min: 0, max: 10000, step: 1 },
  { key: "streak_3_bonus", label: "Bono por racha de 3", hint: "Se cobra una vez al llegar a 3 aciertos seguidos.", min: 0, max: 10000, step: 1 },
  { key: "streak_7_bonus", label: "Bono por racha de 7", hint: "Se cobra una vez al llegar a 7 aciertos seguidos.", min: 0, max: 10000, step: 1 },
  { key: "streak_20_bonus", label: "Bono por racha de 20", hint: "Se cobra una vez al llegar a 20 aciertos seguidos.", min: 0, max: 10000, step: 1 },
];

const toDraft = (settings: CollegeXpSettings): Draft => Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value)])) as Draft;

function fieldError(definition: FieldDefinition, text: string): string | undefined {
  const value = Number(text);
  if (text.trim() === "" || !Number.isFinite(value)) return "Escribe un número.";
  if (definition.step >= 1 && !Number.isInteger(value)) return "Usa un número entero.";
  if (value < definition.min || value > definition.max) return `Debe estar entre ${definition.min} y ${definition.max}.`;
  return undefined;
}

function Editor({ collegeId, collegeName, saved }: { collegeId: string; collegeName: string; saved: CollegeXpSettings }) {
  const client = useQueryClient();
  const modal = useModal();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(toDraft(saved));
  const definitions = [...LEVEL_FIELDS, ...AWARD_FIELDS];
  const hasErrors = definitions.some((definition) => fieldError(definition, draft[definition.key]));
  const parsed = Object.fromEntries(definitions.map((definition) => [definition.key, Number(draft[definition.key])])) as unknown as CollegeXpSettings;

  const save = useMutation({
    mutationFn: () => saveCollegeXpSettings(collegeId, parsed),
    onSuccess: () => { toast.success(`Reglas de XP de ${collegeName} guardadas.`); void client.invalidateQueries({ queryKey: ["college-xp-settings", collegeId] }); },
    onError: async (error) => toast.error((await normalizeError(error)).message),
  });

  const renderField = (definition: FieldDefinition) => <Field key={definition.key} label={definition.label} hint={definition.hint} error={fieldError(definition, draft[definition.key])}>
    <Input type="number" inputMode="decimal" min={definition.min} max={definition.max} step={definition.step} value={draft[definition.key]} onChange={(event) => setDraft((current) => ({ ...current, [definition.key]: event.target.value }))} />
  </Field>;
  const levelCosts = hasErrors ? [] : [1, 2, 3, 4, 5].map((nextLevel) => ({ nextLevel, cost: xpForLevel(nextLevel, parsed.base_xp, parsed.growth) }));

  return <>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="type-heading text-lg">Niveles</h2>
        <p className="mt-1 text-sm text-fg-muted">Pasar al nivel N cuesta <code>B + B × (N − 1)^(1 + C) × C</code>.</p>
        <div className="mt-4 grid gap-4">{LEVEL_FIELDS.map(renderField)}</div>
        <div className="mt-5 rounded-2xl border-2 border-line bg-sunken p-4">
          <p className="text-sm font-semibold">Costo de los primeros niveles</p>
          {levelCosts.length ? <ul className="mt-2 grid gap-1 text-sm text-fg-muted">
            {levelCosts.map(({ nextLevel, cost }) => <li key={nextLevel}>Del nivel {nextLevel - 1} al {nextLevel}: <strong className="text-fg">{cost} XP</strong></li>)}
          </ul> : <p className="mt-2 text-sm text-fg-muted">Corrige los valores para ver el costo.</p>}
        </div>
      </Card>
      <Card>
        <h2 className="type-heading text-lg">XP que se otorga</h2>
        <p className="mt-1 text-sm text-fg-muted">Se calcula al cerrar cada sesión de práctica.</p>
        <div className="mt-4 grid gap-4">{AWARD_FIELDS.map(renderField)}</div>
      </Card>
    </div>
    <div className="mt-6 flex flex-wrap gap-3">
      <Button disabled={save.isPending || hasErrors} onClick={() => modal.warning({
        title: "Guardar reglas de XP",
        body: <p>Este cambio afectará a <strong>toda la institución {collegeName}</strong>: el XP de las próximas sesiones y el costo de los siguientes niveles de todos sus estudiantes. El nivel y el XP que ya llevan no se modifican.</p>,
        confirmLabel: "Guardar", onConfirm: () => save.mutateAsync(),
      })}>Guardar reglas</Button>
      <Button variant="secondary" disabled={save.isPending} onClick={() => setDraft(toDraft(DEFAULT_XP_SETTINGS))}><RotateCcw aria-hidden size={16} className="mr-2 inline" />Valores por defecto</Button>
    </div>
  </>;
}

/** Pestaña "Puntos" del admin: montos y fórmula de niveles de la institución elegida. */
export function XpSettings({ college }: { college: { id: string; name: string } }) {
  const settings = useQuery({ queryKey: ["college-xp-settings", college.id], queryFn: () => getCollegeXpSettings(college.id) });
  if (settings.isLoading) return <PageSkeleton rows={2} rowHeight={220} columns={2} />;
  if (settings.error) return <Alert tone="error">{settings.error.message}</Alert>;
  // La clave reinicia el formulario al cambiar de institución o al recargar lo guardado.
  return <Editor key={`${college.id}-${settings.dataUpdatedAt}`} collegeId={college.id} collegeName={college.name} saved={settings.data ?? DEFAULT_XP_SETTINGS} />;
}
