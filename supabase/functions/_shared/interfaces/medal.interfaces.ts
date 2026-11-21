export type MedalCode =
  | "postulante_1"
  | "postulante_2"
  | "postulante_3"
  | "pre_universitario_1"
  | "pre_universitario_2"
  | "pre_universitario_3"
  | "candidato_1"
  | "candidato_2"
  | "candidato_3"
  | "pre_ingresante_1"
  | "pre_ingresante_2"
  | "pre_ingresante_3"
  | "ingresante";

/** Estrellas que da una nota: de -3 a +3. */
export type StarsForGrade = -3 | -2 | -1 | 0 | 1 | 2 | 3;

/** Lo que se guarda por institución; los demás campos de la respuesta se derivan de él. */
export interface MedalRules {
  enabled: boolean;
  /** Fin de cada uno de los 12 primeros rangos de estrellas. */
  star_range_ends: number[];
  /** Fin de las notas que dan -3, -2, -1, 0, +1 y +2 estrellas. */
  grade_range_ends: number[];
}

export interface MedalRange {
  code: MedalCode;
  name: string;
  min_stars: number;
  /** null en Ingresante, que no tiene tope. */
  max_stars: number | null;
}

export interface GradeRange {
  stars: StarsForGrade;
  min_grade: number;
  max_grade: number;
}

export interface MedalSettingsResponse extends MedalRules {
  college_id: string;
  /** true cuando la institución todavía no tiene fila y se devuelven los valores por defecto. */
  is_default: boolean;
  medals: MedalRange[];
  grade_ranges: GradeRange[];
}

/** Resultado de aplicar una sesión; con las medallas desactivadas solo trae enabled: false. */
export type MedalAward =
  | { enabled: false }
  | {
    enabled: true;
    grade: number;
    stars_for_grade: StarsForGrade;
    stars_delta: number;
    stars_before: number;
    stars: number;
    medal_before: MedalCode;
    medal: MedalCode;
    topic_id: string;
    topic_best_stars: number;
    topic_completed: boolean;
  };
