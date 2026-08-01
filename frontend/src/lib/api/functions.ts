import { supabase } from "../supabase/client";
import { normalizeError } from "./errors";

export async function invokeFunction<TResponse, TBody extends object>(name: string, body: TBody): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke<TResponse>(name, {
    body,
    headers: { "x-client-request-id": crypto.randomUUID() },
  });
  if (error) throw await normalizeError(error);
  if (data === null) throw new Error(`La función ${name} no devolvió datos.`);
  return data;
}
