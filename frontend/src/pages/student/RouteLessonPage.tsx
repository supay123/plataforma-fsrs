import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePortalFocus } from "../../components/layout/portal-mode";
import { Button, Card, Eyebrow, PageHeader } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/use-toast";
import { PaginatedText } from "../../features/route-mode/PaginatedText";
import {
  getRouteLessonContent, routeLessonContentKey, routeProgressKey, submitRouteAttempt,
  type RouteAttemptResult, type RouteOption, type RouteQuestion,
} from "../../features/route-mode/api";
import { PracticeQuestion } from "../../features/sessions/PracticeQuestion";
import { decryptAnswerKey } from "../../features/sessions/answer-key";
import type { AnswerFeedback, AnswerKeyEntry } from "../../types/contracts";

const OPTIONS: RouteOption[] = ["A", "B", "C", "D"];
const optionText = (question: RouteQuestion, option: RouteOption) => question[`option_${option.toLowerCase()}` as "option_a"];
const ROUTE_HOME = "/estudiante/ruta";

/** Aciertos seguidos que terminan en la última pregunta respondida (cuenta hasta `upTo` preguntas). */
function currentStreak(questions: RouteQuestion[], answers: Record<string, RouteOption>, answerKey: Record<string, AnswerKeyEntry>, upTo: number): number {
  let streak = 0;
  for (let index = upTo - 1; index >= 0; index--) {
    const questionId = questions[index]!.id;
    if (answers[questionId] !== answerKey[questionId]?.correct_option) break;
    streak++;
  }
  return streak;
}

function LessonSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando">
    <Skeleton height={36} width="18rem" />
    <Skeleton className="mt-8" height={260} rounded="2xl" />
    <Skeleton className="mt-6" height={44} width="10rem" />
  </div>;
}

function ResultView({ result, nextLessonId, onRetry }: { result: RouteAttemptResult; nextLessonId: string | null; onRetry: () => void }) {
  const need = result.xp.thresholds[result.xp.thresholds.length - 1]!;
  return <div className="grid gap-6">
    <Card glow className="text-center sm:p-8">
      <Eyebrow className="justify-center">{result.passed ? "Lección aprobada" : "Todavía no"}</Eyebrow>
      <p className="type-display mt-4 text-5xl tabular-nums" aria-label={`${result.score_percent}% de acierto`}>{result.score_percent}%</p>
      <p className="mt-2 text-fg-muted">{result.correct_count} de {result.total_questions} correctas</p>
      <p className={clsx("type-heading mt-4 text-lg", result.passed ? "text-success-text" : "text-warning-text")}>
        {result.passed ? "¡Bien! Ya puedes seguir con la próxima lección." : `Necesitas al menos ${result.pass_percent}% para avanzar. Repasa el texto y vuelve a intentarlo.`}
      </p>
      <p className="mt-6 type-display text-3xl tabular-nums text-primary-text">+{result.xp.xp_gained} xp</p>
      <p className="mt-1 text-sm text-fg-muted">{result.xp.xp_gained > 0 ? "Solo ganas xp la primera vez que aciertas cada pregunta." : "Ya habías ganado el xp de estas preguntas."}</p>
      <p className="mt-3 text-sm text-fg-muted">Nivel {result.xp.level} · {result.xp.xp} / {need} xp</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {result.passed && nextLessonId && <Link to={`${ROUTE_HOME}/lecciones/${nextLessonId}`}><Button>Siguiente lección</Button></Link>}
        <Button variant={result.passed ? "secondary" : "primary"} onClick={onRetry}>Repetir lección</Button>
        <Link to={ROUTE_HOME}><Button variant="secondary">Volver a la ruta</Button></Link>
      </div>
    </Card>
  </div>;
}

