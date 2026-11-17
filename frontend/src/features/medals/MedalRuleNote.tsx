import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { getMyMedal } from "./api";
import { MedalRulesBody } from "./MedalRulesHelp";

/** Nota de la pantalla de carga: explica las estrellas por tema, solo si el colegio tiene medallas activadas. */
export function MedalRuleNote() {
  const medal = useQuery({ queryKey: ["my-medal"], queryFn: getMyMedal, retry: false });
  if (!medal.data?.enabled) return null;
  return <div className="w-full rounded-2xl border-2 border-line bg-blocks px-4 py-3 text-left text-sm text-on-blocks">
    <p className="mb-2 inline-flex items-center gap-1.5 font-semibold text-secondary-text"><Star aria-hidden size={16} className="fill-current" />Estrellas por tema</p>
    <MedalRulesBody />
  </div>;
}
