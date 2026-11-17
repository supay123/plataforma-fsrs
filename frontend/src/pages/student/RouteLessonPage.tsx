import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Eyebrow, PageHeader, ProgressBar } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/use-toast";
import { LessonText } from "../../features/route-mode/LessonText";
import {
  getRouteLessonContent, routeLessonContentKey, routeProgressKey, submitRouteAttempt,
  type RouteAttemptResult, type RouteOption, type RouteQuestion,
} from "../../features/route-mode/api";
import { MathText } from "../../lib/math";

const OPTIONS: RouteOption[] = ["A", "B", "C", "D"];
const optionText = (question: RouteQuestion, option: RouteOption) => question[`option_${option.toLowerCase()}` as "option_a"];
const ROUTE_HOME = "/estudiante/ruta";

function LessonSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Cargando">
    <Skeleton height={36} width="18rem" />
    <Skeleton className="mt-8" height={260} rounded="2xl" />
    <Skeleton className="mt-6" height={44} width="10rem" />
  </div>;
}

function ResultView({ result, questions, nextLessonId, onRetry }: { result: RouteAttemptResult; questions: RouteQuestion[]; nextLessonId: string | null; onRetry: () => void }) {
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
    <section aria-label="Revisión" className="grid gap-3">
      {result.review.map((item, index) => {
        const question = questions.find((entry) => entry.id === item.question_id);
        if (!question) return null;
        return <Card key={item.question_id} className={clsx("p-4", item.is_correct ? "portal:border-success" : "portal:border-danger")}>
          <Eyebrow>{`Pregunta ${index + 1} · ${item.is_correct ? "Correcta" : "Incorrecta"}`}</Eyebrow>
          <h3 className="mt-2 font-semibold whitespace-pre-wrap"><MathText>{question.statement}</MathText></h3>
          <p className="mt-2 text-sm text-fg-muted">Tu respuesta: <MathText>{`${item.selected_option}. ${optionText(question, item.selected_option)}`}</MathText></p>
          {!item.is_correct && <p className="text-sm text-success-text">Correcta: <MathText>{`${item.correct_option}. ${optionText(question, item.correct_option)}`}</MathText></p>}
          {item.explanation && <div className="mt-2 rounded-xl bg-sunken p-3 text-sm whitespace-pre-wrap"><MathText>{item.explanation}</MathText></div>}
        </Card>;
      })}
    </section>
  </div>;
}

export function RouteLessonPage() {
  const { lessonId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const client = useQueryClient();
  const content = useQuery({ queryKey: routeLessonContentKey(lessonId), queryFn: () => getRouteLessonContent(lessonId), enabled: Boolean(lessonId), retry: false });
  const [step, setStep] = useState<"text" | "questions" | "result">("text");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, RouteOption>>({});
  const [result, setResult] = useState<RouteAttemptResult | null>(null);

  // Una lección bloqueada (o inexistente) responde 403/404: se avisa y se vuelve a la ruta.
  useEffect(() => {
    if (!content.error) return;
    toast.error(content.error.message);
    navigate(ROUTE_HOME, { replace: true });
  }, [content.error, toast, navigate]);

  const submit = useMutation({
    mutationFn: () => submitRouteAttempt({ lesson_id: lessonId, answers: Object.entries(answers).map(([question_id, selected_option]) => ({ question_id, selected_option })) }),
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      void client.invalidateQueries({ queryKey: routeProgressKey });
    },
    onError: (error) => toast.error(error.message),
  });

  if (content.isLoading || !content.data) return <LessonSkeleton />;
  const { lesson, questions } = content.data;
  const question = questions[current];
  const retry = () => { setAnswers({}); setCurrent(0); setResult(null); setStep("text"); };

  if (step === "result" && result) return <>
    <PageHeader title={lesson.title} />
    <ResultView result={result} questions={questions} nextLessonId={result.next_lesson_id} onRetry={retry} />
  </>;

  if (step === "text" || !question) return <>
    <PageHeader title={lesson.title} description="Lee la lección con calma. Después responderás 5 preguntas." />
    <Card className="p-5 sm:p-8"><LessonText className="text-lg leading-relaxed">{lesson.content_text}</LessonText></Card>
    <div className="mt-6 flex flex-wrap gap-3">
      <Button disabled={questions.length === 0} onClick={() => setStep("questions")}>Ir a las preguntas</Button>
      <Link to={ROUTE_HOME}><Button variant="secondary">Volver a la ruta</Button></Link>
    </div>
  </>;

  const selected = answers[question.id];
  const isLast = current === questions.length - 1;
  return <div className="mx-auto grid max-w-2xl gap-5">
    <div className="flex items-center gap-4">
      <div className="flex-1"><ProgressBar value={((current + (selected ? 1 : 0)) / questions.length) * 100} label="Avance de la lección" /></div>
      <span className="text-sm tabular-nums text-fg-muted">{current + 1} / {questions.length}</span>
    </div>
    <Card className="p-4 sm:p-6">
      <Eyebrow>{`Pregunta ${current + 1} de ${questions.length}`}</Eyebrow>
      <h2 className="mt-2 text-xl font-semibold whitespace-pre-wrap sm:text-2xl"><MathText>{question.statement}</MathText></h2>
    </Card>
    <div className="grid gap-3" role="radiogroup" aria-label="Opciones">
      {OPTIONS.map((option) => <button key={option} type="button" role="radio" aria-checked={selected === option} onClick={() => setAnswers((previous) => ({ ...previous, [question.id]: option }))}
        className={clsx("flex min-h-14 items-center gap-4 rounded-xl border-2 px-4 py-3 text-left shadow-[0_4px_0_var(--edge)] transition duration-100 active:translate-y-1 active:shadow-none",
          selected === option ? "border-fg bg-sunken [--edge:var(--c-fg)]" : "border-line-strong bg-blocks [--edge:var(--c-line-strong)] hover:bg-sunken")}>
        <strong className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 text-sm", selected === option ? "border-fg text-fg" : "border-line-strong text-fg-muted")}>{option}</strong>
        <span className="min-w-0 flex-1 text-lg"><MathText>{optionText(question, option)}</MathText></span>
      </button>)}
    </div>
    <div className="flex flex-wrap justify-between gap-3">
      <Button variant="secondary" disabled={submit.isPending} onClick={() => current === 0 ? setStep("text") : setCurrent(current - 1)}>{current === 0 ? "Releer lección" : "Anterior"}</Button>
      {isLast
        ? <Button disabled={Object.keys(answers).length < questions.length || submit.isPending} onClick={() => submit.mutate()}>Enviar respuestas</Button>
        : <Button disabled={!selected} onClick={() => setCurrent(current + 1)}>Siguiente</Button>}
    </div>
  </div>;
}
