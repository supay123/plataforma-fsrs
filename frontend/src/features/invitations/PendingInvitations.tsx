import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Badge, Button, Card, EmptyState } from "../../components/ui";
import { Skeleton } from "../../components/ui/skeleton";
import { useModal } from "../../components/ui/use-modal";
import { useToast } from "../../components/ui/use-toast";
import { normalizeError } from "../../lib/api/errors";
import { formatDate, formatDay } from "../../lib/dates";
import { cancelInvitation, invitationsQueryKey, listInvitations, resendInvitation, type Invitation } from "./api";

/** Grupo fijo de la invitación o, si el estudiante lo elige, la institución que limita su elección. */
function groupLabel(invitation: Invitation) {
  if (invitation.teacher_name) {
    return invitation.college_name ? `${invitation.teacher_name} · ${invitation.college_name}` : invitation.teacher_name;
  }
  return invitation.college_name ? `El estudiante elegirá su grupo · ${invitation.college_name}` : "El estudiante elegirá su grupo";
}

/** Invitaciones que el estudiante todavía no acepta, para reenviarlas o anularlas. */
export function PendingInvitations() {
  const toast = useToast();
  const modal = useModal();
  const client = useQueryClient();
  const invitations = useQuery({ queryKey: invitationsQueryKey, queryFn: listInvitations });
  const refresh = () => client.invalidateQueries({ queryKey: invitationsQueryKey });
  const resend = useMutation({ mutationFn: resendInvitation });
  const cancel = useMutation({ mutationFn: cancelInvitation });

  useEffect(() => {
    if (invitations.error) toast.error("No se pudieron cargar las invitaciones. Recarga la página.");
  }, [invitations.error, toast]);

  const resendTo = async (invitation: Invitation) => {
    try {
      await resend.mutateAsync(invitation.id);
      toast.success(`Reenviamos la invitación a ${invitation.email}.`);
      void refresh();
    } catch (reason) { toast.error((await normalizeError(reason)).message); }
  };
  const confirmCancel = (invitation: Invitation) => modal.delete({
    title: "Anular invitación",
    confirmLabel: "Anular",
    body: <p>El link que enviamos a <strong>{invitation.email}</strong> dejará de funcionar.</p>,
    onConfirm: async () => {
      try {
        await cancel.mutateAsync(invitation.id);
        toast.success(`Anulamos la invitación de ${invitation.email}.`);
        void refresh();
      } catch (reason) {
        toast.error((await normalizeError(reason)).message);
        throw reason;
      }
    },
  });

  return <Card>
    <h2 className="mb-4 font-bold">Invitaciones pendientes</h2>
    {invitations.isPending
      ? <div role="status" aria-busy="true" aria-label="Cargando invitaciones" className="grid gap-3">{[0, 1].map((item) => <Skeleton key={item} height={72} rounded="none" />)}</div>
      : !invitations.data?.length
      ? <EmptyState>No hay invitaciones pendientes.</EmptyState>
      : <ul className="grid gap-3">{invitations.data.map((invitation) => {
        const expired = new Date(invitation.expires_at) <= new Date();
        return <li key={invitation.id} className="grid gap-2 border border-line p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <strong className="break-all text-fg-strong">{invitation.email}</strong>
            <Badge tone={expired ? "warning" : "success"}>{expired ? "Vencida" : "Pendiente"}</Badge>
          </div>
          <p className="text-fg-muted">{groupLabel(invitation)} · Acceso del {formatDay(invitation.access_valid_from)} al {formatDay(invitation.access_valid_until)}</p>
          <p className="text-xs text-fg-muted">{expired ? "El link venció" : "El link vence"} el {formatDate(invitation.expires_at)}.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={resend.isPending} onClick={() => void resendTo(invitation)}>Reenviar</Button>
            <Button type="button" variant="danger" disabled={cancel.isPending} onClick={() => confirmCancel(invitation)}>Anular</Button>
          </div>
        </li>;
      })}</ul>}
  </Card>;
}
