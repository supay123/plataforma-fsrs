import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import type {
  RankingEntry,
  RankingPage,
} from "../_shared/interfaces/ranking.interfaces.ts";
import {
  cacheExpiresAt,
  DEFAULT_RANKING_PAGE_SIZE,
  MAX_RANKING_PAGE_SIZE,
  paginateRanking,
  parsePositiveInteger,
  parseRankingType,
} from "../_shared/ranking.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { requireRankingAccess } from "./access.ts";

/**
 * Una página de la caché del propio usuario. Cada consulta renueva su vida (1
 * hora deslizante). Sin caché, o vencida (se borra aquí), responde 404
 * `ranking_cache_not_found` para que el cliente llame antes a PUT /cache.
 */
export async function getRankingCache(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const parameters = new URL(request.url).searchParams;
  const type = parseRankingType(parameters.get("type"));
  const page = parsePositiveInteger(parameters.get("page"), "page", 1);
  const pageSize = parsePositiveInteger(
    parameters.get("page_size"),
    "page_size",
    DEFAULT_RANKING_PAGE_SIZE,
    MAX_RANKING_PAGE_SIZE,
  );
  const user = await requireRankingAccess(context, type);

  const now = new Date();
  const expiresAt = cacheExpiresAt(now);
  const { data, error } = await context.supabaseAdmin
    .from(TABLES.cacheRanking)
    .update({ expires_at: expiresAt })
    .eq("user_id", user.id)
    .eq("ranking_type", type)
    .gt("expires_at", now.toISOString())
    .select("entries,created_at")
    .maybeSingle();
  if (error) throw new AppError(500, "ranking_cache_failed", error.message);

  if (!data) {
    await context.supabaseAdmin
      .from(TABLES.cacheRanking)
      .delete()
      .eq("user_id", user.id)
      .eq("ranking_type", type)
      .lte("expires_at", now.toISOString());
    throw new AppError(
      404,
      "ranking_cache_not_found",
      "The ranking cache does not exist or has expired.",
    );
  }

  const pageData = paginateRanking(
    data.entries as unknown as RankingEntry[],
    user.id,
    page,
    pageSize,
  );
  const response: RankingPage = {
    type,
    page,
    page_size: pageSize,
    ...pageData,
    my_position: user.role === "student" ? pageData.my_position : null,
    generated_at: data.created_at,
    expires_at: expiresAt,
  };
  return json(response);
}
