import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Field, Input } from "../../components/ui";
import { ModalForm } from "../../components/ui/modal-form";
import { useToast } from "../../components/ui/use-toast";
import { registerFreeModeLead } from "./api";
import { leadSchema, type LeadValues } from "./lead-fields";

/** Modal de registro del modo gratuito (obligatorio: no se cierra sin registrarse): nombres, apellidos, correo, WhatsApp y consentimiento. */
export function LeadModal({ onRegistered }: { onRegistered: (givenNames: string) => void }) {
  const toast = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<LeadValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: { given_names: "", family_names: "", email: "", phone: "", accepted_data_policy: false, website: "" },
  });
  const save = useMutation({
    mutationFn: registerFreeModeLead,
    onSuccess: (_result, lead) => onRegistered(lead.given_names),
    onError: (error) => toast.error(error.message),
  });

  return <ModalForm title="Déjanos tus datos" confirmLabel="Continuar" pendingLabel="Guardando…" pending={save.isPending} dismissible={false} onSubmit={() => void handleSubmit((values) => save.mutate(values))()}>
    <p className="text-sm text-slate-600 dark:text-slate-300">Te contactaremos por correo o WhatsApp con información de nuestros planes. Solo usaremos tus datos para eso y puedes retirar tu consentimiento cuando quieras.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombres" error={errors.given_names?.message}><Input autoComplete="given-name" {...register("given_names")} /></Field>
      <Field label="Apellidos" error={errors.family_names?.message}><Input autoComplete="family-name" {...register("family_names")} /></Field>
    </div>
    <Field label="Correo electrónico" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
    <Field label="WhatsApp" hint="Celular de 9 dígitos, por ejemplo 987654321." error={errors.phone?.message}><Input type="tel" inputMode="tel" autoComplete="tel-national" {...register("phone")} /></Field>
    {/* Campo trampa: fuera de pantalla y fuera del orden de tabulación; solo los bots lo llenan. */}
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>No llenar este campo<input type="text" tabIndex={-1} autoComplete="off" {...register("website")} /></label>
    </div>
    <div>
      <label className="flex items-start gap-2 text-left text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-emerald-500" {...register("accepted_data_policy")} />
        <span>Acepto recibir ofertas y promociones de Chancón. Ver <Link to="/privacidad" target="_blank" className="font-semibold underline underline-offset-2">Política de privacidad</Link>.</span>
      </label>
      {errors.accepted_data_policy && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.accepted_data_policy.message}</p>}
    </div>
  </ModalForm>;
}
