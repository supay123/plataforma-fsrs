import { withSupabase } from "@supabase/server";
import type { Database } from "./database.types.ts";

export type { Database } from "./database.types.ts";

export const withAppSupabase = withSupabase<Database>;
