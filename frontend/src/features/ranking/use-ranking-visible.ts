import { useQuery } from "@tanstack/react-query";
import { getRankingSettings } from "./api";

/** Configuración del ranking de la institución del usuario (estudiante o profesor); `enabled` false si no aplica. */
export function useRankingSettings(enabled: boolean) {
  return useQuery({ queryKey: ["ranking-settings", "own"], queryFn: () => getRankingSettings(), enabled, staleTime: 5 * 60 * 1000 });
}
