import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, EmptyState, Field, Select } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { getFreeModeCatalog } from "./api";

/** Forma de los tres selectores mientras carga el catálogo. */
function SelectorsSkeleton({ light }: { light: boolean }) {
  const skeletonClass = light ? undefined : "bg-white/10!";
  return <div role="status" aria-busy="true" aria-label="Cargando" className="grid gap-4">
    {[0, 1, 2].map((item) => <div key={item} className="grid gap-1.5"><Skeleton height={14} width="6rem" className={skeletonClass} /><Skeleton height={44} className={skeletonClass} /></div>)}
    <Skeleton height={44} className={skeletonClass} />
  </div>;
}

/** Formulario del modo gratuito: grupo, curso y tema en cascada. Al comenzar entrega el tema elegido. `light` lo adapta a fondos claros. */
export function FreeModeSelector({ onStart, light = false }: { onStart: (topicId: string) => void; light?: boolean }) {
  const [groupId, setGroupId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [topicId, setTopicId] = useState("");
  const catalog = useQuery({ queryKey: ["free-mode", "catalog"], queryFn: getFreeModeCatalog, staleTime: 5 * 60_000 });

  const groups = catalog.data ?? [];
  const group = groups.find((item) => item.id === groupId);
  const course = group?.courses.find((item) => item.id === courseId);

  // `dark` activa las variantes oscuras de los componentes compartidos (campos y botones).
  return <div className={clsx("rounded-2xl border p-5 text-left", light ? "border-emerald-100 bg-emerald-50/60" : "dark border-white/10 bg-slate-900")}>
    {catalog.isLoading ? <SelectorsSkeleton light={light} />
      : catalog.error ? <div className="grid gap-4"><Alert tone="error">{catalog.error.message}</Alert><Button onClick={() => void catalog.refetch()}>Reintentar</Button></div>
      : groups.length === 0 ? <EmptyState>Aún no hay pruebas disponibles. Vuelve pronto.</EmptyState>
      : <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); if (topicId) onStart(topicId); }}>
        <Field label="Grupo">
          <Select value={groupId} onChange={(event) => { setGroupId(event.target.value); setCourseId(""); setTopicId(""); }}>
            <option value="">Selecciona un grupo</option>
            {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </Field>
        <Field label="Curso">
          <Select value={courseId} disabled={!group} onChange={(event) => { setCourseId(event.target.value); setTopicId(""); }}>
            <option value="">Selecciona un curso</option>
            {group?.courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </Field>
        <Field label="Tema">
          <Select value={topicId} disabled={!course} onChange={(event) => setTopicId(event.target.value)}>
            <option value="">Selecciona un tema</option>
            {course?.topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </Field>
        <Button type="submit" className="min-h-11" disabled={!topicId}>Comenzar</Button>
      </form>}
  </div>;
}
