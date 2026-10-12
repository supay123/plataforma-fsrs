import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Badge, Button, Card } from "../../components/ui";
import { useToast } from "../../components/ui/use-toast";
import { findPlan, formatSoles } from "../../config/business";
import { normalizeError } from "../../lib/api/errors";
import { formatDate } from "../../lib/dates";
import { listPaymentsToReview, resolvePayment } from "./api";

const queryKey = ["payments-to-review"];

/**
 * Pagos confirmados por Kuti que no se pudieron aplicar porque ya no existía
 * el registro ni la cuenta. El administrador los resuelve (activando a mano o
 * devolviendo el dinero desde el panel de Kuti) y los marca como resueltos.
 * Solo aparece cuando hay alguno.
 */
export function PaymentsToReview() {
  const toast = useToast();
  const client = useQueryClient();
  const payments = useQuery({ queryKey, queryFn: listPaymentsToReview });
  const resolve = useMutation({ mutationFn: resolvePayment, onSuccess: () => client.invalidateQueries({ queryKey }) });

  useEffect(() => {
    if (payments.error) toast.error("No se pudieron cargar los pagos por revisar. Recarga la página.");
  }, [payments.error, toast]);

  if (!payments.data?.length) return null;
  return <Card>
    <h2 className="font-bold">Pagos por revisar</h2>
    <p className="mt-1 text-sm text-slate-600">Kuti confirmó estos pagos, pero ya no existía el registro ni la cuenta. Activa la cuenta a mano o devuelve el dinero desde el panel de Kuti.</p>
    <ul className="mt-4 grid gap-3">{payments.data.map((payment) => <li key={payment.id} className="rounded-xl border border-slate-200 p-3 text-sm">
      <p className="flex flex-wrap items-center justify-between gap-2"><strong>{payment.email ?? "Sin correo"}</strong>{!payment.livemode && <Badge>Prueba</Badge>}</p>
      <p className="text-slate-600">{findPlan(payment.plan).name} · {formatSoles(payment.amount)} · {formatDate(payment.paid_at)}</p>
      <p className="break-all text-xs text-slate-500">Cobro en Kuti: {payment.kuti_payment_intent_id}</p>
      <Button variant="secondary" className="mt-2" disabled={resolve.isPending} onClick={() => resolve.mutate(payment.id, { onError: async (reason) => toast.error((await normalizeError(reason)).message) })}>Marcar como resuelto</Button>
    </li>)}</ul>
  </Card>;
}
