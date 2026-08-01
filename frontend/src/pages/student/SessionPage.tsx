import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, PageHeader, Spinner } from "../../components/ui";
import { useAuth } from "../../features/auth/AuthProvider";
import { completeSession, startSession } from "../../features/sessions/api";
import {
  clearSessionDraft,
  loadSessionDraft,
  saveSessionDraft,
  toSubmittedAnswers,
  type SessionDraftAnswers,
} from "../../features/sessions/draft";
import { MathText } from "../../lib/math";
import type { AnswerOption, SessionPayload } from "../../types/contracts";

export function SessionPage() {
  const { topicId = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [draft, setDraft] = useState<SessionDraftAnswers>({});
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  const start = useMutation({
    mutationFn: () => startSession(topicId),
    onSuccess: (data) => {
      const restored = profile
        ? loadSessionDraft(profile.id, data.session.id, data.questions.map((question) => question.session_question_id))
        : {};
      setPayload(data);
      setDraft(restored);
      setStartedAt(Date.now());
      const next = data.questions.findIndex(
        (question) => !question.selected_option && !restored[question.session_question_id],
      );
      setIndex(next < 0 ? data.questions.length - 1 : next);
    },
  });
  const startMutation = start.mutate;
  useEffect(() => {
    startMutation();
  }, [topicId, startMutation]);

  const complete = useMutation({
    mutationFn: (answers: SessionDraftAnswers) => completeSession(
      payload!.session.id,
      toSubmittedAnswers(answers),
    ),
    onSuccess: () => {
      if (profile && payload) clearSessionDraft(profile.id, payload.session.id);
      navigate(`/estudiante/sesiones/${payload!.session.id}/revision`, { replace: true });
    },
  });

  const question = payload?.questions[index];
  const confirmedCount = payload
    ? payload.questions.filter(
      (item) => Boolean(item.selected_option || draft[item.session_question_id]),
    ).length
    : 0;
  const allAnswered = Boolean(payload && confirmedCount === payload.questions.length);
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
  if (!payload || !question || !profile) return <Spinner />;
  const activePayload = payload;
  const activeProfile = profile;

  const confirmed = question.selected_option ?? draft[question.session_question_id]?.selected_option ?? null;

  function recordCurrent(): SessionDraftAnswers | null {
    if (!selected || !question) return null;
    const nextDraft = {
      ...draft,
      [question.session_question_id]: {
        selected_option: selected,
        response_time_ms: Math.min(2_147_483_647, Math.max(0, Date.now() - startedAt)),
      },
    };
    setDraft(nextDraft);
    saveSessionDraft(activeProfile.id, activePayload.session.id, nextDraft);
    return nextDraft;
  }

  function confirmAndAdvance(): void {
    const nextDraft = recordCurrent();
    if (!nextDraft) return;
    setSelected(null);
    const nextIndex = activePayload.questions.findIndex(
      (item, itemIndex) => itemIndex > index &&
        !item.selected_option &&
        !nextDraft[item.session_question_id],
    );
    setIndex(nextIndex < 0 ? activePayload.questions.length - 1 : nextIndex);
    setStartedAt(Date.now());
  }

  function finish(): void {
    const nextDraft = selected ? recordCurrent() : draft;
    if (!nextDraft) return;
    complete.mutate(nextDraft);
  }

  const isLastPendingQuestion = confirmedCount === payload.questions.length - 1 && !confirmed;

  return <>
    <PageHeader
      title={`Pregunta ${index + 1} de ${payload.questions.length}`}
      description={`${confirmedCount} respondidas`}
    />
    <Card className="mx-auto max-w-3xl">
      <h2 className="text-lg font-semibold"><MathText>{question.question.statement}</MathText></h2>
      <div className="mt-6 grid gap-3">
        {options.map(([answerOption, text]) => <button
          key={answerOption}
          disabled={Boolean(confirmed) || complete.isPending}
          onClick={() => setSelected(answerOption)}
          className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left ${
            selected === answerOption || confirmed === answerOption
              ? "border-indigo-500 bg-indigo-50"
              : "hover:border-indigo-300"
          }`}
        >
          <strong className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100">{answerOption}</strong>
          <span><MathText>{text}</MathText></span>
        </button>)}
      </div>
      {complete.error && <div className="mt-4"><Alert tone="error">
        {complete.error.message} Tus respuestas siguen guardadas; puedes reintentar sin recargar.
      </Alert></div>}
      <div className="mt-6 flex justify-end">
        {allAnswered
          ? <Button disabled={complete.isPending} onClick={finish}>
            {complete.isPending ? "Guardando respuestas…" : complete.error ? "Reintentar finalización" : "Finalizar examen"}
          </Button>
          : isLastPendingQuestion
            ? <Button disabled={!selected || complete.isPending} onClick={finish}>
              {complete.isPending ? "Guardando respuestas…" : "Finalizar examen"}
            </Button>
            : <Button disabled={!selected || Boolean(confirmed)} onClick={confirmAndAdvance}>
              Confirmar respuesta
            </Button>}
      </div>
    </Card>
  </>;
}
