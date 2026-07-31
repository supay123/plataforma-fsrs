import { invokeFunction } from "../../lib/api/functions";
import { supabase } from "../../lib/supabase/client";
import type { AppRole, UserMutationResponse } from "../../types/contracts";
export async function listUsers() { const { data, error } = await supabase.from("profiles").select("*").in("role", ["teacher", "student"]).order("full_name"); if (error) throw error; return data; }
export async function createUser(body: { role: "teacher" | "student"; user_code: string; full_name: string; college_id: string; password?: string; access_valid_from?: string; access_valid_until?: string }) { return invokeFunction<UserMutationResponse, typeof body>("admin-create-user", body); }
export async function updateUser(body: { user_id: string; user_code?: string; full_name?: string; college_id?: string; is_active?: boolean }) { return invokeFunction<UserMutationResponse, typeof body>("admin-update-user", body); }
export async function resetCredentials(body: { user_id: string; user_code?: string; password?: string }) { return invokeFunction<UserMutationResponse, typeof body>("admin-reset-user-credentials", body); }
export async function renewAccess(body: { user_id: string; access_valid_from: string; access_valid_until: string; reactivate?: boolean }) { return invokeFunction<UserMutationResponse, typeof body>("admin-renew-access", body); }
export const roleLabel = (role: AppRole) => ({ admin: "Administrador", teacher: "Profesor", student: "Estudiante" })[role];
