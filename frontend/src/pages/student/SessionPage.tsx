import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, PageHeader, Spinner } from "../../components/ui";
import { answerQuestion, completeSession, startSession } from "../../features/sessions/api";
import { MathText } from "../../lib/math";
import type { AnswerOption, SessionPayload } from "../../types/contracts";
export function SessionPage() {
  const { topicId = "" } = useParams(); const navigate = useNavigate();
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [index, setIndex] = useState(0); const [selected, setSelected] = useState<AnswerOption | null>(null); const [startedAt, setStartedAt] = useState(0);
  const start = useMutation({ mutationFn: () => startSession(topicId), onSuccess: (data) => { setPayload(data); setStartedAt(Date.now()); const next = data.questions.findIndex((q) => !q.selected_option); setIndex(next < 0 ? data.questions.length - 1 : next); } });
  const startMutation = start.mutate;
  useEffect(() => { startMutation(); }, [topicId, startMutation]);
  const answer = useMutation({ mutationFn: async () => { const question = payload!.questions[index]!; await answerQuestion({ session_question_id: question.session_question_id, selected_option: selected!, response_time_ms: Date.now() - startedAt }); return question; }, onSuccess: (question) => { setPayload((current) => current && ({ ...current, session: { ...current.session, answered_questions: current.session.answered_questions + 1 }, questions: current.questions.map((q) => q.session_question_id === question.session_question_id ? { ...q, selected_option: selected, answered_at: new Date().toISOString() } : q) })); setSelected(null); setIndex((value) => Math.min(value + 1, payload!.questions.length - 1)); setStartedAt(Date.now()); } });
  const complete = useMutation({ mutationFn: () => completeSession(payload!.session.id), onSuccess: () => navigate(`/estudiante/sesiones/${payload!.session.id}/revision`, { replace: true }) });
  const question = payload?.questions[index]; const allAnswered = payload && payload.questions.every((q) => q.selected_option);
  const options = useMemo(() => question ? ([["A", question.question.option_a], ["B", question.question.option_b], ["C", question.question.option_c], ["D", question.question.option_d]] as const) : [], [question]);
  if (start.isPending || !payload || !question) return <Spinner />;
  return <><PageHeader title={`Pregunta ${index + 1} de ${payload.questions.length}`} description={`${payload.session.answered_questions} respondidas`} />{start.error && <Alert tone="error">{start.error.message}</Alert>}<Card className="mx-auto max-w-3xl"><h2 className="text-lg font-semibold"><MathText>{question.question.statement}</MathText></h2><div className="mt-6 grid gap-3">{options.map(([option, text]) => <button key={option} disabled={Boolean(question.selected_option)} onClick={() => setSelected(option)} className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left ${selected === option || question.selected_option === option ? "border-indigo-500 bg-indigo-50" : "hover:border-indigo-300"}`}><strong className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100">{option}</strong><span><MathText>{text}</MathText></span></button>)}</div>{answer.error && <div className="mt-4"><Alert tone="error">{answer.error.message}</Alert></div>}<div className="mt-6 flex justify-between gap-3"><Button variant="secondary" disabled={index === 0} onClick={() => { setIndex(index - 1); setSelected(null); }}>Anterior</Button>{allAnswered ? <Button onClick={() => complete.mutate()}>Finalizar examen</Button> : <Button disabled={!selected || Boolean(question.selected_option) || answer.isPending} onClick={() => answer.mutate()}>Confirmar respuesta</Button>}</div></Card></>;
}
