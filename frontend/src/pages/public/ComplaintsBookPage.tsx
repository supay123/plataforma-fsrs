import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { Download, X } from "lucide-react";
import { useState, type ChangeEvent, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { ComplaintsBookIcon, PublicPage } from "../../components/layout/PublicLayout";
import { Alert, Button, Card, Input, Select, Textarea } from "../../components/ui";
import { EVIDENCE_MAX_BYTES, assignComplaintNumber, sendComplaint, type AssignedComplaintNumber } from "../../features/complaints/api";
import { DOCUMENT_TYPES, complaintSections, isTestSheet, sheetLabel, type ComplaintData, type ComplaintRecord } from "../../features/complaints/model";
import { complaintPdfBlob, complaintPdfFilename, downloadComplaintPdf } from "../../features/complaints/pdf";
import { normalizeError } from "../../lib/api/errors";

const required = (message: string) => z.string().trim().min(1, message);
const schema = z.object({
  consumer_name: required("Ingresa tu nombre completo."),
  consumer_document_type: z.enum(["DNI", "CE", "PASAPORTE", "RUC"]),
  consumer_document_number: required("Ingresa tu número de documento.").max(20, "Máximo 20 caracteres."),
  consumer_address: required("Ingresa tu domicilio."),
  consumer_department: required("Ingresa tu departamento."),
  consumer_province: required("Ingresa tu provincia."),
  consumer_district: required("Ingresa tu distrito."),
  consumer_phone: z.string().trim().max(30, "Máximo 30 caracteres."),
  consumer_email: z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Ingresa un correo válido."),
  is_minor: z.boolean(),
  guardian_name: z.string().trim(),
  guardian_document_type: z.enum(["DNI", "CE", "PASAPORTE"]),
  guardian_document_number: z.string().trim().max(20, "Máximo 20 caracteres."),
  item_type: z.enum(["producto", "servicio"]),
  claimed_amount: z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/, "Ingresa un monto válido, por ejemplo 15.00."),
  item_description: required("Describe el producto o servicio."),
  kind: z.enum(["reclamo", "queja"]),
  detail: required("Describe lo ocurrido.").max(3000, "Máximo 3000 caracteres."),
  consumer_request: required("Indica tu pedido.").max(2000, "Máximo 2000 caracteres."),
  accepted_terms: z.boolean().refine((value) => value, "Debes aceptar la declaración para continuar."),
}).superRefine((value, context) => {
  if (!value.is_minor) return;
  if (!value.guardian_name) context.addIssue({ code: "custom", path: ["guardian_name"], message: "Ingresa el nombre del padre, madre o apoderado." });
  if (!value.guardian_document_number) context.addIssue({ code: "custom", path: ["guardian_document_number"], message: "Ingresa su número de documento." });
});
type Values = z.infer<typeof schema>;

function toComplaintData(values: Values): ComplaintData {
  return {
    consumer_name: values.consumer_name,
    consumer_document_type: values.consumer_document_type,
    consumer_document_number: values.consumer_document_number,
    consumer_address: values.consumer_address,
    consumer_department: values.consumer_department,
    consumer_province: values.consumer_province,
    consumer_district: values.consumer_district,
    consumer_phone: values.consumer_phone || null,
    consumer_email: values.consumer_email,
    is_minor: values.is_minor,
    guardian_name: values.is_minor ? values.guardian_name : null,
    guardian_document_type: values.is_minor ? values.guardian_document_type : null,
    guardian_document_number: values.is_minor ? values.guardian_document_number : null,
    item_type: values.item_type,
    item_description: values.item_description,
    claimed_amount: values.claimed_amount ? Number(values.claimed_amount) : null,
    kind: values.kind,
    detail: values.detail,
    consumer_request: values.consumer_request,
  };
}

