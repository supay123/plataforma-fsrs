import { invokeFunction } from "../../lib/api/functions";

export type RankingType = "NIVEL" | "MEDALLAS" | "NOTA";

export const RANKING_TYPES: readonly RankingType[] = ["NIVEL", "MEDALLAS", "NOTA"];
export const RANKING_LABELS: Record<RankingType, string> = { NIVEL: "Nivel", MEDALLAS: "Medallas", NOTA: "Nota" };
export const RANKING_PAGE_SIZE = 30;

/** Código con el que el endpoint avisa que la caché no existe o venció: hay que refrescarla y reintentar. */
export const RANKING_CACHE_NOT_FOUND = "ranking_cache_not_found";

export interface RankingSettings { enabled: boolean; categories: RankingType[] }

/** GET/PUT `ranking/settings`. `available_categories` ya descarta MEDALLAS si el colegio apagó las medallas. */
export interface RankingSettingsResponse extends RankingSettings {
  college_id: string; is_default: boolean; available_categories: RankingType[]; visible: boolean;
}

export interface RankingItem {
  position: number; display_name: string; is_me: boolean;
  level?: number; xp?: number;
  stars?: number; medal?: { code: string; name: string };
  grade?: number; completed_sessions?: number;
}

/** GET `ranking/cache`. `my_position` es null para profesores y para quien aún no participa. */
export interface RankingPage {
  type: RankingType; page: number; page_size: number; total_pages: number; total_participants: number;
  my_position: number | null; items: RankingItem[]; generated_at: string; expires_at: string;
}

export const DEFAULT_RANKING_SETTINGS: RankingSettings = { enabled: false, categories: [...RANKING_TYPES] };

/** Admin: pasa `collegeId`. Profesor y estudiante reciben la de su propio colegio. */
export const getRankingSettings = (collegeId?: string) => invokeFunction<RankingSettingsResponse, Record<string, never>>(
  `ranking/settings${collegeId ? `?college_id=${encodeURIComponent(collegeId)}` : ""}`, {}, { method: "GET" },
);
export const saveRankingSettings = (collegeId: string, settings: Partial<RankingSettings>) =>
  invokeFunction<RankingSettingsResponse, Partial<RankingSettings> & { college_id: string }>("ranking/settings", { college_id: collegeId, ...settings }, { method: "PUT" });

/** Crea o reemplaza la caché del usuario para la categoría. */
export const refreshRankingCache = (type: RankingType) =>
  invokeFunction<{ type: RankingType; total_participants: number }, { type: RankingType }>("ranking/cache", { type }, { method: "PUT" });
export const getRankingPage = (type: RankingType, page: number, pageSize = RANKING_PAGE_SIZE) => invokeFunction<RankingPage, Record<string, never>>(
  `ranking/cache?type=${type}&page=${page}&page_size=${pageSize}`, {}, { method: "GET" },
);
