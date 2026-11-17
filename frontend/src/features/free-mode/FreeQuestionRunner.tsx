import clsx from "clsx";
import { Flame } from "lucide-react";
import { useState } from "react";
import { Button, ProgressBar } from "../../components/ui";
import { MathText } from "../../lib/math";
import type { AnswerOption } from "../../types/contracts";
import { PracticeMascot, type MascotMood } from "../sessions/PracticeMascot";
import type { FreeModeQuestion } from "./api";

export type FreeModeAnswers = Record<string, AnswerOption>;

/** Aciertos seguidos que terminan en la última respuesta (cuenta hasta `upTo` preguntas). */
function currentStreak(questions: FreeModeQuestion[], answers: FreeModeAnswers, upTo: number): number {
  let streak = 0;
  for (let index = upTo - 1; index >= 0; index--) {
    const question = questions[index]!;
    if (answers[question.id] !== question.correct_option) break;
    streak++;
  }
  return streak;
}

function optionClass(option: AnswerOption, correct: AnswerOption | null, chosen: AnswerOption | null, selected: AnswerOption | null): string {
  if (correct) {
    if (option === correct) return "border-emerald-400 bg-emerald-400/10";
    if (option === chosen) return "border-rose-400 bg-rose-400/10";
    return "border-white/10 opacity-40";
  }
  return selected === option ? "border-white bg-white/10" : "border-white/15 bg-slate-900 hover:bg-white/5";
}

/**
 * Prueba del modo gratuito: la misma dinámica de la práctica del estudiante
 * (elige, confirma y ve la corrección al instante), pero sin sesión, FSRS ni
 * xp. Las respuestas correctas ya vienen con las preguntas.
 */
export function FreeQuestionRunner({ questions, onFinish }: { questions: FreeModeQuestion[]; onFinish: (answers: FreeModeAnswers) => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [answers, setAnswers] = useState<FreeModeAnswers>({});
  const question = questions[index]!;
  const chosen = answers[question.id] ?? null;
  const correct = chosen ? question.correct_option : null;
  const isLast = index === questions.length - 1;
  const answeredCount = Object.keys(answers).length;
  const streak = currentStreak(questions, answers, chosen ? index + 1 : index);
  const mood: MascotMood = !chosen ? "idle" : chosen === question.correct_option ? "happy" : "sad";
  const options: Array<[AnswerOption, string]> = [["A", question.option_a], ["B", question.option_b], ["C", question.option_c], ["D", question.option_d]];

  const next = () => {
    if (isLast) return onFinish(answers);
    setIndex(index + 1);
    setSelected(null);
  };

  return <div className="mx-auto grid max-w-2xl gap-5 text-left">
    <div className="flex items-center gap-4">
      <div className="flex-1"><ProgressBar value={(answeredCount / questions.length) * 100} label="Avance de la prueba" /></div>
      <span className={clsx("inline-flex items-center gap-1 text-sm font-bold tabular-nums", streak > 0 ? "text-amber-300" : "text-slate-500")} aria-label={`${streak} aciertos seguidos`}>
        <Flame size={18} className={streak > 0 ? "fill-current" : undefined} />{streak}
      </span>
    </div>
    <div className="flex items-end gap-3">
      <PracticeMascot mood={mood} size={56} />
      <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900 p-4 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{`Pregunta ${index + 1} de ${questions.length}`}</p>
        <h2 className="mt-2 text-xl font-semibold sm:text-2xl"><MathText>{question.statement}</MathText></h2>
      </div>
    </div>
    <div className="grid gap-3">
      {options.map(([option, text]) => <button key={option} type="button" disabled={Boolean(chosen)} onClick={() => setSelected(option)}
        className={clsx("flex min-h-14 items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition disabled:cursor-default", optionClass(option, correct, chosen, selected))}>
        <strong className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-current text-sm">{option}</strong>
        <span className="min-w-0 flex-1 text-lg"><MathText>{text}</MathText></span>
        {correct && option === correct && <span className="text-xs font-semibold text-emerald-300">Respuesta correcta</span>}
        {chosen && chosen !== question.correct_option && option === chosen && <span className="text-xs font-semibold text-rose-300">Tu respuesta</span>}
      </button>)}
    </div>
    {chosen && question.explanation && <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Explicación</p>
      <div className="mt-2"><MathText>{question.explanation}</MathText></div>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      {chosen
        ? <p className={clsx("text-lg font-bold", chosen === question.correct_option ? "text-emerald-300" : "text-rose-300")}>
          {chosen === question.correct_option ? "¡Correcto!" : `Incorrecto. La respuesta correcta es la ${question.correct_option}.`}
        </p>
        : <p className="text-sm text-slate-400">Elige una opción y confírmala.</p>}
      {chosen
        ? <Button className="h-12 w-full sm:h-auto sm:w-auto" onClick={next}>{isLast ? "Ver mi resultado" : "Siguiente"}</Button>
        : <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={!selected} onClick={() => selected && setAnswers({ ...answers, [question.id]: selected })}>Confirmar respuesta</Button>}
    </div>
  </div>;
}
