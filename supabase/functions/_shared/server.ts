import {
  type SupabaseContext,
  withSupabase,
  type WithSupabaseConfig,
} from "@supabase/server";
import { corsHeaders } from "@supabase/supabase-js/cors";
import type { Database } from "./database.types.ts";

export type { Database } from "./database.types.ts";

const appCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": `${
    corsHeaders["Access-Control-Allow-Headers"]
  }, x-client-request-id`,
};

export function withAppSupabase(
  config: WithSupabaseConfig,
  handler: (
    request: Request,
    context: SupabaseContext<Database>,
  ) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return withSupabase<Database>(
    { ...config, cors: appCorsHeaders },
    handler,
  );
}
