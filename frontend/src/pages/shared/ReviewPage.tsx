import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, Circle, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, PageHeader, Spinner } from "../../components/ui";
import { useAuth } from "../../features/auth/AuthProvider";
import { getSessionReview } from "../../features/sessions/api";
import { MathText } from "../../lib/math";
import type { AnswerOption, ReviewQuestion } from "../../types/contracts";

function options(question: ReviewQuestion): Array<[AnswerOption, string]> {
  return [
    ["A", question.option_a],
    ["B", question.option_b],
    ["C", question.option_c],
    ["D", question.option_d],
  ];
}

export function ReviewPage() {
  const { sessionId = "" } = useParams();
  const { profile } = useAuth();
  const query = useQuery({
    queryKey: ["session-review", sessionId],
    queryFn: () => getSessionReview(sessionId),
    enabled: Boolean(sessionId),
  });
  if (query.isLoading || !query.data) return <Spinner />;
  const { session, questions } = query.data;
  const returnTo = profile?.role === "teacher"
    ? `/profesor/estudiantes/${session.student_id}/resultados`
    : "/estudiante";
  const returnLabel = profile?.role === "teacher" ? "Volver a resultados" : "Volver a mi aprendizaje";

  return <>
    <PageHeader
      title={`${session.course_name} · ${session.topic_name}`}
      description="Revisión del examen completado."
      actions={<Link to={returnTo}><Button variant="secondary">{returnLabel}</Button></Link>}
    />
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <Card><span className="text-sm text-slate-500">Aciertos</span><strong className="block text-3xl text-emerald-600">{session.correct_count}</strong></Card>
      <Card><span className="text-sm text-slate-500">Errores</span><strong className="block text-3xl text-rose-600">{session.incorrect_count}</strong></Card>
      <Card><span className="text-sm text-slate-500">Porcentaje</span><strong className="block text-3xl text-indigo-700">{session.correct_percentage}%</strong></Card>
    </div>
    <div className="grid gap-4">
      {questions.map((question) => <Card key={question.position}>
        <div className="flex items-start justify-between gap-4">
          <h2 className={clsx("flex gap-2 font-semibold", question.is_correct ? "text-emerald-800" : "text-rose-800")}>
            {question.is_correct ? <Check className="mt-0.5 shrink-0" /> : <X className="mt-0.5 shrink-0" />}
            <span>{question.position}. <MathText>{question.statement}</MathText></span>
          </h2>
          <Badge tone={question.is_correct ? "success" : "warning"}>{question.is_correct ? "Correcta" : "Incorrecta"}</Badge>
        </div>
        <div className="mt-5 grid gap-2">
          {options(question).map(([answerOption, text]) => {
            const selected = answerOption === question.selected_option;
            const correct = answerOption === question.correct_option;
            return <div key={answerOption} className={clsx(
              "flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2",
              correct && "border-emerald-300 bg-emerald-50 text-emerald-900",
              selected && !correct && "border-rose-300 bg-rose-50 text-rose-900",
              !correct && !(selected && !correct) && "border-slate-200 text-slate-600",
            )}>
              <Circle className={clsx("h-5 w-5 shrink-0", selected && "fill-current")} />
              <strong>{answerOption}</strong>
              <span className="flex-1"><MathText>{text}</MathText></span>
              {correct && <Check aria-label="Respuesta correcta" className="text-emerald-600" />}
              {selected && !correct && <X aria-label="Tu respuesta" className="text-rose-600" />}
            </div>;
          })}
        </div>
        {question.explanation && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><MathText>{question.explanation}</MathText></div>}
      </Card>)}
    </div>
  </>;
}
