import { requireProfile } from "../_shared/auth.ts";
import { RPCS } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type { EdgeContext } from "../_shared/types.ts";

/**
 * Montos de xp del colegio del estudiante y su nivel actual. El navegador los
 * pide al cargar la sesión para mostrar el xp que gana con cada acierto y cada
 * racha, y para partir la barra de progreso del punto correcto.
 */
export async function xpRules(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const student = await requireProfile(context, ["student"], true);
  const { data, error } = await context.supabaseAdmin.rpc(
    RPCS.studentXpState,
    { p_student_id: student.id },
  );
  if (error || !data) {
    throw new AppError(500, "xp_state_failed", error?.message);
  }
  return json(data);
}
