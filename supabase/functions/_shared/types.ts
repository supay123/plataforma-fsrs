import type { SupabaseContext } from "@supabase/server";
import type { Enums, Tables } from "./database.types.ts";
import type { Database } from "./server.ts";

export type AppRole = Enums<"app_user_role">;

export type AppProfile = Pick<
  Tables<"profiles">,
  | "id"
  | "college_id"
  | "role"
  | "user_code"
  | "full_name"
  | "is_active"
  | "access_valid_from"
  | "access_valid_until"
>;

export type EdgeContext = SupabaseContext<Database>;
export type JsonRecord = Record<string, unknown>;
