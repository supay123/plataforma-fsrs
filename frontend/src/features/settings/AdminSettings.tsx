import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useState, type ReactNode } from "react";
import { Alert, Card, EmptyState, Field, PageHeader, Select } from "../../components/ui";
import { PageSkeleton } from "../../components/ui/skeleton";
import { listColleges } from "../colleges/api";
import { MedalSettings } from "../medals/MedalSettings";
import { ThemeSettings } from "../theme/ThemeSettings";
import { XpSettings } from "../xp/XpSettings";

const TABS = [["security", "Seguridad"], ["theme", "Colores"], ["xp", "Puntos"], ["medals", "Medallas"]] as const;
type TabId = (typeof TABS)[number][0];

/**
 * Configuración del admin. El selector de institución va sobre las pestañas y es la referencia
 * de las pestañas que guardan valores por institución (Colores, Puntos y Medallas); Seguridad es de la cuenta.
 */
export function AdminSettings({ security }: { security: ReactNode }) {
  const colleges = useQuery({ queryKey: ["colleges"], queryFn: listColleges });
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<TabId>("security");
  const college = colleges.data?.find((item) => item.id === selected) ?? colleges.data?.[0];

  const institutionTab = (content: (current: NonNullable<typeof college>) => ReactNode) =>
    colleges.isLoading ? <PageSkeleton />
      : colleges.error ? <Alert tone="error">{colleges.error.message}</Alert>
        : !college ? <Card><EmptyState mascot>Todavía no hay instituciones. Mientras tanto se usan los valores por defecto.</EmptyState></Card>
          : content(college);

  return <>
    <PageHeader title="Configuración" description="Seguridad de tu cuenta y ajustes de cada institución." />
    {college && <Card className="mb-6">
      <div className="max-w-md">
        <Field label="Institución" hint="Los cambios de Colores, Puntos y Medallas se guardan para esta institución; cada una puede tener los suyos.">
          <Select value={college.id} onChange={(event) => setSelected(event.target.value)}>{colleges.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        </Field>
      </div>
    </Card>}
    <div role="tablist" aria-label="Configuración" className="mb-6 flex gap-2 border-b-2 border-line">
      {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
        className={clsx("-mb-0.5 border-b-2 px-4 py-3 font-semibold transition", tab === id ? "border-primary text-primary-text" : "border-transparent text-fg-muted hover:text-fg")}>{label}</button>)}
    </div>
    {tab === "security" ? security
      : tab === "theme" ? institutionTab((current) => <ThemeSettings college={current} />)
        : tab === "xp" ? institutionTab((current) => <XpSettings college={current} />)
          : institutionTab((current) => <MedalSettings college={current} />)}
  </>;
}
