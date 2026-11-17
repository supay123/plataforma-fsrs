import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { RPCS } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { createInvitation } from "../_shared/invitations.ts";
import { parseEmail } from "../_shared/registration.ts";
import type { EdgeContext } from "../_shared/types.ts";
import {
  assertDateOrder,
  date,
  limaDate,
  optionalUuid,
} from "../_shared/validation.ts";
import type { CreateInvitationBody } from "./interfaces.ts";

/**
 * POST /invitations
 * Invita a un estudiante: guarda correo, periodo de acceso y, opcionalmente, el
 * grupo (profesor). Si no hay grupo, el estudiante lo elige al aceptar. Invitar
 * otra vez al mismo correo reemplaza la invitación anterior.
 */
export async function createInvitationHandler(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const admin = await requireProfile(context, ["admin"]);
  const body = await readJson<CreateInvitationBody>(request);
  const email = parseEmail(body.email);
  // college_id solo se acepta de clientes antiguos que elegían institución.
  const teacherId = optionalUuid(body.teacher_id, "teacher_id");
  const collegeId = optionalUuid(body.college_id, "college_id");
  const accessValidFrom = date(body.access_valid_from, "access_valid_from");
  const accessValidUntil = date(body.access_valid_until, "access_valid_until");
  assertDateOrder(accessValidFrom, accessValidUntil);
  if (accessValidUntil < limaDate()) {
    throw new AppError(
      400,
      "validation_error",
      "access_valid_until cannot be in the past.",
      { field: "access_valid_until" },
    );
  }

  const { data: inUse, error: inUseError } = await context.supabaseAdmin.rpc(
    RPCS.emailInUse,
    { p_email: email },
  );
  if (inUseError) {
    throw new AppError(500, "email_lookup_failed", inUseError.message);
  }
  if (inUse) {
    throw new AppError(
      409,
      "email_taken",
      "The email already has an account.",
      {
        field: "email",
      },
    );
  }

  const invitation = await createInvitation(request, context, {
    email,
    teacher_id: teacherId ?? null,
    college_id: collegeId ?? null,
    access_valid_from: accessValidFrom,
    access_valid_until: accessValidUntil,
  }, admin.id);
  await writeAudit(
    context,
    admin,
    "invitation.created",
    "student_invitation",
    invitation.id,
  );
  return json({ invitation }, 201);
}
