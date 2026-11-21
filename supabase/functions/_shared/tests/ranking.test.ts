import assert from "node:assert/strict";
import {
  availableCategories,
  cacheExpiresAt,
  isCacheExpired,
  paginateRanking,
  parsePositiveInteger,
  parseRankingCategories,
  parseRankingType,
  publicDisplayName,
  rankCandidates,
  RANKING_CACHE_TTL_MS,
} from "../ranking.ts";
import type { RankingCandidate } from "../interfaces/ranking.interfaces.ts";

const candidate = (
  user_id: string,
  values: Partial<RankingCandidate>,
): RankingCandidate => ({
  user_id,
  display_name: user_id,
  achievedAt: "2026-01-01T00:00:00.000Z",
  ...values,
});

Deno.test("publicDisplayName shows the name and family initials", () => {
  assert.equal(publicDisplayName("Carlos", "Pérez Ramos", "x"), "Carlos P. R.");
  assert.equal(
    publicDisplayName("Ana María", "de la Cruz", "x"),
    "Ana María D. L. C.",
  );
  assert.equal(publicDisplayName(null, null, "Luis Gómez Soto"), "Luis G. S.");
  assert.equal(publicDisplayName(null, null, "Luis"), "Luis");
});

Deno.test("NIVEL orders by level, then xp, then who got there first, then id", () => {
  const ranked = rankCandidates([
    candidate("c", { level: 2, xp: 10 }),
    candidate("a", { level: 3, xp: 0 }),
    candidate("b", { level: 2, xp: 50 }),
    candidate("d", {
      level: 2,
      xp: 10,
      achievedAt: "2025-01-01T00:00:00.000Z",
    }),
    candidate("e", { level: 2, xp: 10 }),
  ], "NIVEL");
  assert.deepEqual(ranked.map((entry) => entry.user_id), [
    "a",
    "b",
    "d",
    "c",
    "e",
  ]);
  assert.deepEqual(ranked.map((entry) => entry.position), [1, 2, 3, 4, 5]);
});

Deno.test("MEDALLAS orders by stars descending", () => {
  const ranked = rankCandidates([
    candidate("a", { stars: 5 }),
    candidate("b", { stars: 9 }),
    candidate("c", { stars: 0 }),
  ], "MEDALLAS");
  assert.deepEqual(ranked.map((entry) => entry.user_id), ["b", "a", "c"]);
});

Deno.test("NOTA orders by grade and leaves out students without a grade", () => {
  const ranked = rankCandidates([
    candidate("a", { grade: 70.5 }),
    candidate("b", { grade: null }),
    candidate("c", { grade: 90 }),
  ], "NOTA");
  assert.deepEqual(ranked.map((entry) => [entry.user_id, entry.grade]), [
    ["c", 90],
    ["a", 70.5],
  ]);
  assert.equal("achievedAt" in ranked[0]!, false);
});

Deno.test("paginateRanking slices pages, counts pages and finds my position", () => {
  const entries = rankCandidates(
    Array.from(
      { length: 70 },
      (_, index) =>
        candidate(`u${String(index).padStart(2, "0")}`, { stars: 100 - index }),
    ),
    "MEDALLAS",
  );
  const first = paginateRanking(entries, "u45", 1, 30);
  assert.equal(first.items.length, 30);
  assert.equal(first.total_pages, 3);
  assert.equal(first.total_participants, 70);
  assert.equal(first.my_position, 46);
  assert.equal(first.items[0]!.position, 1);
  assert.equal(first.items.some((item) => item.is_me), false);
  assert.equal("user_id" in first.items[0]!, false);
  const last = paginateRanking(entries, "u45", 3, 30);
  assert.equal(last.items.length, 10);
  assert.equal(
    paginateRanking(entries, "u45", 2, 30).items.find((item) => item.is_me)
      ?.position,
    46,
  );
  assert.equal(paginateRanking(entries, "u45", 9, 30).items.length, 0);
  assert.equal(paginateRanking(entries, "nobody", 1, 30).my_position, null);
  assert.equal(paginateRanking([], "u", 1, 30).total_pages, 0);
});

Deno.test("cache expiration slides one hour from each read", () => {
  const start = new Date("2026-11-16T10:00:00.000Z");
  const firstExpiry = cacheExpiresAt(start);
  assert.equal(
    new Date(firstExpiry).getTime() - start.getTime(),
    RANKING_CACHE_TTL_MS,
  );
  const laterRead = new Date(start.getTime() + 50 * 60 * 1000);
  assert.equal(isCacheExpired(firstExpiry, laterRead), false);
  const renewed = cacheExpiresAt(laterRead);
  assert.equal(
    isCacheExpired(renewed, new Date(start.getTime() + 105 * 60 * 1000)),
    false,
  );
  assert.equal(
    isCacheExpired(
      renewed,
      new Date(laterRead.getTime() + RANKING_CACHE_TTL_MS),
    ),
    true,
  );
  assert.equal(isCacheExpired(firstExpiry, new Date(firstExpiry)), true);
});

Deno.test("settings helpers validate input and hide MEDALLAS without medals", () => {
  assert.equal(parseRankingType("NIVEL"), "NIVEL");
  assert.throws(() => parseRankingType("nivel"));
  assert.deepEqual(parseRankingCategories(["NOTA", "NIVEL", "NOTA"]), [
    "NIVEL",
    "NOTA",
  ]);
  assert.throws(() => parseRankingCategories([]));
  assert.throws(() => parseRankingCategories(["OTRA"]));
  const all = {
    enabled: true,
    categories: ["NIVEL", "MEDALLAS", "NOTA"] as never,
  };
  assert.deepEqual(availableCategories(all, false), ["NIVEL", "NOTA"]);
  assert.deepEqual(availableCategories(all, true), [
    "NIVEL",
    "MEDALLAS",
    "NOTA",
  ]);
  assert.deepEqual(availableCategories({ ...all, enabled: false }, true), []);
  assert.equal(parsePositiveInteger(null, "page", 1), 1);
  assert.equal(parsePositiveInteger("4", "page", 1), 4);
  assert.throws(() => parsePositiveInteger("0", "page", 1));
  assert.throws(() => parsePositiveInteger("500", "page_size", 30, 100));
});
