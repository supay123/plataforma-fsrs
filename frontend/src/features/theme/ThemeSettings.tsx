import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Card, Field } from "../../components/ui";
import { PageSkeleton } from "../../components/ui/skeleton";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { normalizeError } from "../../lib/api/errors";
import { useTheme } from "../../lib/theme/theme-context";
import { DEFAULT_PALETTES, PALETTE_KEYS, PALETTE_LABELS, paletteVars, type BasePalette, type PaletteKey, type ThemeMode } from "../../lib/theme/palette";
import { MascotAdvice } from "../mascot/MascotAdvice";
import { paletteAdvice } from "../mascot/palette-advice";
import { getCollegeThemes, parseHex, resetCollegeThemes, saveCollegeThemes } from "./api";

type Draft = Record<ThemeMode, BasePalette>;
const MODES: { mode: ThemeMode; label: string }[] = [{ mode: "light", label: "Tema claro" }, { mode: "dark", label: "Tema oscuro" }];

/** Un color: campo de texto (#rrggbb) y cuadro que abre el selector de color. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  // Lo que el usuario está escribiendo; si el color cambia por otro lado (selector, restablecer), manda el color.
  const [typed, setTyped] = useState<string | null>(null);
  const typedParsed = typed === null ? null : parseHex(typed);
  const text = typed !== null && (typedParsed === null || typedParsed === value) ? typed : value;
  const valid = parseHex(text) !== null;
  return <Field label={label} error={valid ? undefined : "Usa el formato #rrggbb."}>
    <span className="flex items-center gap-2">
      <input type="color" aria-label={`${label}: selector de color`} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border-2 border-line-strong bg-transparent p-1" />
      <input aria-label={`${label}: código del color`} spellCheck={false} maxLength={7} value={text} onChange={(event) => { setTyped(event.target.value); const parsed = parseHex(event.target.value); if (parsed) onChange(parsed); }}
        className="min-h-11 w-full rounded-xl border-2 border-line-strong bg-sunken px-3 py-2 font-mono text-on-blocks outline-none focus:border-primary" />
    </span>
  </Field>;
}

/** Vista previa con las variables del tema que se está editando (no afecta al resto de la página). */
function Preview({ palette }: { palette: BasePalette }) {
  return <div style={paletteVars(palette)} className="rounded-2xl border-2 border-line-strong bg-base p-4 text-on-base">
    <p className="type-heading text-lg">Vista previa</p>
    <div className="mt-3 grid gap-3 rounded-2xl border-2 border-line bg-blocks p-4 text-on-blocks shadow-[0_4px_0_var(--c-line)]">
      <p className="text-sm text-muted">Así se ve un bloque con texto y un botón.</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-[0_4px_0_var(--c-primary-strong)]">Primario</span>
        <span className="flex items-center gap-2 text-sm font-semibold text-secondary-text"><span aria-hidden className="h-2 w-2 rotate-45 bg-secondary" />Secundario</span>
      </div>
    </div>
  </div>;
}

function Editor({ collegeId, collegeCode, collegeName, saved }: { collegeId: string; collegeCode: string; collegeName: string; saved: Record<ThemeMode, BasePalette | null> }) {
  const client = useQueryClient();
  const modal = useModal();
  const toast = useToast();
  const { setInstId, reloadTheme } = useTheme();
  const [draft, setDraft] = useState<Draft>({ light: saved.light ?? DEFAULT_PALETTES.light, dark: saved.dark ?? DEFAULT_PALETTES.dark });
  const set = (mode: ThemeMode, key: PaletteKey, value: string) => setDraft((current) => ({ ...current, [mode]: { ...current[mode], [key]: value } }));
  const refresh = () => client.invalidateQueries({ queryKey: ["college-themes", collegeId] });
  // Tras guardar o restablecer se piden al endpoint público los colores de la institución elegida, para ver el resultado real.
  const applyInstitutionTheme = () => { setInstId(collegeCode); reloadTheme(); };
  const save = useMutation({
    mutationFn: () => saveCollegeThemes(collegeId, draft),
    onSuccess: () => { toast.success(`Colores de ${collegeName} guardados.`); applyInstitutionTheme(); void refresh(); },
    onError: async (error) => toast.error((await normalizeError(error)).message),
  });
  const reset = useMutation({
    mutationFn: () => resetCollegeThemes(collegeId),
    onSuccess: () => { setDraft({ light: DEFAULT_PALETTES.light, dark: DEFAULT_PALETTES.dark }); toast.success(`${collegeName} volvió a los colores por defecto.`); applyInstitutionTheme(); void refresh(); },
    onError: async (error) => toast.error((await normalizeError(error)).message),
  });
  const affects = <p>Este cambio afectará a <strong>toda la institución {collegeName}</strong>: todos sus administradores, profesores y estudiantes verán los nuevos colores.</p>;

  const advice = paletteAdvice(draft);
  return <>
    <MascotAdvice className="mb-6" event={advice.event} tone={advice.tone}>{advice.text}</MascotAdvice>
    <div className="grid gap-6 lg:grid-cols-2">
      {MODES.map(({ mode, label }) => <Card key={mode}>
        <h2 className="type-heading text-lg">{label}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {PALETTE_KEYS.map((key) => <ColorField key={key} label={PALETTE_LABELS[key]} value={draft[mode][key]} onChange={(value) => set(mode, key, value)} />)}
        </div>
        <div className="mt-5"><Preview palette={draft[mode]} /></div>
      </Card>)}
    </div>
    <div className="mt-6 flex flex-wrap gap-3">
      <Button disabled={save.isPending || reset.isPending} onClick={() => modal.warning({ title: "Guardar colores", body: affects, confirmLabel: "Guardar", onConfirm: () => save.mutateAsync() })}>Guardar colores</Button>
      <Button variant="secondary" disabled={save.isPending || reset.isPending} onClick={() => modal.warning({ title: "Restablecer colores", mascot: "wrong", body: <>{affects}<p className="mt-3">Se descartarán los colores personalizados y se usarán los de la plataforma.</p></>, confirmLabel: "Restablecer", onConfirm: () => reset.mutateAsync() })}><RotateCcw aria-hidden size={16} className="mr-2 inline" />Restablecer colores</Button>
    </div>
  </>;
}

/** Pestaña "Colores" del admin: los colores de la institución elegida, en modo claro y oscuro. */
export function ThemeSettings({ college }: { college: { id: string; code: string; name: string } }) {
  const themes = useQuery({ queryKey: ["college-themes", college.id], queryFn: () => getCollegeThemes(college.id) });
  if (themes.isLoading) return <PageSkeleton />;
  if (themes.error) return <Alert tone="error">{themes.error.message}</Alert>;
  // La clave reinicia el editor al cambiar de institución o al recargar los colores guardados.
  return <Editor key={`${college.id}-${themes.dataUpdatedAt}`} collegeId={college.id} collegeCode={college.code} collegeName={college.name} saved={themes.data ?? { light: null, dark: null }} />;
}
