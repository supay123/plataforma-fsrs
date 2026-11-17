import { AppError } from "./errors.ts";
import type {
  PublicRankingEntry,
  RankingCandidate,
  RankingEntry,
  RankingSettings,
  RankingType,
} from "./interfaces/ranking.interfaces.ts";

export const RANKING_TYPES: readonly RankingType[] = [
  "NIVEL",
  "MEDALLAS",
  "NOTA",
];
export const DEFAULT_RANKING_SETTINGS: RankingSettings = {
  enabled: false,
  categories: [...RANKING_TYPES],
};
export const RANKING_CACHE_TTL_MS = 60 * 60 * 1000;
export const DEFAULT_RANKING_PAGE_SIZE = 30;
export const MAX_RANKING_PAGE_SIZE = 100;

export function parseRankingType(value: unknown): RankingType {
  if (RANKING_TYPES.includes(value as RankingType)) return value as RankingType;
  throw new AppError(
    400,
    "validation_error",
    `type must be one of ${RANKING_TYPES.join(", ")}.`,
  );
}

/** Categorías sin repetir, en el orden canónico; al menos una. */
export function parseRankingCategories(value: unknown): RankingType[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(
      400,
      "validation_error",
      "categories must be a non-empty array.",
    );
  }
  const requested = new Set(value.map(parseRankingType));
  return RANKING_TYPES.filter((type) => requested.has(type));
}

/** Categorías que se ofrecen: MEDALLAS se oculta si las medallas están apagadas. */
export function availableCategories(
  settings: RankingSettings,
  medalsEnabled: boolean,
): RankingType[] {
  if (!settings.enabled) return [];
  return settings.categories.filter(
    (type) => type !== "MEDALLAS" || medalsEnabled,
  );
}

function firstInitial(word: string): string {
  return `${Array.from(word)[0]!.toUpperCase()}.`;
}

/**
 * Nombre público: nombre completo e iniciales de los apellidos ("Carlos P. R.").
 * Sin nombres/apellidos separados se toma la primera palabra de `fullName` como nombre.
 */
export function publicDisplayName(
  givenNames: string | null,
  familyNames: string | null,
  fullName: string,
): string {
  const words = (text: string) => text.split(/\s+/).filter(Boolean);
  const given = givenNames && familyNames
    ? words(givenNames)
    : words(fullName).slice(0, 1);
  const family = givenNames && familyNames
    ? words(familyNames)
    : words(fullName).slice(1);
  return [...given, ...family.map(firstInitial)].join(" ");
}

function rankingValue(candidate: RankingCandidate, type: RankingType) {
  if (type === "NIVEL") return [candidate.level ?? 0, candidate.xp ?? 0];
  if (type === "MEDALLAS") return [candidate.stars ?? 0];
  return [candidate.grade ?? 0];
}

/** Descendente por valor; empate: quien lo alcanzó antes y, si persiste, el id. */
export function compareCandidates(
  type: RankingType,
): (a: RankingCandidate, b: RankingCandidate) => number {
  return (a, b) => {
    const valuesA = rankingValue(a, type);
    const valuesB = rankingValue(b, type);
    for (let index = 0; index < valuesA.length; index++) {
      if (valuesA[index] !== valuesB[index]) {
        return valuesB[index]! - valuesA[index]!;
      }
    }
    if (a.achievedAt !== b.achievedAt) {
      return a.achievedAt < b.achievedAt ? -1 : 1;
    }
    return a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0;
  };
}

/**
 * Ordena y numera (1, 2, 3...; sin posiciones compartidas). En NOTA quien aún
 * no tiene nota no participa.
 */
export function rankCandidates(
  candidates: RankingCandidate[],
  type: RankingType,
): RankingEntry[] {
  return candidates
    .filter((candidate) => type !== "NOTA" || candidate.grade != null)
    .sort(compareCandidates(type))
    .map((candidate, index) => {
      const { achievedAt: _achievedAt, grade, ...rest } = candidate;
      return {
        ...rest,
        ...(type === "NOTA" ? { grade: grade as number } : {}),
        position: index + 1,
      };
    });
}

export function paginateRanking(
  entries: RankingEntry[],
  userId: string,
  page: number,
  pageSize: number,
): {
  items: PublicRankingEntry[];
  total_pages: number;
  total_participants: number;
  my_position: number | null;
} {
  const start = (page - 1) * pageSize;
  return {
    items: entries.slice(start, start + pageSize).map(
      ({ user_id, ...rest }) => ({ ...rest, is_me: user_id === userId }),
    ),
    total_pages: Math.ceil(entries.length / pageSize),
    total_participants: entries.length,
    my_position: entries.find((entry) => entry.user_id === userId)?.position ??
      null,
  };
}

/** Número entero ≥ 1 de un parámetro de URL; vacío usa el valor por defecto. */
export function parsePositiveInteger(
  value: string | null,
  field: string,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new AppError(
      400,
      "validation_error",
      `${field} must be an integer between 1 and ${maximum}.`,
    );
  }
  return parsed;
}

export function cacheExpiresAt(now: Date): string {
  return new Date(now.getTime() + RANKING_CACHE_TTL_MS).toISOString();
}

export function isCacheExpired(expiresAt: string, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
