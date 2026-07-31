import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Button, Card, Field, Input, PageHeader } from "../../components/ui";
import { fileToBase64, importQuestions } from "../../features/questions/api";
import type { ImportResponse } from "../../types/contracts";

export function ImportPage() {
  const { topicId = "" } = useParams();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const validate = useMutation({ mutationFn: async () => importQuestions({ action: "validate", topic_id: topicId, filename: file!.name, file_base64: await fileToBase64(file!) }), onSuccess: setPreview });
  const confirm = useMutation({ mutationFn: async () => importQuestions({ action: "confirm", topic_id: topicId, filename: file!.name, file_base64: await fileToBase64(file!) }), onSuccess: setPreview });
  return <><PageHeader title="Importar preguntas" description="Valida la plantilla antes de confirmar los cambios." actions={<a href="/templates/plantilla-preguntas.xlsx" download><Button variant="secondary">Descargar plantilla</Button></a>} /><Card className="max-w-3xl"><Alert>La explicación es opcional. Se importarán las filas válidas y se reportarán las rechazadas.</Alert><div className="mt-5"><Field label="Archivo XLSX"><Input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} /></Field></div><div className="mt-4 flex gap-3"><Button disabled={!file || validate.isPending} onClick={() => validate.mutate()}>Validar</Button>{preview && preview.report.accepted > 0 && <Button disabled={confirm.isPending} onClick={() => confirm.mutate()}>Confirmar importación</Button>}</div>{(validate.error || confirm.error) && <div className="mt-4"><Alert tone="error">{(validate.error ?? confirm.error)?.message}</Alert></div>}{preview && <div className="mt-6 grid gap-4"><div className="grid grid-cols-3 gap-3">{[["Válidas", preview.report.accepted], ["Rechazadas", preview.report.rejected], ["Duplicadas", preview.report.duplicates]].map(([label, value]) => <div className="rounded-xl bg-slate-50 p-4 text-center" key={String(label)}><strong className="block text-2xl">{value}</strong><span className="text-xs text-slate-500">{label}</span></div>)}</div>{preview.report.issues.length > 0 && <ul className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{preview.report.issues.map((issue) => <li key={`${issue.row}-${issue.code}`}>Fila {issue.row}: {issue.message}</li>)}</ul>}{preview.batch_id && <Alert tone="success">Importación completada.</Alert>}</div>}</Card></>;
}
