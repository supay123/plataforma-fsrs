export type RankingType = "NIVEL" | "MEDALLAS" | "NOTA";

/** Fila del ranking tal como se guarda en la caché (incluye al usuario). */
export interface RankingEntry {
  position: number;
  user_id: string;
  display_name: string;
  level?: number;
  xp?: number;
  stars?: number;
  medal?: { code: string; name: string };
  grade?: number;
  completed_sessions?: number;
}

/** Fila que recibe el cliente: sin identificador, solo si es el propio usuario. */
export type PublicRankingEntry = Omit<RankingEntry, "user_id"> & {
  is_me: boolean;
};

/** Participante antes de ordenar; `achievedAt` desempata (quien llegó antes va primero). */
export interface RankingCandidate {
  user_id: string;
  display_name: string;
  achievedAt: string;
  level?: number;
  xp?: number;
  stars?: number;
  medal?: { code: string; name: string };
  grade?: number | null;
  completed_sessions?: number;
}

export interface RankingSettings {
  enabled: boolean;
  categories: RankingType[];
}

export interface RankingSettingsResponse extends RankingSettings {
  college_id: string;
  is_default: boolean;
  /** Categorías que ve el estudiante o profesor: las configuradas menos MEDALLAS si las medallas están apagadas. */
  available_categories: RankingType[];
  /** El ranking está activado y tiene al menos una categoría disponible. */
  visible: boolean;
}

export interface RankingPage {
  type: RankingType;
  page: number;
  page_size: number;
  total_pages: number;
  total_participants: number;
  /** Posición del propio usuario; null para profesores o quien no participa (p. ej. sin nota). */
  my_position: number | null;
  items: PublicRankingEntry[];
  generated_at: string;
  expires_at: string;
}