export function RouteLessonPage() {
  usePortalFocus();
  const { lessonId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const client = useQueryClient();
  // Cada apertura trae un sorteo nuevo de preguntas; no se refresca solo para no cambiarlas a mitad de lección.
  const content = useQuery({ queryKey: routeLessonContentKey(lessonId), queryFn: () => getRouteLessonContent(lessonId), enabled: Boolean(lessonId), retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const [step, setStep] = useState<"text" | "questions" | "result">("text");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, RouteOption>>({});
  const [selected, setSelected] = useState<RouteOption | null>(null);
  const [answerKey, setAnswerKey] = useState<Record<string, AnswerKeyEntry> | null>(null);
  const [result, setResult] = useState<RouteAttemptResult | null>(null);

  // Una lección bloqueada (o inexistente) responde 403/404: se avisa y se vuelve a la ruta.
  useEffect(() => {
    if (!content.error) return;
    toast.error(content.error.message);
    navigate(ROUTE_HOME, { replace: true });
  }, [content.error, toast, navigate]);

  useEffect(() => {
    const encryptedKey = content.data?.answer_key;
    if (!encryptedKey) return;
    let cancelled = false;
    decryptAnswerKey(encryptedKey).then((key) => { if (!cancelled) setAnswerKey(key); }, () => toast.error("No se pudieron cargar las preguntas."));
    return () => { cancelled = true; };
  }, [content.data, toast]);

  const submit = useMutation({
    mutationFn: () => submitRouteAttempt({ lesson_id: lessonId, answers: Object.entries(answers).map(([question_id, selected_option]) => ({ question_id, selected_option })) }),
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      void client.invalidateQueries({ queryKey: routeProgressKey });
    },
    onError: (error) => toast.error(error.message),
  });

  if (content.isLoading || !content.data || !answerKey) return <LessonSkeleton />;
  const { lesson, questions } = content.data;
  const question = questions[current];
  const retry = () => { setAnswerKey(null); void content.refetch(); setAnswers({}); setSelected(null); setCurrent(0); setResult(null); setStep("text"); };

  if (step === "result" && result) return <>
    <PageHeader title={lesson.title} />
    <ResultView result={result} nextLessonId={result.next_lesson_id} onRetry={retry} />
  </>;

  if (step === "text" || !question) return <>
    <PageHeader title={lesson.title} description={`Lee la lección con calma. Después responderás ${questions.length} ${questions.length === 1 ? "pregunta" : "preguntas"}.`} />
    <PaginatedText lastPageAction={<Button disabled={questions.length === 0} onClick={() => setStep("questions")}>Ir a las preguntas</Button>}>{lesson.content_text}</PaginatedText>
    <div className="mt-4"><Link to={ROUTE_HOME}><Button variant="ghost">Volver a la ruta</Button></Link></div>
  </>;

  const chosen = answers[question.id] ?? null;
  const entry = answerKey[question.id]!;
  const feedback: AnswerFeedback | null = chosen
    ? { is_correct: chosen === entry.correct_option, correct_option: entry.correct_option as RouteOption, explanation: entry.explanation }
    : null;
  const isLast = current === questions.length - 1;
  const options = OPTIONS.map((option) => [option, optionText(question, option)] as const);
  const next = () => {
    if (isLast) return submit.mutate();
    setCurrent(current + 1);
    setSelected(null);
  };
  return <PracticeQuestion
    onExit={() => navigate(ROUTE_HOME)}
    progressLabel="Avance de la lección"
    progressValue={(Object.keys(answers).length / questions.length) * 100}
    streak={currentStreak(questions, answers, answerKey, chosen ? current + 1 : current)}
    eyebrow={`Pregunta ${current + 1} de ${questions.length}`}
    statement={question.statement}
    options={options}
    selected={selected}
    chosen={chosen}
    feedback={feedback}
    optionsDisabled={submit.isPending}
    onSelect={setSelected}
    actions={feedback
      ? <Button className="h-12 w-full sm:h-auto sm:w-auto" variant={feedback.is_correct ? "primary" : "danger"} disabled={submit.isPending} onClick={next}>{isLast ? "Finalizar lección" : "Siguiente"}</Button>
      : <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={!selected} onClick={() => selected && setAnswers({ ...answers, [question.id]: selected })}>Confirmar respuesta</Button>}
  />;
}
