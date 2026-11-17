import type { Json } from "../_shared/database.types.ts";
import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import {
  cacheExpiresAt,
  parseRankingType,
  rankCandidates,
} from "../_shared/ranking.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { requireRankingAccess } from "./access.ts";
import { loadCandidates } from "./candidates.ts";
import { loadGroupStudentIds } from "./group.ts";
import type { RefreshRankingCacheBody } from "./interfaces.ts";

/**
 * Crea o reemplaza la caché del usuario para una categoría con el ranking
 * completo de su grupo. También lo usa el botón "Actualizar ranking".
 */
export async function refreshRankingCache(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const body = await readJson<RefreshRankingCacheBody>(request);
  const type = parseRankingType(body.type);
  const user = await requireRankingAccess(context, type);

  const studentIds = await loadGroupStudentIds(context, user);
  const candidates = await loadCandidates(
    context,
    type,
    studentIds,
    user.college_id,
  );
  const entries = rankCandidates(candidates, type);

  const now = new Date();
  const expiresAt = cacheExpiresAt(now);
  const { error } = await context.supabaseAdmin
    .from(TABLES.cacheRanking)
    .upsert(
      {
        user_id: user.id,
        ranking_type: type,
        entries: entries as unknown as Json,
        created_at: now.toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "user_id,ranking_type" },
    );
  if (error) throw new AppError(500, "ranking_cache_failed", error.message);

  // Limpieza oportunista; el cron de pg_cron hace lo mismo cada 15 minutos.
  await context.supabaseAdmin.rpc(RPCS.purgeExpiredRankingCache);

  return json({
    type,
    total_participants: entries.length,
    generated_at: now.toISOString(),
    expires_at: expiresAt,
  });
}
