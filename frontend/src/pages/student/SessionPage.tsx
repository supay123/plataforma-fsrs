import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePortalFocus, useLeaveWarning, type LeaveWarning } from "../../components/layout/portal-mode";
import { Alert, Button, Card, Eyebrow, PageHeader } from "../../components/ui";
import { decryptAnswerKey } from "../../features/sessions/answer-key";
import { getXpRules, startPractice, submitPractice } from "../../features/sessions/api";
import { LoadingProgress } from "../../features/sessions/LoadingProgress";
import type { LoadStage } from "../../features/sessions/loading-progress";
import { MascotTips } from "../../features/sessions/MascotTips";
import { answerXp, trailingStreak } from "../../features/xp/xp";
import { XpFloat } from "../../features/xp/XpFloat";
import { XpResult } from "../../features/xp/XpResult";
import { MathText } from "../../lib/math";
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

function letterClass(answerOption: AnswerOption, feedback: AnswerFeedback | null, chosen: AnswerOption | null, selected: AnswerOption | null): string {
  if (feedback) {
    if (answerOption === feedback.correct_option) return "border-success text-success-light";
    if (answerOption === chosen) return "border-danger text-danger-light";
  // Selección neutra (sin color): el verde queda solo para "correcto" y el rojo para "incorrecto".
  } else if (selected === answerOption) return "border-fg-muted text-fg-strong";
  return "border-line-strong text-fg";
}

function optionClass(answerOption: AnswerOption, feedback: AnswerFeedback | null, chosen: AnswerOption | null, selected: AnswerOption | null): string {
  if (feedback) {
    if (answerOption === feedback.correct_option) return "flex border-success bg-success/10";
    if (answerOption === chosen) return "flex border-danger bg-danger/10";
    // On mobile the feedback only keeps the student's answer and the correct one.
    return "hidden opacity-40 sm:flex";
  }
  return selected === answerOption ? "flex border-fg-muted bg-white/[0.04]" : "flex hover:border-line-strong hover:bg-white/[0.02]";
}

/** Pantalla mientras se traen y descifran las preguntas (única carga que no usa skeleton). */
/** Tiempo que la barra se queda al 100 % antes de mostrar la primera pregunta (la barra anima ~0,5 s). */
const DONE_HOLD_MS = 800;

function PracticeLoading({ stage, stageSince, startedAt, done, onRetry }: { stage: LoadStage; stageSince: number; startedAt: number; done: boolean; onRetry: () => void }) {
  return <div className="mx-auto mt-4 grid max-w-md justify-items-center gap-4 text-center sm:mt-10">
    <div role="status" aria-live="polite">
      <p className="font-display text-xl tracking-wide text-primary-pale">Preparando tu práctica…</p>
      <p className="mt-1 text-sm text-fg-muted">Estamos cargando tus preguntas. En un momento empiezas y cada respuesta se corregirá al instante.</p>
    </div>
    <LoadingProgress stage={stage} stageSince={stageSince} startedAt={startedAt} done={done} onRetry={onRetry} />
    <MascotTips />
  </div>;
}

