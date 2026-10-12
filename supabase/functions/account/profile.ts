import { TABLES } from "../_shared/database.constants.ts";
import type { Tables } from "../_shared/database.types.ts";
import { AppError } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";

const PROFILE_COLUMNS =
  "given_names,family_names,email,phone,identity_document_type,identity_document_number,college_id,college:colleges(name)";

export type StudentProfile =
  & Pick<
    Tables<"profiles">,
    | "given_names"
    | "family_names"
    | "email"
    | "phone"
    | "identity_document_type"
    | "identity_document_number"
    | "college_id"
  >
  & { college_name: string | null };

export async function loadStudentProfile(
  context: EdgeContext,
  userId: string,
): Promise<StudentProfile> {
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .single();
  if (error) throw new AppError(500, "profile_lookup_failed", error.message);
  const { college, ...profile } = data;
  return { ...profile, college_name: college?.name ?? null };
}
