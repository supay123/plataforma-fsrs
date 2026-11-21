import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePortalFocus, useLeaveWarning, type LeaveWarning } from "../../components/layout/portal-mode";
import { Alert, Button } from "../../components/ui";
import { useModal } from "../../components/ui/use-modal";
import { decryptAnswerKey } from "../../features/sessions/answer-key";
import { getXpRules, startPractice, submitPractice } from "../../features/sessions/api";
import { calculateMedal, type MedalAward } from "../../features/medals/api";
import { LoadingProgress } from "../../features/sessions/LoadingProgress";
import type { LoadStage } from "../../features/sessions/loading-progress";
import { MascotTips } from "../../features/sessions/MascotTips";
import { PracticeQuestion } from "../../features/sessions/PracticeQuestion";
import { useInactivity } from "../../features/sessions/use-inactivity";
import { answerXp, trailingStreak } from "../../features/xp/xp";
import { XpFloat } from "../../features/xp/XpFloat";
import { XpResult } from "../../features/xp/XpResult";
import type { AnswerFeedback, AnswerKeyEntry, AnswerOption, SessionAnswer, SessionPayload, SessionQuestion, XpAward, XpRules } from "../../types/contracts";

interface Practice { payload: SessionPayload; key: Record<string, AnswerKeyEntry>; xpRules: XpRules | null }
type LocalAnswer = Pick<SessionAnswer, "selected_option" | "response_time_ms">;

const LEAVE_WARNING: LeaveWarning = {
  title: "¿Salir de la práctica?",
  body: "Perderás todo tu progreso de esta práctica hasta este momento: tus respuestas no se guardan hasta que la finalices.",
  confirmLabel: "Salir y perder progreso",
};

/** Trae las preguntas y descifra su clave para corregir sin esperar al servidor. */
async function loadPractice(topicId: string, onStage: (stage: LoadStage) => void): Promise<Practice> {
  // Los montos de xp son un adorno: si fallan, la práctica sigue sin mostrarlos.
  const xpRules = getXpRules().catch(() => null);
  const { answer_key, ...payload } = await startPractice(topicId);
  onStage("preparing");
  const key = await decryptAnswerKey(answer_key);
  if (payload.questions.some((item) => !item.selected_option && !key[item.session_question_id])) {
    throw new Error("No se pudo preparar la corrección de la práctica. Vuelve a intentarlo.");
  }
  return { payload, key, xpRules: await xpRules };
}

function isAnswered(question: SessionQuestion, answers: Record<string, LocalAnswer>): boolean {
  return Boolean(question.selected_option || answers[question.session_question_id]);
}

function firstPendingIndex(questions: SessionQuestion[], answers: Record<string, LocalAnswer>, after = -1): number {
  const next = questions.findIndex((item, itemIndex) => itemIndex > after && !isAnswered(item, answers));
  return next < 0 ? questions.length - 1 : next;
}

/** ¿Acertó la pregunta? null si aún no la responde. */
function wasCorrect(question: SessionQuestion, answers: Record<string, LocalAnswer>, key: Record<string, AnswerKeyEntry>): boolean | null {
  if (question.feedback) return question.feedback.is_correct;
  const answer = answers[question.session_question_id];
  const entry = key[question.session_question_id];
  return answer && entry ? answer.selected_option === entry.correct_option : null;
}

/** Pantalla mientras se traen y descifran las preguntas (única carga que no usa skeleton). */
/** Tiempo que la barra se queda al 100 % antes de mostrar la primera pregunta (la barra anima ~0,5 s). */
const DONE_HOLD_MS = 800;
const INACTIVITY_BEFORE_SLEEP_MS = 60_000;

function PracticeLoading({ stage, stageSince, startedAt, done, onRetry }: { stage: LoadStage; stageSince: number; startedAt: number; done: boolean; onRetry: () => void }) {
  return <div className="mx-auto mt-4 grid max-w-md justify-items-center gap-4 text-center sm:mt-10">
    <div role="status" aria-live="polite">
      <p className="type-heading text-xl">Preparando tu práctica…</p>
      <p className="mt-1 text-sm text-fg-muted">Estamos cargando tus preguntas. En un momento empiezas y cada respuesta se corregirá al instante.</p>
    </div>
    <LoadingProgress stage={stage} stageSince={stageSince} startedAt={startedAt} done={done} onRetry={onRetry} />
    <MascotTips />
  </div>;
}

