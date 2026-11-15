import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePortalFocus, useLeaveWarning, type LeaveWarning } from "../../components/layout/portal-mode";
import { Flame } from "lucide-react";
import { Alert, Button, Card, Eyebrow, ProgressBar } from "../../components/ui";
import { decryptAnswerKey } from "../../features/sessions/answer-key";
import { getXpRules, startPractice, submitPractice } from "../../features/sessions/api";
import { LoadingProgress } from "../../features/sessions/LoadingProgress";
import type { LoadStage } from "../../features/sessions/loading-progress";
import { MascotTips } from "../../features/sessions/MascotTips";
import { PracticeMascot, type MascotMood } from "../../features/sessions/PracticeMascot";
import { useInactivity } from "../../features/sessions/use-inactivity";
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
    if (answerOption === feedback.correct_option) return "border-success text-success-text";
    if (answerOption === chosen) return "border-danger text-danger-text";
  // Selección neutra (sin color): el verde queda solo para "correcto" y el rojo para "incorrecto".
  } else if (selected === answerOption) return "border-fg text-fg";
  return "border-line-strong text-fg-muted";
}

function optionClass(answerOption: AnswerOption, feedback: AnswerFeedback | null, chosen: AnswerOption | null, selected: AnswerOption | null): string {
  if (feedback) {
    if (answerOption === feedback.correct_option) return "flex border-success bg-success-soft [--edge:var(--c-success)]";
    if (answerOption === chosen) return "flex border-danger bg-danger-soft [--edge:var(--c-danger)]";
    // On mobile the feedback only keeps the student's answer and the correct one.
    return "hidden opacity-40 [--edge:var(--c-line-strong)] sm:flex";
  }
  return selected === answerOption ? "flex border-fg bg-sunken [--edge:var(--c-fg)]" : "flex border-line-strong bg-blocks [--edge:var(--c-line-strong)] hover:bg-sunken";
}

