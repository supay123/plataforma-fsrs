import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Card } from "../../components/ui";
import { PageSkeleton } from "../../components/ui/skeleton";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { normalizeError } from "../../lib/api/errors";
import { DEFAULT_RANKING_SETTINGS, getRankingSettings, RANKING_LABELS, RANKING_TYPES, saveRankingSettings, type RankingSettings as Settings, type RankingType } from "./api";

const CATEGORY_HINTS: Record<RankingType, string> = {
  NIVEL: "Ordena por nivel y, a igual nivel, por XP.",
  MEDALLAS: "Ordena por estrellas. Se oculta si la institución tiene las medallas desactivadas.",
  NOTA: "Ordena por el promedio de acierto de «Mi aprendizaje».",
};

function Editor({ collegeId, collegeName, saved }: { collegeId: string; collegeName: string; saved: Settings }) {
  const client = useQueryClient();
  const modal = useModal();
  const toast = useToast();
  const [enabled, setEnabled] = useState(saved.enabled);
  const [categories, setCategories] = useState<RankingType[]>(saved.categories);
  const noCategory = enabled && categories.length === 0;

  const save = useMutation({
    mutationFn: () => saveRankingSettings(collegeId, { enabled, categories: categories.length ? RANKING_TYPES.filter((type) => categories.includes(type)) : saved.categories }),
    onSuccess: () => { toast.success(`Ranking de ${collegeName} guardado.`); void client.invalidateQueries({ queryKey: ["ranking-settings"] }); },
    onError: async (error) => toast.error((await normalizeError(error)).message),
  });
  const toggleCategory = (type: RankingType) => setCategories((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));

  return <>
    <Card>
      <label className="flex items-start gap-3">
        <input type="checkbox" role="switch" className="mt-1 h-5 w-5 accent-primary" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span><span className="type-heading block text-lg">Activar ranking</span>
          <span className="text-sm text-fg-muted">Los estudiantes compiten solo con quienes tienen su mismo profesor (grupo) en la institución. Los profesores ven el ranking de su grupo, sin posición propia. Viene desactivado por defecto.</span></span>
      </label>
    </Card>
    {enabled && <Card className="mt-6">
      <h2 className="type-heading text-lg">Categorías que se muestran</h2>
      <p className="mt-1 text-sm text-fg-muted">Elige una, varias o todas.</p>
      <div className="mt-4 grid gap-4">
        {RANKING_TYPES.map((type) => <label key={type} className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={categories.includes(type)} onChange={() => toggleCategory(type)} />
          <span><span className="block font-semibold">{RANKING_LABELS[type]}</span><span className="text-sm text-fg-muted">{CATEGORY_HINTS[type]}</span></span>
        </label>)}
      </div>
    </Card>}
    {noCategory && <div className="mt-4"><Alert tone="error">Elige al menos una categoría para poder guardar.</Alert></div>}
    <div className="mt-6">
      <Button disabled={save.isPending || noCategory} onClick={() => modal.warning({
        title: "Guardar ranking",
        body: <p>Este cambio afectará a <strong>toda la institución {collegeName}</strong>: {enabled
          ? "sus estudiantes y profesores verán el ranking con las categorías elegidas."
          : "se dejará de mostrar el ranking a todos sus estudiantes y profesores."}</p>,
        confirmLabel: "Guardar", onConfirm: () => save.mutateAsync(),
      })}>Guardar ranking</Button>
    </div>
  </>;
}

/** Pestaña "Ranking" del admin: interruptor y categorías de la institución elegida. */
export function RankingSettings({ college }: { college: { id: string; name: string } }) {
  const settings = useQuery({ queryKey: ["ranking-settings", college.id], queryFn: () => getRankingSettings(college.id) });
  if (settings.isLoading) return <PageSkeleton rows={2} rowHeight={120} />;
  if (settings.error) return <Alert tone="error">{settings.error.message}</Alert>;
  // La clave reinicia el formulario al cambiar de institución o al recargar lo guardado.
  return <Editor key={`${college.id}-${settings.dataUpdatedAt}`} collegeId={college.id} collegeName={college.name} saved={settings.data ?? DEFAULT_RANKING_SETTINGS} />;
}
