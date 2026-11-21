import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "../../components/layout/Logo";
import { Alert } from "../../components/ui";
import { useModal } from "../../components/ui/use-modal";
import { Skeleton } from "../../components/ui/skeleton";
import { useTheme } from "../../lib/theme/theme-context";
import { getFreeModeQuestions } from "../../features/free-mode/api";
import { FreeQuestionRunner } from "../../features/free-mode/FreeQuestionRunner";
import { LeadModal } from "../../features/free-mode/LeadModal";
import { PlanCards } from "../../features/payments/PlanCards";

type Stage = { name: "practice" } | { name: "plans"; correctCount: number; total: number; givenNames: string | null };

/** Forma de la pregunta mientras se traen las 10 preguntas del tema. */
function PracticeSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando" className="mx-auto grid max-w-2xl gap-5">
    <Skeleton height={12} rounded="full" className="bg-white/10!" />
    <Skeleton height={112} rounded="2xl" className="bg-white/10!" />
    {[0, 1, 2, 3].map((item) => <Skeleton key={item} height={56} rounded="xl" className="bg-white/10!" />)}
  </div>;
}

/** Prueba gratuita a pantalla completa y sin footer: 10 preguntas del tema elegido en el home (`?tema=`), al terminar ver los planes con el modal para dejar sus datos. */
export function FreeModePage() {
  const [searchParameters] = useSearchParams();
  const topicId = searchParameters.get("tema");
  const [stage, setStage] = useState<Stage>({ name: "practice" });
  const [leadOpen, setLeadOpen] = useState(false);
  const { mode } = useTheme();
  const modal = useModal();
  const navigate = useNavigate();

  const questionsQuery = useQuery({
    queryKey: ["free-mode", "questions", topicId],
    queryFn: () => getFreeModeQuestions(topicId ?? ""),
    enabled: Boolean(topicId),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (!topicId) return <Navigate to="/#gratis" replace />;

  // Mismo estilo y colores que el portal del estudiante, para que la práctica se vea igual en ambos.
  return <div className={clsx("portal flex min-h-svh flex-col bg-base text-on-base", mode === "dark" && "dark")}>
    {/* En celular, durante la prueba no hay cabecera: la X de la pregunta es la salida. */}
    <header className={clsx("mx-auto w-full max-w-6xl px-4 pt-6", stage.name === "practice" && "hidden md:block")}><Link to="/" className="inline-flex"><Logo /></Link></header>
    <main className={clsx("mx-auto w-full max-w-6xl flex-1 px-4 py-4 text-center md:py-10", stage.name === "practice" && "pb-28")}>
      {stage.name === "practice" && questionsQuery.isPending && <PracticeSkeleton />}
      {stage.name === "practice" && questionsQuery.error && <div className="mx-auto grid max-w-md gap-4">
        <Alert tone="error">{questionsQuery.error.message}</Alert>
        <Link to="/#gratis" className="font-semibold text-emerald-300 underline underline-offset-4">Volver a elegir tema</Link>
      </div>}
      {stage.name === "practice" && questionsQuery.data && <FreeQuestionRunner questions={questionsQuery.data.questions}
        onExit={() => modal.warning({ title: "¿Salir de la prueba?", body: "Perderás tus respuestas hasta este momento.", confirmLabel: "Salir y perder progreso", onConfirm: () => navigate("/#gratis") })}
        onFinish={(answers) => {
          const questions = questionsQuery.data.questions;
          setStage({ name: "plans", correctCount: questions.filter((question) => answers[question.id] === question.correct_option).length, total: questions.length, givenNames: null });
          setLeadOpen(true);
        }} />}

      {stage.name === "plans" && <>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Planes</p>
        <h1 className="mt-3 type-heading text-3xl sm:text-4xl">{stage.givenNames ? `¡Gracias, ${stage.givenNames}!` : `Acertaste ${stage.correctCount} de ${stage.total}`}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-300">Estos son nuestros planes. Sin renovación automática: vuelves a pagar solo si decides seguir.</p>
        <PlanCards className="mt-10 w-full" />
      </>}

      {leadOpen && <LeadModal onRegistered={(givenNames) => { setLeadOpen(false); setStage((current) => current.name === "plans" ? { ...current, givenNames } : current); }} />}
    </main>
  </div>;
}