/** Pantalla mientras se traen y descifran las preguntas (única carga que no usa skeleton). */
/** Tiempo que la barra se queda al 100 % antes de mostrar la primera pregunta (la barra anima ~0,5 s). */
const DONE_HOLD_MS = 800;
const INACTIVITY_BEFORE_SLEEP_MS = 60_000;
// Hacia dónde mira la mascota al elegir A, B, C o D (las opciones quedan debajo de ella).
const GAZE_BY_OPTION: Record<AnswerOption, { x: number; y: number }> = { A: { x: 0.5, y: -0.2 }, B: { x: 0.5, y: -0.5 }, C: { x: 0.5, y: -0.8 }, D: { x: 0.5, y: -1 } };

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
  const [practice, setPractice] = useState<Practice | null>(null);
  // La práctica ya está lista, pero la primera pregunta espera a que se vea la barra completa.
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [index, setIndex] = useState(0);
  const [award, setAward] = useState<{ sessionId: string; xp: XpAward } | null>(null);
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const sleeping = useInactivity(INACTIVITY_BEFORE_SLEEP_MS, practice !== null && award === null);
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

  // Aciertos seguidos hasta la pregunta actual (cuenta la actual solo si ya se respondió).
  const streak = trailingStreak(payload.questions.slice(0, index + (feedback ? 1 : 0)).map((item) => wasCorrect(item, answers, key) === true));
  const mood: MascotMood = !feedback ? "idle" : feedback.is_correct ? "happy" : "sad";
  const resultText = feedback ? (feedback.is_correct ? "¡Correcto!" : `Incorrecto. La respuesta correcta es la ${feedback.correct_option}.`) : "";

  return <div className="mx-auto grid max-w-2xl gap-6">
    <h1 className="sr-only">Práctica</h1>
    <div className="flex items-center gap-4">
      <div className="flex-1"><ProgressBar value={(answeredCount / payload.questions.length) * 100} label="Avance de la práctica" /></div>
      <span className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums ${streak > 0 ? "text-warning-text" : "text-fg-faint"}`} aria-label={`${streak} aciertos seguidos`}><Flame size={18} className={streak > 0 ? "fill-current" : undefined} />{streak}</span>
    </div>

    <div className="flex items-end gap-3 sm:gap-4">
      <PracticeMascot mood={mood} event={sleeping ? "sleep" : gain && gain.bonus > 0 ? "streak" : undefined} gaze={selected && !feedback ? GAZE_BY_OPTION[selected] : null} size={56} className="sm:h-[72px]! sm:w-[72px]!" />
      <Card className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <Eyebrow>{`Pregunta ${index + 1} de ${payload.questions.length}`}</Eyebrow>
          <p className="text-xs text-fg-faint">{`${answeredCount} respondidas`}</p>
        </div>
        <h2 className="mt-2 text-xl font-semibold sm:text-2xl"><MathText>{question.question.statement}</MathText></h2>
      </Card>
    </div>

    <div className="relative grid gap-3">
      {options.map(([answerOption, text]) => <button
        key={answerOption}
        disabled={Boolean(feedback) || submit.isPending}
        onClick={() => setSelected(answerOption)}
        className={`min-h-14 items-center gap-4 rounded-xl border-2 px-4 py-3 text-left shadow-[0_4px_0_var(--edge)] transition duration-100 enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-default ${
          optionClass(answerOption, feedback, chosen, selected)
        }`}
      >
        <strong className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 text-sm ${letterClass(answerOption, feedback, chosen, selected)}`}>{answerOption}</strong>
        <span className="min-w-0 flex-1 text-lg"><MathText>{text}</MathText></span>
        {feedback && answerOption === feedback.correct_option &&
          <span className="text-xs font-semibold text-success-text">Respuesta correcta</span>}
        {feedback && !feedback.is_correct && answerOption === chosen &&
          <span className="text-xs font-semibold text-danger-text">Tu respuesta</span>}
      </button>)}
      {gain && <XpFloat key={question.session_question_id} base={gain.base} bonus={gain.bonus} streak={gain.streak} />}
    </div>

    {feedback?.explanation && <div className="rounded-2xl border-2 border-line bg-sunken p-4 text-on-blocks">
      <Eyebrow>Explicación</Eyebrow>
      <div className="mt-2"><MathText>{feedback.explanation}</MathText></div>
    </div>}
    {submit.error && <Alert tone="error">
      {submit.error.message} Tus respuestas siguen aquí; puedes reintentar sin recargar.
    </Alert>}

    {/* Pie fijo: resultado y acción. Deja libre el menú lateral (--menu-w) y reserva su alto al final. */}
    <div ref={barRef} className={`fixed inset-x-0 bottom-0 z-20 border-t-2 bg-blocks text-on-blocks transition-colors md:left-(--menu-w) ${
      !feedback ? "border-line" : feedback.is_correct ? "border-success" : "border-danger"
    }`}>
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:py-4">
        {feedback
          ? <p className={`type-heading text-lg ${feedback.is_correct ? "text-success-text" : "text-danger-text"}`}>{resultText}</p>
          : <p className="text-sm text-fg-muted">Elige una opción y confírmala.</p>}
        {!feedback
          ? <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={!selected} onClick={confirm}>Confirmar respuesta</Button>
          : allAnswered
            ? <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={submit.isPending} onClick={finish}>
              {submit.isPending ? "Guardando respuestas…" : submit.error ? "Reintentar" : "Finalizar examen"}
            </Button>
            : <Button className="h-12 w-full sm:h-auto sm:w-auto" variant={feedback.is_correct ? "primary" : "danger"} onClick={next}>Siguiente</Button>}
      </div>
    </div>
    {/* Espacio para que el pie fijo no tape el final del contenido. */}
    <div aria-hidden style={{ height: barHeight }} />
  </div>;
}
