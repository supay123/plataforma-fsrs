import { RPCS } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";

/**
 * GET /public/colleges
 * Colegios activos que puede elegir quien se registra (solo id y nombre). Si no
 * hay ninguno, la base crea "Chancón – Particular" una sola vez.
 */
export async function listColleges(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const { data, error } = await context.supabaseAdmin.rpc(
    RPCS.registrationColleges,
  );
  if (error) {
    throw new AppError(500, "colleges_lookup_failed", error.message);
  }
  return json({
    colleges: (data ?? []).map((college) => ({
      id: college.college_id,
      name: college.college_name,
    })),
  });
}