export function SessionPage() {
  const { topicId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const modal = useModal();
  const [practice, setPractice] = useState<Practice | null>(null);
  // La práctica ya está lista, pero la primera pregunta espera a que se vea la barra completa.
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [index, setIndex] = useState(0);
  const [award, setAward] = useState<{ sessionId: string; xp: XpAward; medal: MedalAward | null } | null>(null);
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const sleeping = useInactivity(INACTIVITY_BEFORE_SLEEP_MS, practice !== null && award === null);
  const [startedAt, setStartedAt] = useState(0);
  usePortalFocus();

  // Cada intento tiene un número: si se reintenta, la respuesta de uno anterior se ignora.
  const attempt = useRef(0);
  const [loading, setLoading] = useState({ stage: "downloading" as LoadStage, stageSince: 0, startedAt: 0 });
  const start = useMutation({
    mutationFn: (id: number) => {
      const now = Date.now();
      setLoading({ stage: "downloading", stageSince: now, startedAt: now });
      return loadPractice(topicId, (stage) => {
        if (attempt.current === id) setLoading((current) => ({ ...current, stage, stageSince: Date.now() }));
      });
    },
    onSuccess: (data, id) => {
      if (attempt.current !== id) return;
      setRevealed(false);
      setPractice(data);
      setAnswers({});
      setStartedAt(Date.now());
      setIndex(firstPendingIndex(data.payload.questions, {}));
    },
  });
  const startMutation = start.mutate;
  const begin = useCallback(() => {
    attempt.current += 1;
    startMutation(attempt.current);
  }, [startMutation]);
  useEffect(() => {
    begin();
  }, [topicId, begin]);

  const submit = useMutation({
    mutationFn: async (session: { id: string; answers: SessionAnswer[] }) => {
      const data = await submitPractice(session.id, session.answers);
      // Las medallas son un adorno del cierre: si fallan, se muestra el xp igual. Es idempotente en el servidor.
      const medal = data.xp ? await calculateMedal(session.id).catch(() => null) : null;
      return { ...data, medal };
    },
    onSuccess: (data, session) => {
      void queryClient.invalidateQueries({ queryKey: ["topic-stars"] });
      void queryClient.invalidateQueries({ queryKey: ["my-medal"] });
      if (data.xp) setAward({ sessionId: session.id, xp: data.xp, medal: data.medal });
      else navigate(`/estudiante/sesiones/${session.id}/revision`, { replace: true });
    },
  });

  useEffect(() => {
    if (!practice) return;
    const timer = window.setTimeout(() => setRevealed(true), DONE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [practice]);

  // Hasta que la práctica se guarda, salir desde el menú pide confirmación.
  useLeaveWarning(practice && !submit.isSuccess ? LEAVE_WARNING : null);

  const question = practice?.payload.questions[index];
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

  if (award) {
    return <XpResult award={award.xp} medal={award.medal} onContinue={() => navigate(`/estudiante/sesiones/${award.sessionId}/revision`, { replace: true })} />;
  }
  if (start.error) {
    return <div className="mx-auto mt-10 grid max-w-md gap-4">
      <Alert tone="error">{start.error.message}</Alert>
      <Button onClick={begin}>Reintentar</Button>
    </div>;
  }
  if (!practice || !question || !revealed) {
    return <PracticeLoading stage={loading.stage} stageSince={loading.stageSince} startedAt={loading.startedAt} done={Boolean(practice)} onRetry={begin} />;
  }

  const { payload, key } = practice;
  const activeQuestion = question;
  const localAnswer = answers[question.session_question_id];
  const chosen = question.selected_option ?? localAnswer?.selected_option ?? null;
  const entry = key[question.session_question_id];
  const feedback: AnswerFeedback | null = question.feedback ?? (localAnswer && entry
    ? { is_correct: localAnswer.selected_option === entry.correct_option, correct_option: entry.correct_option, explanation: entry.explanation }
    : null);
  // Xp de esta respuesta (solo vista previa): acierto más bono si completa una racha de 3, 7 o 20.
  const gain = feedback?.is_correct && practice.xpRules
    ? answerXp(trailingStreak(payload.questions.slice(0, index + 1).map((item) => wasCorrect(item, answers, key) === true)), practice.xpRules)
    : null;
  const answeredCount = payload.questions.filter((item) => isAnswered(item, answers)).length;
  const allAnswered = answeredCount === payload.questions.length;

  function confirm(): void {
    if (!selected) return;
    const answer = { selected_option: selected, response_time_ms: Math.min(2_147_483_647, Math.max(0, Date.now() - startedAt)) };
    setAnswers((current) => ({ ...current, [activeQuestion.session_question_id]: answer }));
    setSelected(null);
  }

  function next(): void {
    setIndex(firstPendingIndex(payload.questions, answers, index));
    setStartedAt(Date.now());
  }

  function finish(): void {
    submit.mutate({
      id: payload.session.id,
      answers: Object.entries(answers).map(([session_question_id, answer]) => ({ session_question_id, ...answer })),
    });
  }

  // Aciertos seguidos hasta la pregunta actual (cuenta la actual solo si ya se respondió).
  const streak = trailingStreak(payload.questions.slice(0, index + (feedback ? 1 : 0)).map((item) => wasCorrect(item, answers, key) === true));

  return <PracticeQuestion
    onExit={() => modal.warning({ ...LEAVE_WARNING, onConfirm: () => navigate("/estudiante") })}
    progressLabel="Avance de la práctica"
    progressValue={(answeredCount / payload.questions.length) * 100}
    streak={streak}
    mascotEvent={sleeping ? "sleep" : gain && gain.bonus > 0 ? "streak" : undefined}
    eyebrow={`Pregunta ${index + 1} de ${payload.questions.length}`}
    eyebrowNote={`${answeredCount} respondidas`}
    statement={question.question.statement}
    options={options}
    selected={selected}
    chosen={chosen}
    feedback={feedback}
    optionsDisabled={submit.isPending}
    onSelect={setSelected}
    optionsOverlay={gain && <XpFloat key={question.session_question_id} base={gain.base} bonus={gain.bonus} streak={gain.streak} />}
    notice={submit.error && <Alert tone="error">
      {submit.error.message} Tus respuestas siguen aquí; puedes reintentar sin recargar.
    </Alert>}
    actions={!feedback
      ? <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={!selected} onClick={confirm}>Confirmar respuesta</Button>
      : allAnswered
        ? <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={submit.isPending} onClick={finish}>
          {submit.isPending ? "Guardando respuestas…" : submit.error ? "Reintentar" : "Finalizar examen"}
        </Button>
        : <Button className="h-12 w-full sm:h-auto sm:w-auto" variant={feedback.is_correct ? "primary" : "danger"} onClick={next}>Siguiente</Button>}
  />;
}
