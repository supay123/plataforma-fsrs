import { useState } from "react";
import { Button } from "../../components/ui";
import type { AnswerFeedback, AnswerOption } from "../../types/contracts";
import { PracticeQuestion } from "../sessions/PracticeQuestion";
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

/**
 * Prueba del modo gratuito: la práctica del estudiante (`PracticeQuestion`, el mismo componente)
 * pero sin sesión, FSRS ni xp. Las respuestas correctas ya vienen con las preguntas.
 */
export function FreeQuestionRunner({ questions, onFinish, onExit }: { questions: FreeModeQuestion[]; onFinish: (answers: FreeModeAnswers) => void; onExit?: () => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [answers, setAnswers] = useState<FreeModeAnswers>({});
  const question = questions[index]!;
  const chosen = answers[question.id] ?? null;
  const feedback: AnswerFeedback | null = chosen
    ? { is_correct: chosen === question.correct_option, correct_option: question.correct_option, explanation: question.explanation }
    : null;
  const isLast = index === questions.length - 1;
  const options = [["A", question.option_a], ["B", question.option_b], ["C", question.option_c], ["D", question.option_d]] as const;

  const next = () => {
    if (isLast) return onFinish(answers);
    setIndex(index + 1);
    setSelected(null);
  };

  return <PracticeQuestion
    onExit={onExit}
    progressLabel="Avance de la prueba"
    progressValue={(Object.keys(answers).length / questions.length) * 100}
    streak={currentStreak(questions, answers, chosen ? index + 1 : index)}
    eyebrow={`Pregunta ${index + 1} de ${questions.length}`}
    statement={question.statement}
    options={options}
    selected={selected}
    chosen={chosen}
    feedback={feedback}
    onSelect={setSelected}
    actions={feedback
      ? <Button className="h-12 w-full sm:h-auto sm:w-auto" variant={feedback.is_correct ? "primary" : "danger"} onClick={next}>{isLast ? "Finalizar práctica" : "Siguiente"}</Button>
      : <Button className="h-12 w-full sm:h-auto sm:w-auto" disabled={!selected} onClick={() => selected && setAnswers({ ...answers, [question.id]: selected })}>Confirmar respuesta</Button>}
  />;
}
