import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Field, PageHeader, Textarea } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/use-toast";
import { routeTopicLessonsPath } from "../../lib/portal-paths";
import { useAuth } from "../auth/AuthProvider";
import { getRouteLessonContent, routeLessonContentKey, routeLessonsKey, routeTopicsPrefix, saveRouteLessonContent } from "./api";
import { lessonToJson, readJsonText, ROUTE_LESSON_JSON_EXAMPLE } from "./lesson-json";

const FIELD_GUIDE: Array<[string, string]> = [
  ["text", "Texto de la lección. Puedes dar Enter para separar párrafos (también vale \\n) y usar $...$ o $$...$$ para fórmulas. Admite Markdown básico: **negrita**, títulos con # y listas con - . Se divide en páginas solo, según el tamaño de la pantalla."],
  ["questions", "Banco de preguntas (el total). Cada una lleva statement, option_a a option_d, correct_option (A, B, C o D) y, opcional, explanation."],
  ["questions_to_show", "Cuántas preguntas del banco ve el estudiante en cada intento, elegidas al azar. No puede superar el total."],
];

/** JSON de una lección: texto, banco de preguntas y cuántas se muestran. Parte de lo ya guardado, o del ejemplo si aún está vacía. */
export function RouteLessonJsonPage() {
  const { lessonId = "" } = useParams();
  const content = useQuery({ queryKey: routeLessonContentKey(lessonId), queryFn: () => getRouteLessonContent(lessonId), enabled: Boolean(lessonId), staleTime: 0, gcTime: 0 });
  const toast = useToast();
  const navigate = useNavigate();
  const { profile } = useAuth();
  useEffect(() => {
    if (!content.error) return;
    toast.error(content.error.message);
    navigate(-1);
  }, [content.error, toast, navigate]);
  if (!content.data) return <div role="status" aria-busy="true" aria-label="Cargando">
    <Skeleton height={36} width="16rem" /><Skeleton className="mt-8" height={380} rounded="2xl" />
  </div>;
  const { lesson } = content.data;
  return <>
    <PageHeader title={lesson.title} description="Pega el JSON con el texto y las preguntas de esta lección. Copia el ejemplo de abajo si lo necesitas."
      actions={<Link to={routeTopicLessonsPath(profile?.role, lesson.topic_id)}><Button variant="secondary">Volver a las lecciones</Button></Link>} />
    <JsonForm lessonId={lesson.id} topicId={lesson.topic_id} initialJson={lesson.is_ready ? lessonToJson(content.data) : ""} />
  </>;
}

function JsonForm({ lessonId, topicId, initialJson }: { lessonId: string; topicId: string; initialJson: string }) {
  const toast = useToast();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [jsonText, setJsonText] = useState(initialJson);
  const save = useMutation({
    mutationFn: async () => {
      const parsed = readJsonText(jsonText);
      if ("error" in parsed) throw new Error(parsed.error);
      return saveRouteLessonContent(lessonId, parsed.value);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: routeLessonsKey(topicId) }),
        client.invalidateQueries({ queryKey: routeTopicsPrefix }),
        client.invalidateQueries({ queryKey: routeLessonContentKey(lessonId) }),
      ]);
      toast.success("Lección guardada");
      navigate(routeTopicLessonsPath(profile?.role, topicId));
    },
    onError: (error) => toast.error(error.message),
  });
  return <div className="grid gap-6">
    <Card>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <Field label="JSON" hint="Al guardar reemplaza el texto y las preguntas de la lección.">
          <Textarea required rows={18} spellCheck={false} placeholder="Pega aquí el JSON de la lección" className="font-mono text-sm" value={jsonText} onChange={(event) => setJsonText(event.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button disabled={save.isPending || jsonText.trim() === ""}>Guardar lección</Button>
        </div>
      </form>
    </Card>
    <Card>
      <h2 className="type-heading text-lg">Cómo escribir el JSON</h2>
      <dl className="mt-3 grid gap-2 text-sm">
        {FIELD_GUIDE.map(([name, description]) => <div key={name}><dt className="inline font-mono font-semibold">{name}: </dt><dd className="inline text-fg-muted">{description}</dd></div>)}
      </dl>
      <p className="mt-3 text-sm text-fg-muted">Ejemplo:</p>
      <div className="relative mt-2">
        <CopyButton text={ROUTE_LESSON_JSON_EXAMPLE} />
        <pre className="max-h-96 overflow-auto rounded-xl bg-base p-3 pr-14 text-xs">{ROUTE_LESSON_JSON_EXAMPLE}</pre>
      </div>
    </Card>
  </div>;
}

function CopyButton({ text }: { text: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  };
  return <Button type="button" size="sm" variant="secondary" className="absolute right-2 top-2 px-2" aria-label={copied ? "Ejemplo copiado" : "Copiar ejemplo"} title="Copiar ejemplo" onClick={() => void copy()}>
    {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
  </Button>;
}