export function SessionPage() {
  const { topicId = "" } = useParams();
  const navigate = useNavigate();
  const [practice, setPractice] = useState<Practice | null>(null);
  // La práctica ya está lista, pero la primera pregunta espera a que se vea la barra completa.
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [index, setIndex] = useState(0);
  const [award, setAward] = useState<{ sessionId: string; xp: XpAward } | null>(null);
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
    mutationFn: (session: { id: string; answers: SessionAnswer[] }) => submitPractice(session.id, session.answers),
    onSuccess: (data, session) => {
      if (data.xp) setAward({ sessionId: session.id, xp: data.xp });
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
    return <XpResult award={award.xp} onContinue={() => navigate(`/estudiante/sesiones/${award.sessionId}/revision`, { replace: true })} />;
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

  return <div className="max-sm:[&>header]:mb-4 max-sm:[&_h1]:text-xl">
    <PageHeader
      title={`Pregunta ${index + 1} de ${payload.questions.length}`}
      description={`${answeredCount} respondidas`}
    />
    {/* En móvil la pregunta va directo sobre el fondo, sin marco, para ganar espacio. */}
    <Card glow className="mx-auto max-w-3xl max-sm:border-0 max-sm:bg-none max-sm:p-0 max-sm:shadow-none sm:p-6">
      <h2 className="text-xl font-semibold text-fg-strong"><MathText>{question.question.statement}</MathText></h2>
      <div className="relative mt-4 grid gap-3 sm:mt-6">
        {options.map(([answerOption, text]) => <button
          key={answerOption}
          disabled={Boolean(feedback) || submit.isPending}
          onClick={() => setSelected(answerOption)}
          className={`min-h-14 items-center gap-4 border px-4 py-3 text-left transition duration-150 disabled:cursor-default ${
            optionClass(answerOption, feedback, chosen, selected)
          }`}
        >
          <strong className={`grid h-8 w-8 shrink-0 place-items-center border font-display text-sm font-normal ${letterClass(answerOption, feedback, chosen, selected)}`}>{answerOption}</strong>
          <span className="flex-1 text-lg text-fg-strong"><MathText>{text}</MathText></span>
          {feedback && answerOption === feedback.correct_option &&
            <span className="text-xs font-semibold text-success-light">Respuesta correcta</span>}
          {feedback && !feedback.is_correct && answerOption === chosen &&
            <span className="text-xs font-semibold text-danger-light">Tu respuesta</span>}
        </button>)}
        {gain && <XpFloat key={question.session_question_id} base={gain.base} bonus={gain.bonus} streak={gain.streak} />}
      </div>
      {feedback && <div className="mt-4 grid gap-3 sm:mt-6">
        <div className="hidden sm:block">
          <Alert tone={feedback.is_correct ? "success" : "error"}>
            {feedback.is_correct
              ? "¡Correcto!"
              : `Incorrecto. La respuesta correcta es la ${feedback.correct_option}.`}
          </Alert>
        </div>
        {feedback.explanation && <div className="border border-line bg-surface-deep p-4">
          <Eyebrow>Explicación</Eyebrow>
          <div className="mt-2 text-fg"><MathText>{feedback.explanation}</MathText></div>
        </div>}
      </div>}
      {submit.error && <div className="mt-4"><Alert tone="error">
        {submit.error.message} Tus respuestas siguen aquí; puedes reintentar sin recargar.
      </Alert></div>}
      {/* En móvil la acción queda fija abajo (estilo Duolingo) y muestra el resultado. */}
      <div ref={barRef} className={`fixed inset-x-0 bottom-0 z-20 grid gap-3 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:static sm:mt-6 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 ${
        !feedback ? "border-line bg-sidebar" : feedback.is_correct ? "border-success/40 bg-sidebar" : "border-danger/40 bg-sidebar"
      }`}>
        {feedback && <p className={`font-semibold sm:hidden ${feedback.is_correct ? "text-success-light" : "text-danger-light"}`}>
          {feedback.is_correct ? "¡Correcto!" : `Incorrecto. La respuesta correcta es la ${feedback.correct_option}.`}
        </p>}
        {!feedback
          ? <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={!selected} onClick={confirm}>Confirmar respuesta</Button>
          : allAnswered
            ? <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={submit.isPending} onClick={finish}>
              {submit.isPending ? "Guardando respuestas…" : submit.error ? "Reintentar" : "Finalizar examen"}
            </Button>
            : <Button className="h-12 w-full sm:h-auto sm:w-auto" onClick={next}>Siguiente</Button>}
      </div>
    </Card>
    {/* Espacio para que la barra fija no tape el final del contenido en móvil. */}
    <div aria-hidden className="sm:hidden" style={{ height: barHeight }} />
  </div>;
}
