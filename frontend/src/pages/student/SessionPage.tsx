import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, PageHeader, Spinner } from "../../components/ui";
import { answerQuestion, completeSession, startSession, warmAnswerQuestion } from "../../features/sessions/api";
import { AppError } from "../../lib/api/errors";
import { MathText } from "../../lib/math";
import type { AnswerOption, SessionPayload, SessionQuestion } from "../../types/contracts";

function firstPendingIndex(questions: SessionQuestion[], after = -1): number {
  const next = questions.findIndex((item, itemIndex) => itemIndex > after && !item.selected_option);
  return next < 0 ? questions.length - 1 : next;
}

function optionClass(answerOption: AnswerOption, question: SessionQuestion, selected: AnswerOption | null): string {
  const { feedback, selected_option } = question;
  if (feedback) {
    if (answerOption === feedback.correct_option) return "flex border-emerald-500 bg-emerald-50";
    if (answerOption === selected_option) return "flex border-rose-500 bg-rose-50";
    // On mobile the feedback only keeps the student's answer and the correct one.
    return "hidden opacity-60 sm:flex";
  }
  return selected === answerOption ? "flex border-indigo-500 bg-indigo-50" : "flex hover:border-indigo-300";
}

export function SessionPage() {
  const { topicId = "" } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  // Alto real de la barra fija en móvil, para reservar justo ese espacio al final.
  const [barHeight, setBarHeight] = useState(0);
  const barRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const measure = () => setBarHeight(node.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const start = useMutation({
    mutationFn: () => startSession(topicId),
    onSuccess: (data) => {
      // Si falla, la primera respuesta solo tarda un poco más.
      warmAnswerQuestion().catch(() => undefined);
      setPayload(data);
      setStartedAt(Date.now());
      setIndex(firstPendingIndex(data.questions));
    },
  });
  const startMutation = start.mutate;
  useEffect(() => {
    startMutation();
  }, [topicId, startMutation]);

  const answer = useMutation({
    mutationFn: (body: { session_question_id: string; selected_option: AnswerOption; response_time_ms: number }) =>
      answerQuestion(body),
    onSuccess: (result, body) => {
      setSelected(null);
      setPayload((current) => current && {
        ...current,
        questions: current.questions.map((item) => item.session_question_id === body.session_question_id
          ? {
            ...item,
            selected_option: result.selected_option,
            answered_at: item.answered_at ?? new Date().toISOString(),
            feedback: result.feedback,
          }
          : item),
      });
    },
  });

  const complete = useMutation({
    mutationFn: () => completeSession(payload!.session.id, []),
    // La última respuesta se guarda después de mostrar su corrección; si aún no
    // termina, el servidor la ve pendiente y basta con volver a intentar.
    retry: (failureCount, error) => error instanceof AppError && error.code === "incomplete_submission" && failureCount < 4,
    retryDelay: 500,
    onSuccess: () => {
      navigate(`/estudiante/sesiones/${payload!.session.id}/revision`, { replace: true });
    },
  });

  const question = payload?.questions[index];
  const answeredCount = payload ? payload.questions.filter((item) => item.selected_option).length : 0;
  const allAnswered = Boolean(payload && answeredCount === payload.questions.length);
  const options = useMemo(
    () => question
      ? ([
        ["A", question.question.option_a],
        ["B", question.question.option_b],
        ["C", question.question.option_c],
        ["D", question.question.option_d],
      ] as const)
      : [],
    [question],
  );

  if (start.isPending) return <Spinner />;
  if (start.error) {
    return <Alert tone="error">{start.error.message}</Alert>;
  }
  if (!payload || !question) return <Spinner />;
  const activePayload = payload;
  const activeQuestion = question;
  const feedback = question.feedback;

  function confirm(): void {
    if (!selected) return;
    answer.mutate({
      session_question_id: activeQuestion.session_question_id,
      selected_option: selected,
      response_time_ms: Math.min(2_147_483_647, Math.max(0, Date.now() - startedAt)),
    });
  }

  function next(): void {
    answer.reset();
    setIndex(firstPendingIndex(activePayload.questions, index));
    setStartedAt(Date.now());
  }

  return <div className="max-sm:[&>header]:mb-4 max-sm:[&_h1]:text-xl">
    <PageHeader
      title={`Pregunta ${index + 1} de ${payload.questions.length}`}
      description={`${answeredCount} respondidas`}
    />
    {/* En móvil la pregunta va directo sobre el fondo, sin marco, para ganar espacio. */}
    <Card className="mx-auto max-w-3xl max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none sm:border sm:border-slate-200 sm:bg-white">
      <h2 className="text-lg font-semibold"><MathText>{question.question.statement}</MathText></h2>
      <div className="mt-4 grid gap-3 sm:mt-6">
        {options.map(([answerOption, text]) => <button
          key={answerOption}
          disabled={Boolean(feedback) || answer.isPending || complete.isPending}
          onClick={() => setSelected(answerOption)}
          className={`min-h-14 items-center gap-3 rounded-xl border p-3 text-left ${
            optionClass(answerOption, question, selected)
          }`}
        >
          <strong className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100">{answerOption}</strong>
          <span className="flex-1"><MathText>{text}</MathText></span>
          {feedback && answerOption === feedback.correct_option &&
            <span className="text-xs font-semibold text-emerald-700">Respuesta correcta</span>}
          {feedback && !feedback.is_correct && answerOption === question.selected_option &&
            <span className="text-xs font-semibold text-rose-700">Tu respuesta</span>}
        </button>)}
      </div>
      {feedback && <div className="mt-4 grid gap-3 sm:mt-6">
        <div className="hidden sm:block">
          <Alert tone={feedback.is_correct ? "success" : "error"}>
            {feedback.is_correct
              ? "¡Correcto!"
              : `Incorrecto. La respuesta correcta es la ${feedback.correct_option}.`}
          </Alert>
        </div>
        {feedback.explanation && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Explicación</h3>
          <div className="mt-2 text-slate-800"><MathText>{feedback.explanation}</MathText></div>
        </div>}
      </div>}
      {answer.error && <div className="mt-4"><Alert tone="error">
        {answer.error.message} Puedes reintentar; tu respuesta no se registrará dos veces.
      </Alert></div>}
      {complete.error && <div className="mt-4"><Alert tone="error">
        {complete.error.message} Tus respuestas siguen guardadas; puedes reintentar sin recargar.
      </Alert></div>}
      {/* En móvil la acción queda fija abajo (estilo Duolingo) y muestra el resultado. */}
      <div ref={barRef} className={`fixed inset-x-0 bottom-0 z-20 grid gap-3 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:static sm:mt-6 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 ${
        !feedback ? "border-slate-200 bg-white" : feedback.is_correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
      }`}>
        {feedback && <p className={`font-semibold sm:hidden ${feedback.is_correct ? "text-emerald-700" : "text-rose-700"}`}>
          {feedback.is_correct ? "¡Correcto!" : `Incorrecto. La respuesta correcta es la ${feedback.correct_option}.`}
        </p>}
        {!feedback
          ? <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={!selected || answer.isPending} onClick={confirm}>
            {answer.isPending ? "Corrigiendo…" : answer.error ? "Reintentar" : "Confirmar respuesta"}
          </Button>
          : allAnswered
            ? <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={complete.isPending} onClick={() => complete.mutate()}>
              {complete.isPending ? "Finalizando…" : complete.error ? "Reintentar finalización" : "Finalizar examen"}
            </Button>
            : <Button className="h-12 w-full sm:h-auto sm:w-auto" onClick={next}>Siguiente</Button>}
      </div>
    </Card>
    {/* Espacio para que la barra fija no tape el final del contenido en móvil. */}
    <div aria-hidden className="sm:hidden" style={{ height: barHeight }} />
  </div>;
}
