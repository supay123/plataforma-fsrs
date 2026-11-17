import clsx from "clsx";
import { Check, X } from "lucide-react";
import { Button } from "../../components/ui";
import { MathText } from "../../lib/math";
import type { FreeModeQuestion } from "./api";
import type { FreeModeAnswers } from "./FreeQuestionRunner";

/** Aciertos y errores de la prueba, con el botón que lleva al registro. */
export function FreeResult({ questions, answers, onIdentify }: { questions: FreeModeQuestion[]; answers: FreeModeAnswers; onIdentify: () => void }) {
  const correctCount = questions.filter((question) => answers[question.id] === question.correct_option).length;
  const wrongCount = questions.length - correctCount;
  return <div className="mx-auto grid max-w-2xl gap-6 text-left">
    <div className="grid grid-cols-2 gap-3 text-center">
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
        <strong className="type-heading block text-4xl text-emerald-300">{correctCount}</strong>
        <span className="text-sm text-emerald-100">{correctCount === 1 ? "acierto" : "aciertos"}</span>
      </div>
      <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5">
        <strong className="type-heading block text-4xl text-rose-300">{wrongCount}</strong>
        <span className="text-sm text-rose-100">{wrongCount === 1 ? "error" : "errores"}</span>
      </div>
    </div>
    <ol className="grid gap-2">
      {questions.map((question, index) => {
        const right = answers[question.id] === question.correct_option;
        return <li key={question.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-900 p-3 text-sm">
          <span aria-hidden className={clsx("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full", right ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300")}>{right ? <Check size={14} /> : <X size={14} />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-slate-100"><span className="sr-only">{right ? "Acierto. " : "Error. "}</span>{`${index + 1}. `}<MathText>{question.statement}</MathText></p>
            {!right && <p className="mt-1 text-xs text-slate-400">Tu respuesta: {answers[question.id]} · Correcta: {question.correct_option}</p>}
          </div>
        </li>;
      })}
    </ol>
    <div className="grid justify-items-center gap-2 text-center">
      <Button className="h-12 w-full px-8 text-base sm:w-auto" onClick={onIdentify}>Pulsa para identificarte</Button>
      <p className="text-sm text-slate-400">Identifícate para ver los planes y seguir practicando.</p>
    </div>
  </div>;
}
