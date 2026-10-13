import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, PageHeader, Spinner } from "../../components/ui";
import { answerQuestion, completeSession, startSession } from "../../features/sessions/api";
import { MathText } from "../../lib/math";
import type { AnswerOption, SessionPayload, SessionQuestion } from "../../types/contracts";

function firstPendingIndex(questions: SessionQuestion[], after = -1): number {
  const next = questions.findIndex((item, itemIndex) => itemIndex > after && !item.selected_option);
  return next < 0 ? questions.length - 1 : next;
}

function optionClass(answerOption: AnswerOption, question: SessionQuestion, selected: AnswerOption | null): string {
  const { feedback, selected_option } = question;
  if (feedback) {
    if (answerOption === feedback.correct_option) return "border-emerald-500 bg-emerald-50";
    if (answerOption === selected_option) return "border-rose-500 bg-rose-50";
    return "opacity-60";
  }
  return selected === answerOption ? "border-indigo-500 bg-indigo-50" : "hover:border-indigo-300";
}

export function SessionPage() {
  const { topicId = "" } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  const start = useMutation({
    mutationFn: () => startSession(topicId),
    onSuccess: (data) => {
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

  return <>
    <PageHeader
      title={`Pregunta ${index + 1} de ${payload.questions.length}`}
      description={`${answeredCount} respondidas`}
    />
    <Card className="mx-auto max-w-3xl">
      <h2 className="text-lg font-semibold"><MathText>{question.question.statement}</MathText></h2>
      <div className="mt-6 grid gap-3">
        {options.map(([answerOption, text]) => <button
          key={answerOption}
          disabled={Boolean(feedback) || answer.isPending || complete.isPending}
          onClick={() => setSelected(answerOption)}
          className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left ${
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
      {feedback && <div className="mt-6 grid gap-3">
        <Alert tone={feedback.is_correct ? "success" : "error"}>
          {feedback.is_correct
            ? "¡Correcto!"
            : `Incorrecto. La respuesta correcta es la ${feedback.correct_option}.`}
        </Alert>
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
      <div className="mt-6 flex justify-end">
        {!feedback
          ? <Button disabled={!selected || answer.isPending} onClick={confirm}>
            {answer.isPending ? "Corrigiendo…" : answer.error ? "Reintentar" : "Confirmar respuesta"}
          </Button>
          : allAnswered
            ? <Button disabled={complete.isPending} onClick={() => complete.mutate()}>
              {complete.isPending ? "Finalizando…" : complete.error ? "Reintentar finalización" : "Finalizar examen"}
            </Button>
            : <Button onClick={next}>Siguiente</Button>}
      </div>
    </Card>
  </>;
}
