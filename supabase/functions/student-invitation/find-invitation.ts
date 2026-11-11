import { TABLES } from "../_shared/database.constants.ts";
import { AppError } from "../_shared/errors.ts";
import { invalidInvitation } from "../_shared/invitations.ts";
import { hashLinkCode, isLinkCodeFormat } from "../_shared/link-code.ts";
import type { EdgeContext } from "../_shared/types.ts";

export interface ValidInvitation {
  id: string;
  email: string;
  college_id: string | null;
  college_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  access_valid_from: string;
  access_valid_until: string;
  expires_at: string;
  invited_by: string | null;
}

/** Invitación vigente del código del link; si no existe o venció, 404. */
export async function findValidInvitation(
  context: EdgeContext,
  code: unknown,
): Promise<ValidInvitation> {
  if (!isLinkCodeFormat(code)) throw invalidInvitation();
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.studentInvitations)
    .select(
      "id,email,college_id,teacher_id,access_valid_from,access_valid_until,expires_at,invited_by,college:colleges(name),teacher:profiles!student_invitations_teacher_id_fkey(full_name)",
    )
    .eq("code_hash", await hashLinkCode(code))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new AppError(500, "invitation_lookup_failed", error.message);
  if (!data) throw invalidInvitation();
  const { college, teacher, ...invitation } = data;
  return {
    ...invitation,
    college_name: college?.name ?? null,
    teacher_name: teacher?.full_name ?? null,
  };
}
