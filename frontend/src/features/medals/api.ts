import { invokeFunction } from "../../lib/api/functions";

export type MedalCode =
  | "postulante_1" | "postulante_2" | "postulante_3"
  | "pre_universitario_1" | "pre_universitario_2" | "pre_universitario_3"
  | "candidato_1" | "candidato_2" | "candidato_3"
  | "pre_ingresante_1" | "pre_ingresante_2" | "pre_ingresante_3"
  | "ingresante";

export interface MedalRange { code: MedalCode; name: string; min_stars: number; max_stars: number | null }
export interface GradeRange { stars: number; min_grade: number; max_grade: number }

/** Lo que se edita: el fin de cada rango (el inicio sale del fin del anterior). */
export interface MedalRules { enabled: boolean; star_range_ends: number[]; grade_range_ends: number[] }

/** GET/PUT `medals/settings`. */
export interface MedalSettings extends MedalRules {
  college_id: string; is_default: boolean; medals: MedalRange[]; grade_ranges: GradeRange[];
}

/** GET `medals/me`. Con las medallas desactivadas solo llega `enabled: false`. */
export type MyMedal =
  | { enabled: false }
  | { enabled: true; stars: number; medal: MedalRange; next_medal: MedalRange | null; stars_to_next: number | null };

/** POST `medals/calculate`. Estrellas ganadas o perdidas (`stars_delta`) y medalla tras la sesión. */
export type MedalAward =
  | { enabled: false }
  | {
    enabled: true; grade: number; stars_for_grade: number; stars_delta: number; stars_before: number; stars: number;
    medal_before: MedalCode; medal: MedalCode; topic_id: string; topic_best_stars: number; topic_completed: boolean;
  };

export interface TopicStars { topic_id: string; best_stars: number; completed: boolean }
/** GET `medals/topic-stars`. */
export type TopicStarsResponse = { enabled: boolean; topics: TopicStars[] };

/** Valores con los que nace cada institución (iguales a los de la tabla `college_medal_settings`). */
export const DEFAULT_MEDAL_RULES: MedalRules = {
  enabled: true,
  star_range_ends: [2, 5, 8, 13, 18, 23, 32, 41, 50, 67, 84, 101],
  grade_range_ends: [2, 5, 8, 9, 13, 17],
};

/** Admin: pasa `collegeId`. Profesor y estudiante reciben la de su propio colegio. */
export const getMedalSettings = (collegeId?: string) => invokeFunction<MedalSettings, Record<string, never>>(
  `medals/settings${collegeId ? `?college_id=${encodeURIComponent(collegeId)}` : ""}`, {}, { method: "GET" },
);
/** Solo admin. Con `enabled: false` basta con enviar ese campo. */
export const saveMedalSettings = (collegeId: string, rules: Partial<MedalRules>) =>
  invokeFunction<MedalSettings, Partial<MedalRules> & { college_id: string }>("medals/settings", { college_id: collegeId, ...rules }, { method: "PUT" });
export const getMyMedal = () => invokeFunction<MyMedal, Record<string, never>>("medals/me", {}, { method: "GET" });
export const getTopicStars = () => invokeFunction<TopicStarsResponse, Record<string, never>>("medals/topic-stars", {}, { method: "GET" });
/** El servidor calcula la nota desde la sesión guardada; el navegador solo envía el id. */
export const calculateMedal = (session_id: string) => invokeFunction<MedalAward, { session_id: string }>("medals/calculate", { session_id });
