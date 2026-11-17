import { invokeFunction } from "../../lib/api/functions";
import type { DocumentType } from "../complaints/model";

export interface Invitation {
  id: string;
  email: string;
  college_id: string | null;
  college_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  access_valid_from: string;
  access_valid_until: string;
  expires_at: string;
  created_at: string;
}
export interface CreateInvitationBody {
  email: string;
  /** Grupo fijado por el administrador; si falta, el estudiante lo elige. */
  teacher_id?: string;
  access_valid_from: string;
  access_valid_until: string;
}
/** Datos fijos que ve el estudiante al abrir el link. */
export interface StudentInvitation {
  email: string;
  teacher_id: string | null;
  teacher_name: string | null;
  college_id: string | null;
  college_name: string | null;
  access_valid_from: string;
  access_valid_until: string;
  expires_at: string;
}
export interface AcceptInvitationBody {
  code: string;
  /** Solo hace falta si la invitación no trae un grupo fijo. */
  teacher_id?: string;
  given_names: string;
  family_names: string;
  phone: string;
  identity_document_type: DocumentType;
  identity_document_number: string;
  password: string;
  accepted_terms: boolean;
}

export const invitationsQueryKey = ["invitations"] as const;

/** GET /invitations: invitaciones sin aceptar (solo administradores). */
export async function listInvitations() {
  const { invitations } = await invokeFunction<{ invitations: Invitation[] }, Record<string, never>>("invitations", {}, { method: "GET" });
  return invitations;
}

/** POST /invitations: invita a un estudiante por correo. */
export async function createInvitation(body: CreateInvitationBody) {
  const { invitation } = await invokeFunction<{ invitation: Invitation }, CreateInvitationBody>("invitations", body);
  return invitation;
}

/** POST /invitations/resend: reenvía la invitación con un link nuevo. */
export async function resendInvitation(invitationId: string) {
  const { invitation } = await invokeFunction<{ invitation: Invitation }, { invitation_id: string }>("invitations/resend", { invitation_id: invitationId });
  return invitation;
}

/** DELETE /invitations?id=...: anula la invitación. */
export function cancelInvitation(invitationId: string) {
  return invokeFunction<{ invitation_id: string }, Record<string, never>>(`invitations?id=${encodeURIComponent(invitationId)}`, {}, { method: "DELETE" });
}

/** GET /student-invitation?code=...: datos de la invitación del link. */
export async function checkStudentInvitation(code: string) {
  const { invitation } = await invokeFunction<{ invitation: StudentInvitation }, Record<string, never>>(
    `student-invitation?code=${encodeURIComponent(code)}`, {}, { method: "GET" },
  );
  return invitation;
}

/** POST /student-invitation: el estudiante completa sus datos y crea su cuenta. */
export function acceptStudentInvitation(body: AcceptInvitationBody) {
  return invokeFunction<{ status: "accepted" }, AcceptInvitationBody>("student-invitation", body);
}
