import type { AppProfile, AppRole, EdgeContext } from "./types.ts";
import { TABLES } from "./database.constants.ts";
import type { Json } from "./database.types.ts";
import { AppError } from "./errors.ts";
import { isWithinDateRange, limaDate } from "./validation.ts";

export async function requireProfile(
  context: EdgeContext,
  allowedRoles?: AppRole[],
  requireValidStudentAccess = false,
): Promise<AppProfile> {
  const userId = context.userClaims?.id;
  if (!userId) {
    throw new AppError(401, "unauthorized", "Authentication is required.");
  }

  const { data, error } = await context.supabaseAdmin
    .from(TABLES.profiles)
    .select(
      "id,college_id,role,user_code,full_name,is_active,access_valid_from,access_valid_until",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new AppError(500, "profile_lookup_failed", error.message);
  if (!data || !data.is_active) {
    throw new AppError(403, "inactive_user", "The user account is inactive.");
  }

  const profile = data as AppProfile;
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    throw new AppError(
      403,
      "forbidden",
      "The user does not have permission for this operation.",
    );
  }

  if (
    requireValidStudentAccess &&
    profile.role === "student" &&
    !isWithinDateRange(
      limaDate(),
      profile.access_valid_from,
      profile.access_valid_until,
    )
  ) {
    throw new AppError(
      403,
      "student_access_expired",
      "Student access is outside its validity period.",
    );
  }

  return profile;
}

export async function writeAudit(
  context: EdgeContext,
  profile: AppProfile,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, Json | undefined> = {},
): Promise<void> {
  const { error } = await context.supabaseAdmin.from(TABLES.auditLogs).insert({
    actor_user_id: profile.id,
    college_id: profile.college_id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
  if (error) console.error("Audit log insert failed", error);
}
