import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";

/**
 * DELETE /invitations?id=...
 * Anula una invitación: se borra y su link deja de servir.
 */
export async function cancelInvitationHandler(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const admin = await requireProfile(context, ["admin"]);
  const invitationId = uuid(new URL(request.url).searchParams.get("id"), "id");
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.studentInvitations)
    .delete()
    .eq("id", invitationId)
    .select("id")
    .maybeSingle();
  if (error) throw new AppError(500, "invitation_failed", error.message);
  if (!data) {
    throw new AppError(404, "invitation_not_found", "Invitation not found.");
  }
  await writeAudit(
    context,
    admin,
    "invitation.cancelled",
    "student_invitation",
    invitationId,
  );
  return json({ invitation_id: invitationId });
}
