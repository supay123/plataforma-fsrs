export interface CreateInvitationBody {
  email?: unknown;
  /** Grupo fijado por el administrador; si falta, el estudiante lo elige. */
  teacher_id?: unknown;
  /** Solo por compatibilidad con clientes antiguos que elegían institución. */
  college_id?: unknown;
  access_valid_from?: unknown;
  access_valid_until?: unknown;
}

export interface ResendInvitationBody {
  invitation_id?: unknown;
}
