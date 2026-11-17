import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Button, Card, Eyebrow, Field, Input, Select, Textarea } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/use-toast";
import {
  createRouteLesson, EMPTY_QUESTION, getRouteLessonContent, QUESTIONS_PER_LESSON, routeLessonContentKey,
  routeLessonsKey, routeTopicsKey, saveRouteLessonQuestions, updateRouteLesson,
  type RouteOption, type RouteQuestionDraft,
} from "./api";
import { LessonText } from "./LessonText";

interface LessonEditorProps {
  topicId: string;
  /** Con id se edita una lección existente; sin id se crea una nueva. */
  lessonId: string | null;
  teacherId: string | null;
  onClose: () => void;
}

const optionFields = [["option_a", "A"], ["option_b", "B"], ["option_c", "C"], ["option_d", "D"]] as const;

interface EditorInitialValues { title: string; text: string; questions: RouteQuestionDraft[] }

const blankQuestions = () => Array.from({ length: QUESTIONS_PER_LESSON }, () => ({ ...EMPTY_QUESTION }));

/** Lección en dos pasos: primero el texto y después exactamente 5 preguntas. Al editar, espera a traer lo guardado. */
export function LessonEditor(props: LessonEditorProps) {
  const existing = useQuery({ queryKey: routeLessonContentKey(props.lessonId ?? ""), queryFn: () => getRouteLessonContent(props.lessonId!), enabled: Boolean(props.lessonId), staleTime: 0, gcTime: 0 });
  const toast = useToast();
  const { onClose } = props;
  useEffect(() => {
    if (!existing.error) return;
    toast.error(existing.error.message);
    onClose();
  }, [existing.error, toast, onClose]);
  if (props.lessonId && !existing.data) return <Card><Skeleton height={28} width="12rem" /><Skeleton className="mt-4" height={220} rounded="2xl" /></Card>;
  const initial: EditorInitialValues = existing.data
    ? {
      title: existing.data.lesson.title,
      text: existing.data.lesson.content_text,
      questions: Array.from({ length: QUESTIONS_PER_LESSON }, (_, index) => {
        const saved = existing.data.questions[index];
        return saved ? { statement: saved.statement, option_a: saved.option_a, option_b: saved.option_b, option_c: saved.option_c, option_d: saved.option_d, correct_option: saved.correct_option ?? "A", explanation: saved.explanation ?? "" } : { ...EMPTY_QUESTION };
      }),
    }
    : { title: "", text: "", questions: blankQuestions() };
  return <LessonEditorForm {...props} initial={initial} />;
}

function LessonEditorForm({ topicId, lessonId, teacherId, onClose, initial }: LessonEditorProps & { initial: EditorInitialValues }) {
  const toast = useToast();
  const client = useQueryClient();
  const [savedLessonId, setSavedLessonId] = useState<string | null>(lessonId);
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text);
  const [questions, setQuestions] = useState<RouteQuestionDraft[]>(initial.questions);
  const [active, setActive] = useState(0);

  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: routeLessonsKey(topicId) }),
    client.invalidateQueries({ queryKey: routeTopicsKey(teacherId) }),
    savedLessonId ? client.invalidateQueries({ queryKey: routeLessonContentKey(savedLessonId) }) : Promise.resolve(),
  ]);

  const saveText = useMutation({
    mutationFn: async () => {
      if (savedLessonId) { await updateRouteLesson(savedLessonId, { title, content_text: text }); return savedLessonId; }
      return (await createRouteLesson({ topic_id: topicId, title, content_text: text })).lesson.id;
    },
    onSuccess: (id) => { setSavedLessonId(id); setStep(2); void refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const saveQuestions = useMutation({
    mutationFn: () => saveRouteLessonQuestions(savedLessonId!, questions),
    onSuccess: async () => { await refresh(); toast.success("Lección guardada"); onClose(); },
    onError: (error) => toast.error(error.message),
  });

  const patch = (index: number, change: Partial<RouteQuestionDraft>) => setQuestions((previous) => previous.map((question, position) => position === index ? { ...question, ...change } : question));
  const complete = (question: RouteQuestionDraft) => [question.statement, question.option_a, question.option_b, question.option_c, question.option_d].every((value) => value.trim() !== "");
  const allComplete = questions.every(complete);

  const question = questions[active]!;
  return <Card className="grid gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Eyebrow>{lessonId ? "Editar lección" : "Nueva lección"}</Eyebrow><h2 className="type-heading mt-1 text-xl">{step === 1 ? "Paso 1 de 2: texto de la lección" : "Paso 2 de 2: 5 preguntas"}</h2></div>
      <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
    </div>

    {step === 1 ? <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); saveText.mutate(); }}>
      <Field label="Título de la lección"><Input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="Texto" hint="Escribe con saltos de línea. Las fórmulas van entre $...$ (en línea) o $$...$$ (en bloque)."><Textarea required rows={12} maxLength={20000} value={text} onChange={(event) => setText(event.target.value)} /></Field>
      {text.trim() !== "" && <div className="rounded-2xl border-2 border-line p-4"><Eyebrow>Vista previa</Eyebrow><LessonText className="mt-2">{text}</LessonText></div>}
      <div className="flex gap-3"><Button disabled={saveText.isPending || title.trim() === "" || text.trim() === ""}>Guardar y seguir con las preguntas</Button></div>
    </form> : <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Preguntas">
        {questions.map((item, index) => <Button key={index} type="button" role="tab" aria-selected={active === index} size="sm" variant={active === index ? "primary" : "secondary"} onClick={() => setActive(index)}>
          Pregunta {index + 1}{complete(item) ? " ✓" : ""}
        </Button>)}
      </div>
      <Field label={`Enunciado de la pregunta ${active + 1}`}><Textarea rows={3} maxLength={2000} value={question.statement} onChange={(event) => patch(active, { statement: event.target.value })} /></Field>
      <div className="grid gap-3 @xl:grid-cols-2">
        {optionFields.map(([field, letter]) => <Field key={field} label={`Respuesta ${letter}`}><Input maxLength={1000} value={question[field]} onChange={(event) => patch(active, { [field]: event.target.value })} /></Field>)}
      </div>
      <Field label="Respuesta correcta"><Select value={question.correct_option} onChange={(event) => patch(active, { correct_option: event.target.value as RouteOption })}>{optionFields.map(([, letter]) => <option key={letter} value={letter}>{letter}</option>)}</Select></Field>
      <Field label="Explicación (opcional)"><Textarea rows={3} maxLength={2000} value={question.explanation} onChange={(event) => patch(active, { explanation: event.target.value })} /></Field>
      <div className={clsx("flex flex-wrap items-center gap-3")}>
        <Button type="button" variant="secondary" onClick={() => setStep(1)}>Volver al texto</Button>
        <Button type="button" disabled={!allComplete || saveQuestions.isPending} onClick={() => saveQuestions.mutate()}>Guardar lección</Button>
        {!allComplete && <p className="text-sm text-fg-muted">Completa enunciado y 4 respuestas en las {QUESTIONS_PER_LESSON} preguntas.</p>}
      </div>
    </div>}
  </Card>;
}
