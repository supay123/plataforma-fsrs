import { TABLES } from "../_shared/database.constants.ts";
import { AppError } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";

export interface PendingRegistration {
  id: string;
  email: string;
  given_names: string;
  email_code_hash: string | null;
  email_code_expires_at: string | null;
  email_code_sent_at: string | null;
  email_code_send_count: number;
  email_code_failed_attempts: number;
  email_verified_at: string | null;
  expires_at: string;
}

const PENDING_COLUMNS =
  "id,email,given_names,email_code_hash,email_code_expires_at,email_code_sent_at,email_code_send_count,email_code_failed_attempts,email_verified_at,expires_at";

/** Registro pendiente vigente; si venció, el usuario debe empezar de nuevo. */
export async function findPending(
  context: EdgeContext,
  registrationId: string,
): Promise<PendingRegistration> {
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.studentRegistrations)
    .select(PENDING_COLUMNS)
    .eq("id", registrationId)
    .maybeSingle();
  if (error) {
    throw new AppError(500, "registration_lookup_failed", error.message);
  }
  if (!data || new Date(data.expires_at) <= new Date()) {
    throw new AppError(
      404,
      "registration_expired",
      "The registration expired. Start again.",
    );
  }
  return data as PendingRegistration;
}
