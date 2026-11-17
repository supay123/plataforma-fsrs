import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PublicPage } from "../../components/layout/PublicLayout";
import { Alert, Button, EmptyState, Field, Select } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/use-toast";
import { getFreeModeCatalog, getFreeModeQuestions, type FreeModeQuestion } from "../../features/free-mode/api";
import { FreeQuestionRunner, type FreeModeAnswers } from "../../features/free-mode/FreeQuestionRunner";
import { FreeResult } from "../../features/free-mode/FreeResult";
import { LeadModal } from "../../features/free-mode/LeadModal";
import { PlanCards } from "../../features/payments/PlanCards";

type Stage = { name: "select" } | { name: "practice"; questions: FreeModeQuestion[] } | { name: "result"; questions: FreeModeQuestion[]; answers: FreeModeAnswers } | { name: "plans"; givenNames: string };

/** Forma de los tres selectores mientras carga el catálogo. */
function SelectorsSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando" className="grid gap-4">
    {[0, 1, 2].map((item) => <div key={item} className="grid gap-1.5"><Skeleton height={14} width="6rem" className="bg-white/10!" /><Skeleton height={44} className="bg-white/10!" /></div>)}
    <Skeleton height={44} className="bg-white/10!" />
  </div>;
}

/** Forma de la pregunta mientras se traen las 10 preguntas del tema. */
function PracticeSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando" className="mx-auto grid max-w-2xl gap-5">
    <Skeleton height={12} rounded="full" className="bg-white/10!" />
    <Skeleton height={112} rounded="2xl" className="bg-white/10!" />
    {[0, 1, 2, 3].map((item) => <Skeleton key={item} height={56} rounded="xl" className="bg-white/10!" />)}
  </div>;
}

/** Prueba gratuita: elegir grupo, curso y tema, resolver 10 preguntas, identificarse y ver los planes. */
export function FreeModePage() {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>({ name: "select" });
  const [groupId, setGroupId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [leadOpen, setLeadOpen] = useState(false);

  const catalog = useQuery({ queryKey: ["free-mode", "catalog"], queryFn: getFreeModeCatalog, staleTime: 5 * 60_000 });
  const start = useMutation({
    mutationFn: () => getFreeModeQuestions(topicId),
    onSuccess: ({ questions }) => setStage({ name: "practice", questions }),
    onError: (error) => toast.error(error.message),
  });

  const groups = catalog.data ?? [];
  const group = groups.find((item) => item.id === groupId);
  const course = group?.courses.find((item) => item.id === courseId);

  return <PublicPage>
    {/* `dark` activa las variantes oscuras de los componentes compartidos (campos, modal, botones). */}
    <div className="dark mx-auto w-full max-w-6xl px-4 py-10 text-center">
      {stage.name === "select" && start.isPending && <PracticeSkeleton />}
      {stage.name === "select" && !start.isPending && <div className="mx-auto max-w-md">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Modo gratuito</p>
        <h1 className="mt-3 type-heading text-3xl sm:text-4xl">Prueba Chancón sin pagar</h1>
        <p className="mt-3 text-slate-300">Elige tu grupo, curso y tema y resuelve 10 preguntas con corrección al instante.</p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900 p-5 text-left">
          {catalog.isLoading ? <SelectorsSkeleton />
            : catalog.error ? <div className="grid gap-4"><Alert tone="error">{catalog.error.message}</Alert><Button onClick={() => void catalog.refetch()}>Reintentar</Button></div>
            : groups.length === 0 ? <EmptyState>Aún no hay pruebas disponibles. Vuelve pronto.</EmptyState>
            : <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); start.mutate(); }}>
              <Field label="Grupo (profesor)">
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
        </div>
      </div>}

      {stage.name === "practice" && <FreeQuestionRunner questions={stage.questions} onFinish={(answers) => setStage({ name: "result", questions: stage.questions, answers })} />}

      {stage.name === "result" && <>
        <h1 className="mb-6 type-heading text-3xl">Tu resultado</h1>
        <FreeResult questions={stage.questions} answers={stage.answers} onIdentify={() => setLeadOpen(true)} />
      </>}

      {stage.name === "plans" && <>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Planes</p>
        <h1 className="mt-3 type-heading text-3xl sm:text-4xl">{`¡Gracias, ${stage.givenNames}!`}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-300">Estos son nuestros planes. Sin renovación automática: vuelves a pagar solo si decides seguir.</p>
        <PlanCards className="mt-10 w-full" />
      </>}

      {leadOpen && <LeadModal onCancel={() => setLeadOpen(false)} onRegistered={(givenNames) => { setLeadOpen(false); setStage({ name: "plans", givenNames }); }} />}
    </div>
  </PublicPage>;
}