function Rows({ rows }: { rows: Array<[string, string]> }) {
  return <dl className="grid gap-2 text-sm">{rows.map(([label, value]) => <div key={label} className="grid gap-1 sm:grid-cols-[11rem_1fr]"><dt className="font-semibold text-slate-700">{label}</dt><dd className="whitespace-pre-wrap text-slate-600">{value}</dd></div>)}</dl>;
}

// Campo sin etiqueta visible: el texto va como placeholder y como aria-label para lectores de pantalla.
function Field({ error, children }: { error?: string; children: ReactNode }) {
  return <div className="grid content-start gap-1.5">{children}{error && <span className="text-xs text-rose-600">{error}</span>}</div>;
}
const hint = (label: string, placeholder = label) => ({ "aria-label": label, placeholder });

const KIND_HINTS = {
  reclamo: "Disconformidad relacionada con los productos o servicios.",
  queja: "Malestar o descontento respecto a la atención.",
} as const;

const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(/.0$/, "")} MB`;

function EvidencePicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const [error, setError] = useState("");
  const add = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.some((file) => !file.type.startsWith("image/") && file.type !== "application/pdf")) return setError("Solo se aceptan imágenes o archivos PDF.");
    const next = [...files, ...picked];
    if (next.reduce((total, file) => total + file.size, 0) > EVIDENCE_MAX_BYTES) return setError(`Los archivos superan los ${formatSize(EVIDENCE_MAX_BYTES)} permitidos en total.`);
    setError("");
    onChange(next);
  };
  return <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
    <p className="font-medium text-slate-700">Adjuntar evidencia (opcional · imagen o PDF, máx. {formatSize(EVIDENCE_MAX_BYTES)} en total)</p>
    <div className="flex flex-wrap items-center gap-3">
      <label className="cursor-pointer rounded-lg px-3 py-1.5 font-semibold text-indigo-600 hover:bg-indigo-50">
        Seleccionar archivo
        <input type="file" multiple accept="image/*,application/pdf" className="sr-only" onChange={add} />
      </label>
      {!files.length && <span className="text-slate-500">Sin archivos seleccionados</span>}
    </div>
    {files.length > 0 && <ul className="grid gap-1.5">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-slate-700">
      <span className="truncate">{file.name} <span className="text-xs text-slate-500">({formatSize(file.size)})</span></span>
      <button type="button" aria-label={`Quitar ${file.name}`} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-rose-600" onClick={() => onChange(files.filter((_, i) => i !== index))}><X size={16} /></button>
    </li>)}</ul>}
    {error && <span className="text-xs text-rose-600">{error}</span>}
  </div>;
}

function SectionTitle({ number, className, children }: { number: number; className?: string; children: string }) {
  return <h2 className={clsx("mt-8 flex items-center gap-3 border-b border-slate-200 pb-2 text-base font-bold text-slate-950", className)}><span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-sm text-white">{number}</span>{children}</h2>;
}

function TestModeSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
    <span className={clsx("relative h-6 w-11 rounded-full transition", checked ? "bg-amber-500" : "bg-slate-300")}><span className={clsx("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition", checked && "translate-x-5")} /></span>
    Modo prueba
  </button>;
}

function Receipt({ record }: { record: ComplaintRecord }) {
  const [error, setError] = useState("");
  const download = () => downloadComplaintPdf(record).catch(() => setError("No se pudo generar el PDF. Inténtalo de nuevo."));
  return <Card className="p-6 sm:p-8">
    {isTestSheet(record) && <div className="mb-3"><Alert>Hoja de prueba: no tiene número correlativo y no cuenta como reclamo real.</Alert></div>}
    <Alert tone="success">Tu {record.data.kind} fue registrado. Enviamos una copia de la hoja a {record.data.consumer_email}; también puedes descargarla aquí. Guárdala: la necesitarás si nos contactas por este caso.</Alert>
    <h1 className="mt-6 text-2xl font-bold text-slate-950">Hoja de reclamación N.° {sheetLabel(record)}</h1>
    <Button type="button" className="mt-4" onClick={() => void download()}><Download size={16} className="mr-2" />Descargar copia (PDF)</Button>
    {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
    {complaintSections(record).map((section) => <section key={section.title} className="mt-6">
      <h2 className="mb-3 border-b border-slate-200 pb-2 text-base font-bold text-slate-950">{section.title}</h2>
      <Rows rows={section.rows} />
    </section>)}
  </Card>;
}

export function ComplaintsBookPage() {
  const [error, setError] = useState("");
  const [record, setRecord] = useState<ComplaintRecord | null>(null);
  // Si el envío falla, el reintento conserva el mismo correlativo para no dejar huecos.
  const [assigned, setAssigned] = useState<AssignedComplaintNumber | null>(null);
  // El modo prueba solo se ofrece al abrir la página con ?prueba, para que el público no lo vea.
  const [searchParams] = useSearchParams();
  const testModeAvailable = searchParams.has("prueba");
  const [testModeOn, setTestMode] = useState(false);
  const testMode = testModeAvailable && testModeOn;
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      consumer_document_type: "DNI", guardian_document_type: "DNI", is_minor: false, accepted_terms: false, item_type: "servicio", kind: "reclamo",
      item_description: "", consumer_name: "", consumer_document_number: "", consumer_address: "", consumer_department: "", consumer_province: "", consumer_district: "", consumer_phone: "",
      consumer_email: "", guardian_name: "", guardian_document_number: "", claimed_amount: "", detail: "", consumer_request: "",
    },
  });
  const isMinor = useWatch({ control, name: "is_minor" });
  const kind = useWatch({ control, name: "kind" });
  const [evidence, setEvidence] = useState<File[]>([]);
  const submit = handleSubmit(async (values) => {
    try {
      setError("");
      const data = toComplaintData(values);
      let next: ComplaintRecord;
      if (testMode) {
        // Las hojas de prueba no piden número al servidor, así que no afectan la numeración.
        next = { sheetNumber: null, createdAt: new Date().toISOString(), data };
      } else {
        const number = assigned ?? await assignComplaintNumber();
        setAssigned(number);
        next = { sheetNumber: number.sheet_number, createdAt: number.submitted_at, data };
      }
      await sendComplaint(next, await complaintPdfBlob(next), complaintPdfFilename(next), evidence);
      setRecord(next);
      window.scrollTo({ top: 0 });
    } catch (reason) { setError((await normalizeError(reason)).message); }
  });
  const radio = "inline-flex items-center gap-2 text-slate-800";
  const radioInput = "h-4 w-4 accent-indigo-600";

  return <PublicPage>
    <section className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 flex items-center justify-center gap-4"><ComplaintsBookIcon className="h-14" /><div><h1 className="text-3xl font-bold">Libro de reclamaciones</h1><p className="mt-1 text-sm text-slate-300">Conforme al Código de Protección y Defensa del Consumidor.</p></div></div>
      {record ? <Receipt record={record} /> : <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">Hoja de reclamación virtual</h2>
          {testModeAvailable && <TestModeSwitch checked={testMode} onChange={setTestMode} />}
        </div>
        {testMode && <div className="mt-4"><Alert>Modo prueba activado: la hoja se enviará marcada como PRUEBA y sin número correlativo. No cuenta como un reclamo real.</Alert></div>}
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <SectionTitle number={1}>Identificación del consumidor reclamante</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-[7rem_1fr] gap-2">
              <Field><Select {...hint("Tipo de documento")} {...register("consumer_document_type")}>{DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
              <Field error={errors.consumer_document_number?.message}><Input {...hint("Número de documento", "Nro. de documento")} {...register("consumer_document_number")} /></Field>
            </div>
            <Field error={errors.consumer_name?.message}><Input autoComplete="name" {...hint("Nombre completo")} {...register("consumer_name")} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field error={errors.consumer_email?.message}><Input type="email" autoComplete="email" {...hint("Correo electrónico")} {...register("consumer_email")} /></Field>
            <Field error={errors.consumer_phone?.message}><Input type="tel" autoComplete="tel" {...hint("Teléfono (opcional)", "Teléfono / Celular (opcional)")} {...register("consumer_phone")} /></Field>
          </div>
          <Field error={errors.consumer_address?.message}><Input autoComplete="street-address" {...hint("Domicilio", "Dirección domiciliaria")} {...register("consumer_address")} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field error={errors.consumer_department?.message}><Input autoComplete="address-level1" {...hint("Departamento")} {...register("consumer_department")} /></Field>
            <Field error={errors.consumer_province?.message}><Input autoComplete="address-level2" {...hint("Provincia")} {...register("consumer_province")} /></Field>
            <Field error={errors.consumer_district?.message}><Input autoComplete="address-level3" {...hint("Distrito")} {...register("consumer_district")} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" className="h-4 w-4 accent-indigo-600" {...register("is_minor")} />Soy menor de edad</label>
          {isMinor && <div className="grid gap-4 rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Datos del padre, madre o apoderado</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <Field><Select {...hint("Tipo de documento")} {...register("guardian_document_type")}>{DOCUMENT_TYPES.filter((item) => item.value !== "RUC").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
                <Field error={errors.guardian_document_number?.message}><Input {...hint("Número de documento", "Nro. de documento")} {...register("guardian_document_number")} /></Field>
              </div>
              <Field error={errors.guardian_name?.message}><Input {...hint("Nombre completo")} {...register("guardian_name")} /></Field>
            </div>
          </div>}

          <SectionTitle number={2}>Identificación del bien contratado</SectionTitle>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium text-slate-700">Bien contratado</legend>
            <div className="flex flex-wrap gap-6">
              <label className={radio}><input type="radio" value="producto" className={radioInput} {...register("item_type")} />Producto</label>
              <label className={radio}><input type="radio" value="servicio" className={radioInput} {...register("item_type")} />Servicio</label>
            </div>
          </fieldset>
          <Field error={errors.item_description?.message}><Textarea rows={2} {...hint("Descripción", "Descripción del producto o servicio contratado")} {...register("item_description")} /></Field>
          <Field error={errors.claimed_amount?.message}><Input inputMode="decimal" {...hint("Monto (S/, opcional)", "Monto reclamado en S/ (opcional)")} {...register("claimed_amount")} /></Field>

          <SectionTitle number={3}>Detalle de la reclamación</SectionTitle>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium text-slate-700">Tipo</legend>
            <div className="flex flex-wrap gap-6">
              <label className={radio}><input type="radio" value="reclamo" className={radioInput} {...register("kind")} />Reclamo</label>
              <label className={radio}><input type="radio" value="queja" className={radioInput} {...register("kind")} />Queja</label>
            </div>
            <p className="text-xs text-slate-500">{KIND_HINTS[kind]}</p>
          </fieldset>
          <Field error={errors.detail?.message}><Textarea rows={5} {...hint("Detalle", "Detalle del reclamo o queja…")} {...register("detail")} /></Field>
          <Field error={errors.consumer_request?.message}><Textarea rows={3} {...hint("Pedido", "¿Qué solución esperas? (Pedido del consumidor)")} {...register("consumer_request")} /></Field>
          <EvidencePicker files={evidence} onChange={setEvidence} />

          <label className="mt-2 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" {...register("accepted_terms")} />Declaro que la información consignada es veraz y acepto ser notificado en el correo electrónico brindado.</label>
          {errors.accepted_terms && <span className="text-xs text-rose-600">{errors.accepted_terms.message}</span>}
          {error && <Alert tone="error">{error}</Alert>}
          <Button disabled={isSubmitting}>{isSubmitting ? "Enviando…" : "Enviar"}</Button>
        </form>
      </Card>}
    </section>
  </PublicPage>;
}
