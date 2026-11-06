import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader } from "../../components/ui";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import {
  deleteAllTopicQuestions,
  deleteQuestion,
  fileToBase64,
  importQuestions,
  listTopicQuestions,
} from "../../features/questions/api";
import type { AnswerOption, ImportResponse, TopicQuestion } from "../../types/contracts";

const OPTIONS = ["A", "B", "C", "D"] as const;

function QuestionPreview({ question, onDelete }: { question: TopicQuestion; onDelete: () => void }) {
  const options: Record<AnswerOption, string> = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d,
  };
  return <li className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
    <div className="min-w-0">
      <p className="font-medium leading-6 text-slate-900">{question.statement}</p>
      <div className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
        {OPTIONS.map((option) => <span
          key={option}
          className={option === question.correct_option ? "rounded-lg bg-emerald-50 px-2 py-1 text-emerald-900" : "px-2 py-1"}
        >
          <strong>{option}.</strong> {options[option]}{option === question.correct_option && <span className="ml-2 text-xs font-semibold">Correcta</span>}
        </span>)}
      </div>
      {question.explanation && <p className="mt-2 text-sm text-slate-500"><strong className="font-medium text-slate-700">Explicación:</strong> {question.explanation}</p>}
    </div>
    <Button aria-label={`Eliminar pregunta: ${question.statement}`} className="shrink-0 px-2" title="Eliminar pregunta" variant="ghost" onClick={onDelete}>
      <Trash2 aria-hidden="true" size={18} />
    </Button>
  </li>;
}

export function ImportPage() {
  const { topicId = "" } = useParams();
  const client = useQueryClient();
  const modal = useModal();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const questions = useQuery({
    queryKey: ["topic-questions", topicId],
    queryFn: () => listTopicQuestions(topicId),
    enabled: Boolean(topicId),
  });
  const invalidateQuestions = () => client.invalidateQueries({ queryKey: ["topic-questions", topicId] });

  const validate = useMutation({
    mutationFn: async () => importQuestions({ action: "validate", topic_id: topicId, filename: file!.name, file_base64: await fileToBase64(file!) }),
    onSuccess: (data) => {
      setPreview(data);
      setConfirmed(false);
    },
  });
  const confirm = useMutation({
    mutationFn: async () => importQuestions({ action: "confirm", topic_id: topicId, filename: file!.name, file_base64: await fileToBase64(file!) }),
    onSuccess: (data) => {
      setPreview(data);
      setConfirmed(true);
      const added = data.report.accepted;
      toast.success(added === 1 ? "Se agregó 1 pregunta nueva." : `Se agregaron ${added} preguntas nuevas.`);
      void invalidateQuestions();
    },
  });
  const remove = useMutation({
    mutationFn: (questionId: string) => deleteQuestion(questionId),
    onSuccess: () => {
      toast.success("Pregunta eliminada.");
      void invalidateQuestions();
    },
    onError: (error) => toast.error(error.message),
  });
  const removeAll = useMutation({
    mutationFn: () => deleteAllTopicQuestions(topicId),
    onSuccess: ({ archived }) => {
      toast.success(archived === 1 ? "Se eliminó 1 pregunta." : `Se eliminaron ${archived} preguntas.`);
      void invalidateQuestions();
    },
    onError: (error) => toast.error(error.message),
  });

  const requestDelete = (question: TopicQuestion) => modal.delete({
    title: "Eliminar pregunta",
    body: <>
      <p>La pregunta dejará de aparecer en este tema y en las sesiones nuevas. Se conservarán los resultados históricos de los estudiantes.</p>
      <p className="mt-3 rounded-xl bg-slate-50 p-3 font-medium text-slate-800">{question.statement}</p>
    </>,
    onConfirm: () => remove.mutateAsync(question.id),
  });

  const requestDeleteAll = () => modal.delete({
    title: "Eliminar todas las preguntas",
    body: <>
      <p>Se eliminarán las {questions.data?.length ?? 0} preguntas de este tema. Dejarán de aparecer en las sesiones nuevas, pero se conservarán los resultados históricos de los estudiantes.</p>
    </>,
    onConfirm: () => removeAll.mutateAsync(),
  });

  return <>
    <PageHeader title="Importar preguntas" description="Valida la plantilla antes de confirmar los cambios." actions={<a href="/templates/plantilla-preguntas.xlsx" download><Button variant="secondary">Descargar plantilla</Button></a>} />
    <Card className="max-w-3xl">
      <Alert>La explicación es opcional. Se importarán las filas válidas y se reportarán las rechazadas.</Alert>
      <div className="mt-5">
        <Field label="Archivo XLSX">
          <Input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setConfirmed(false); }} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button disabled={!file || validate.isPending} onClick={() => validate.mutate()}>Validar</Button>
        {preview && preview.report.accepted > 0 && <Button disabled={confirm.isPending || confirmed} onClick={() => confirm.mutate()}>Confirmar importación</Button>}
        <Button disabled={!questions.data?.length || removeAll.isPending} variant="danger" onClick={requestDeleteAll}>Eliminar todas</Button>
      </div>
      {(validate.error || confirm.error) && <div className="mt-4"><Alert tone="error">{(validate.error ?? confirm.error)?.message}</Alert></div>}
      {preview && !confirmed && <div className="mt-6 grid grid-cols-3 gap-3">
        {[["Válidas", preview.report.accepted], ["Rechazadas", preview.report.rejected], ["Duplicadas", preview.report.duplicates]].map(([label, value]) => <div className="rounded-xl bg-slate-50 p-4 text-center" key={String(label)}><strong className="block text-2xl">{value}</strong><span className="text-xs text-slate-500">{label}</span></div>)}
      </div>}

      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-950">Preguntas del tema</h2>
            <p className="mt-1 text-sm text-slate-600">Estas son las preguntas que los estudiantes pueden recibir en este tema.</p>
          </div>
          {questions.data && <Badge>{questions.data.length} {questions.data.length === 1 ? "pregunta" : "preguntas"}</Badge>}
        </div>
        {questions.isLoading
          ? <p className="mt-4 text-sm text-slate-500">Cargando preguntas…</p>
          : questions.error
            ? <div className="mt-4"><Alert tone="error">{questions.error.message}</Alert></div>
            : questions.data?.length
              ? <ul className="mt-4 grid gap-3">{questions.data.map((question) => <QuestionPreview key={question.id} question={question} onDelete={() => requestDelete(question)} />)}</ul>
              : <div className="mt-4"><EmptyState>Este tema todavía no tiene preguntas.</EmptyState></div>}
      </div>
    </Card>
  </>;
}
