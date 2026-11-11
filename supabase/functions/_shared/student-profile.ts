import { TABLES } from "./database.constants.ts";
import type { Tables } from "./database.types.ts";
import { AppError } from "./errors.ts";
import type { EdgeContext } from "./types.ts";

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
  & { college_name: string | null; group_name: string | null };

export async function loadStudentProfile(
  context: EdgeContext,
  userId: string,
): Promise<StudentProfile> {
  const [profileResult, groupName] = await Promise.all([
    context.supabaseAdmin
      .from(TABLES.profiles)
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .single(),
    loadGroupName(context, userId),
  ]);
  const { data, error } = profileResult;
  if (error) throw new AppError(500, "profile_lookup_failed", error.message);
  const { college, ...profile } = data;
  return {
    ...profile,
    college_name: college?.name ?? null,
    group_name: groupName,
  };
}

/**
 * El grupo del estudiante es el profesor de sus cursos activos. Si tiene cursos
 * de varios profesores, se listan todos.
 */
async function loadGroupName(
  context: EdgeContext,
  userId: string,
): Promise<string | null> {
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.courseEnrollments)
    .select(
      "course:courses!inner(teacher:profiles!courses_teacher_id_fkey(full_name))",
    )
    .eq("student_id", userId)
    .eq("status", "active");
  if (error) throw new AppError(500, "group_lookup_failed", error.message);
  const names = new Set(
    data.map((row) => row.course?.teacher?.full_name).filter((name) =>
      Boolean(name)
    ) as string[],
  );
  return names.size ? [...names].sort().join(", ") : null;
}
