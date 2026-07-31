import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Badge, Card, PageHeader, Spinner } from "../../components/ui";
import { getSessionReview } from "../../features/sessions/api";
import { MathText } from "../../lib/math";
export function ReviewPage() {
  const { sessionId = "" } = useParams();
  const query = useQuery({ queryKey: ["session-review", sessionId], queryFn: () => getSessionReview(sessionId), enabled: Boolean(sessionId) });
  if (query.isLoading || !query.data) return <Spinner />;
  const { session, questions } = query.data;
  return <><PageHeader title={`${session.course_name} · ${session.topic_name}`} description="Revisión del examen completado." /><div className="mb-6 grid gap-4 sm:grid-cols-3"><Card><span className="text-sm text-slate-500">Aciertos</span><strong className="block text-3xl text-emerald-600">{session.correct_count}</strong></Card><Card><span className="text-sm text-slate-500">Errores</span><strong className="block text-3xl text-rose-600">{session.incorrect_count}</strong></Card><Card><span className="text-sm text-slate-500">Porcentaje</span><strong className="block text-3xl text-indigo-700">{session.correct_percentage}%</strong></Card></div><div className="grid gap-4">{questions.map((question) => <Card key={question.position}><div className="flex items-start justify-between gap-4"><h2 className="font-semibold">{question.position}. <MathText>{question.statement}</MathText></h2><Badge tone={question.is_correct ? "success" : "warning"}>{question.is_correct ? "Correcta" : "Incorrecta"}</Badge></div><p className="mt-3 text-sm">Tu respuesta: <strong>{question.selected_option}</strong> · Correcta: <strong>{question.correct_option}</strong></p>{question.explanation && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><MathText>{question.explanation}</MathText></div>}</Card>)}</div></>;
}
