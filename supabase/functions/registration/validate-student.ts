import bcrypt from "bcryptjs";
import { RPCS } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import {
  maskEmail,
  parseStudentRegistration,
} from "../_shared/registration.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { uuid } from "../_shared/validation.ts";
import type { ValidateStudentBody } from "./interfaces.ts";

const BCRYPT_COST = 10;

/**
 * POST /registration/student/validate
 * Valida los datos del estudiante y guarda el registro pendiente. No envía el
 * código de verificación: eso lo hace POST /registration/request-code.
 */
export async function validateStudent(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<ValidateStudentBody>(request);
  const input = parseStudentRegistration(body as Record<string, unknown>);

  // La base valida el profesor (grupo) y toma de él la institución.
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const { data: registrationId, error } = await context.supabaseAdmin.rpc(
    RPCS.createStudentRegistration,
    {
      p_teacher_id: input.teacher_id,
      p_given_names: input.given_names,
      p_family_names: input.family_names,
      p_email: input.email,
      p_phone: input.phone,
      p_identity_document_type: input.identity_document_type,
      p_identity_document_number: input.identity_document_number,
      p_password_hash: passwordHash,
      // Al volver a corregir los datos se libera el registro anterior.
      p_replaces_registration_id: body.replaces_registration_id === undefined
        ? undefined
        : uuid(body.replaces_registration_id, "replaces_registration_id"),
    },
  );
  if (error) {
    if (error.message === "invalid_teacher") {
      throw new AppError(400, "invalid_teacher", "Select a group.", {
        field: "teacher_id",
      });
    }
    if (error.message === "email_taken") {
      throw new AppError(
        409,
        "email_taken",
        "The email already has an account.",
        { field: "email" },
      );
    }
    if (error.message === "registration_conflict") {
      throw new AppError(
        409,
        "registration_conflict",
        "Another registration with this email is in progress.",
        { field: "email" },
      );
    }
    throw new AppError(500, "registration_failed", error.message);
  }

  return json(
    { registration_id: registrationId, email: maskEmail(input.email) },
    201,
  );
}
