import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, Circle, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, Eyebrow, PageHeader } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
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
  if (query.isLoading || !query.data) return <div aria-busy="true">
    <Skeleton height={36} width="22rem" rounded="none" />
    <Skeleton className="mt-8" height={90} rounded="none" />
    <div className="mt-6 grid gap-4">{[0, 1, 2].map((item) => <Skeleton key={item} height={200} rounded="none" />)}</div>
  </div>;
  const { session, questions } = query.data;
  const returnTo = profile?.role === "teacher"
    ? `/profesor/estudiantes/${session.student_id}/resultados`
    : "/estudiante";
  const returnLabel = profile?.role === "teacher" ? "Volver a resultados" : "Volver a mi aprendizaje";

  return <>
    <PageHeader
      title={`${session.course_name} · ${session.topic_name}`}
      description="Revisión del examen completado."
      actions={<Link to={returnTo}><Button variant="primary">{returnLabel}</Button></Link>}
    />
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <Card><Eyebrow>Aciertos</Eyebrow><strong className="mt-2 block font-display text-3xl font-normal text-success-light">{session.correct_count}</strong></Card>
      <Card><Eyebrow>Errores</Eyebrow><strong className="mt-2 block font-display text-3xl font-normal text-danger-light">{session.incorrect_count}</strong></Card>
      <Card><Eyebrow>Porcentaje</Eyebrow><strong className="mt-2 block font-display text-3xl font-normal text-primary-pale">{session.correct_percentage}%</strong></Card>
    </div>
    <div className="grid gap-4">
      {questions.map((question) => <Card key={question.position}>
        <div className="flex items-start justify-between gap-4">
          <h2 className={clsx("flex gap-2 font-semibold", question.is_correct ? "text-success-light" : "text-danger-light")}>
            {question.is_correct ? <Check className="mt-0.5 shrink-0" /> : <X className="mt-0.5 shrink-0" />}
            <span>{question.position}. <MathText>{question.statement}</MathText></span>
          </h2>
          <Badge tone={question.is_correct ? "success" : "danger"}>{question.is_correct ? "Correcta" : "Incorrecta"}</Badge>
        </div>
        <div className="mt-5 grid gap-2">
          {options(question).map(([answerOption, text]) => {
            const selected = answerOption === question.selected_option;
            const correct = answerOption === question.correct_option;
            return <div key={answerOption} className={clsx(
              "flex min-h-12 items-center gap-3 border px-3 py-2",
              correct && "border-success bg-success/10 text-fg-strong",
              selected && !correct && "border-danger bg-danger/10 text-fg-strong",
              !correct && !(selected && !correct) && "border-line text-fg-muted",
            )}>
              <Circle className={clsx("h-5 w-5 shrink-0", selected && "fill-current")} />
              <strong>{answerOption}</strong>
              <span className="flex-1"><MathText>{text}</MathText></span>
              {correct && <Check aria-label="Respuesta correcta" className="text-success-light" />}
              {selected && !correct && <X aria-label="Tu respuesta" className="text-danger-light" />}
            </div>;
          })}
        </div>
        {question.explanation && <div className="mt-4 border border-line bg-surface-deep p-3 text-sm text-fg"><MathText>{question.explanation}</MathText></div>}
      </Card>)}
    </div>
  </>;
}
