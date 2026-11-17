import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../components/ui/use-toast";
import { normalizeError } from "../../lib/api/errors";
import { getRankingPage, RANKING_CACHE_NOT_FOUND, refreshRankingCache, type RankingItem, type RankingPage, type RankingType } from "./api";

export type RankingFeed =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: RankingItem[]; page: number; totalPages: number; totalParticipants: number; myPosition: number | null; loadingMore: boolean };

type Ready = Extract<RankingFeed, { status: "ready" }>;

/**
 * Carga del ranking de una categoría. Al entrar (y la primera vez en cada categoría) primero refresca la
 * caché y luego consulta la primera página; si la consulta dice que la caché no existe o venció, refresca
 * y reintenta una sola vez. Si vuelve a fallar muestra un toast y deja el estado en `error`.
 */
export function useRankingFeed(type: RankingType) {
  const toast = useToast();
  const refreshedTypes = useRef(new Set<RankingType>());
  // Se guarda con su categoría: al cambiar de categoría lo anterior no cuenta y se muestra la carga.
  const [stored, setStored] = useState<{ type: RankingType; feed: RankingFeed } | null>(null);
  const feed = useMemo<RankingFeed>(() => (stored?.type === type ? stored.feed : { status: "loading" }), [stored, type]);
  // Cada recarga completa invalida a la anterior (y a un "Ver más" en curso).
  const generation = useRef(0);

  const fetchFirstPage = useCallback(async (forceRefresh: boolean): Promise<RankingFeed> => {
    try {
      if (forceRefresh || !refreshedTypes.current.has(type)) {
        await refreshRankingCache(type);
        refreshedTypes.current.add(type);
      }
      let page: RankingPage;
      try {
        page = await getRankingPage(type, 1);
      } catch (error) {
        if ((await normalizeError(error)).code !== RANKING_CACHE_NOT_FOUND) throw error;
        await refreshRankingCache(type);
        page = await getRankingPage(type, 1);
      }
      return { status: "ready", items: page.items, page: 1, totalPages: page.total_pages, totalParticipants: page.total_participants, myPosition: page.my_position, loadingMore: false };
    } catch (error) {
      const failure = await normalizeError(error);
      toast.error(failure.message);
      return { status: "error", message: failure.message };
    }
  }, [type, toast]);

  useEffect(() => {
    const current = ++generation.current;
    void fetchFirstPage(false).then((next) => { if (current === generation.current) setStored({ type, feed: next }); });
    return () => { generation.current += 1; };
  }, [type, fetchFirstPage]);

  /** "Actualizar ranking" y "Volver a intentar": vuelve a crear la caché y recarga desde el inicio. */
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setStored({ type, feed: { status: "loading" } });
    const next = await fetchFirstPage(true);
    if (current === generation.current) setStored({ type, feed: next });
  }, [type, fetchFirstPage]);

  const updateReady = useCallback((change: (ready: Ready) => Ready) => {
    setStored((previous) => (previous?.type === type && previous.feed.status === "ready" ? { type, feed: change(previous.feed) } : previous));
  }, [type]);

  const loadMore = useCallback(async () => {
    if (feed.status !== "ready" || feed.loadingMore || feed.page >= feed.totalPages) return;
    const current = generation.current;
    const nextPage = feed.page + 1;
    updateReady((ready) => ({ ...ready, loadingMore: true }));
    try {
      const next = await getRankingPage(type, nextPage);
      if (current === generation.current) updateReady((ready) => ({ ...ready, items: [...ready.items, ...next.items], page: next.page, totalPages: next.total_pages, loadingMore: false }));
    } catch (error) {
      const failure = await normalizeError(error);
      if (current !== generation.current) return;
      // Sin caché a mitad de lista lo mostrado quedó viejo: se vuelve a empezar con una caché nueva.
      if (failure.code === RANKING_CACHE_NOT_FOUND) { void reload(); return; }
      toast.error(failure.message);
      updateReady((ready) => ({ ...ready, loadingMore: false }));
    }
  }, [feed, type, updateReady, reload, toast]);

  return { feed, loadMore, reload };
}
