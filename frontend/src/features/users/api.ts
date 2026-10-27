import { invokeFunction } from "../../lib/api/functions";
import { supabase } from "../../lib/supabase/client";
import type { AppRole, UserMutationResponse } from "../../types/contracts";
import type { AccountProfile, PasswordResetDelivery, UpdateAccountProfileBody } from "../account/api";
export async function listUsers() { const { data, error } = await supabase.from("profiles").select("id,college_id,role,user_code,full_name,is_active,access_valid_from,access_valid_until,created_by,created_at,updated_at,security_question").in("role", ["teacher", "student"]).order("full_name"); if (error) throw error; return data; }
export async function createUser(body: { role: "teacher" | "student"; user_code: string; full_name: string; college_id: string; password?: string; access_valid_from?: string; access_valid_until?: string }) { return invokeFunction<UserMutationResponse, typeof body>("admin-create-user", body); }
export async function updateUser(body: { user_id: string; user_code?: string; full_name?: string; college_id?: string; is_active?: boolean }) { return invokeFunction<UserMutationResponse, typeof body>("admin-update-user", body); }
export async function deleteUser(userId: string) { return invokeFunction<{ user_id: string }, { user_id: string }>("admin-delete-user", { user_id: userId }); }
export async function resetCredentials(body: { user_id: string; user_code?: string; password?: string }) { return invokeFunction<UserMutationResponse, typeof body>("admin-reset-user-credentials", body); }
export async function renewAccess(body: { user_id: string; access_valid_from: string; access_valid_until: string; reactivate?: boolean }) { return invokeFunction<UserMutationResponse, typeof body>("admin-renew-access", body); }
export const roleLabel = (role: AppRole) => ({ admin: "Administrador", teacher: "Profesor", student: "Estudiante" })[role];

/** Perfil del estudiante visto por el admin: el mismo que ve él, más los profesores de su grupo actual. */
export type AdminStudentProfile = AccountProfile & { group_teacher_ids: string[] };
/** GET /admin-student-account/profile: el perfil del estudiante, igual al que ve él. */
export async function getStudentProfile(userId: string) {
  const { profile } = await invokeFunction<{ profile: AdminStudentProfile }, Record<string, never>>(
    `admin-student-account/profile?user_id=${encodeURIComponent(userId)}`, {}, { method: "GET" },
  );
  return profile;
}
/** PUT /admin-student-account/profile: guarda los datos editables (el correo lo cambia el estudiante). */
export async function updateStudentProfile(body: UpdateAccountProfileBody & { user_id: string }) {
  const { profile } = await invokeFunction<{ profile: AccountProfile }, typeof body>("admin-student-account/profile", body, { method: "PUT" });
  return profile;
}
/** PUT /admin-student-account/email: cambia el correo sin verificación, también para iniciar sesión. */
export function updateStudentEmail(body: { user_id: string; email: string }) {
  return invokeFunction<{ email: string }, typeof body>("admin-student-account/email", body, { method: "PUT" });
}
/** PUT /admin-student-account/group: lo mueve al grupo de otro profesor (su progreso en el anterior se borra a los 7 días). */
export function updateStudentGroup(body: { user_id: string; teacher_id: string }) {
  return invokeFunction<{ teacher_id: string; college_id: string }, typeof body>("admin-student-account/group", body, { method: "PUT" });
}
/** POST /admin-student-account/password-reset: envía al correo del estudiante el link para crear una nueva contraseña. */
export function requestStudentPasswordReset(userId: string) {
  return invokeFunction<PasswordResetDelivery, { user_id: string }>("admin-student-account/password-reset", { user_id: userId });
}
/** DELETE /admin-student-account/password-reset: anula el link enviado. */
export function cancelStudentPasswordReset(userId: string) {
  return invokeFunction<{ status: "cancelled" }, Record<string, never>>(
    `admin-student-account/password-reset?user_id=${encodeURIComponent(userId)}`, {}, { method: "DELETE" },
  );
}
export const studentProfileQueryKey = (userId: string) => ["student-profile", userId] as const;
