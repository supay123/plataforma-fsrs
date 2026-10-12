export interface CreateInvitationBody {
  email?: unknown;
  college_id?: unknown;
  access_valid_from?: unknown;
  access_valid_until?: unknown;
}

export interface ResendInvitationBody {
  invitation_id?: unknown;
}
