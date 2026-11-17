import { AppError } from "./errors.ts";
import type {
  GradeRange,
  MedalCode,
  MedalRange,
  MedalRules,
  StarsForGrade,
} from "./interfaces/medal.interfaces.ts";

export const DEFAULT_MEDAL_RULES: MedalRules = {
  enabled: true,
  star_range_ends: [2, 5, 8, 13, 18, 23, 32, 41, 50, 67, 84, 101],
  grade_range_ends: [2, 5, 8, 9, 13, 17],
};

export const MEDAL_NAMES: ReadonlyArray<readonly [MedalCode, string]> = [
  ["postulante_1", "Postulante 1"],
  ["postulante_2", "Postulante 2"],
  ["postulante_3", "Postulante 3"],
  ["pre_universitario_1", "Pre-Universitario 1"],
  ["pre_universitario_2", "Pre-Universitario 2"],
  ["pre_universitario_3", "Pre-Universitario 3"],
  ["candidato_1", "Candidato 1"],
  ["candidato_2", "Candidato 2"],
  ["candidato_3", "Candidato 3"],
  ["pre_ingresante_1", "Pre-Ingresante 1"],
  ["pre_ingresante_2", "Pre-Ingresante 2"],
  ["pre_ingresante_3", "Pre-Ingresante 3"],
  ["ingresante", "Ingresante"],
];

const STARS_BY_SECTION: StarsForGrade[] = [-3, -2, -1, 0, 1, 2, 3];
const MAX_GRADE = 20;
const MAX_STARS_PER_TOPIC = 3;

function validationError(message: string): AppError {
  return new AppError(400, "validation_error", message);
}

function strictlyIncreasingIntegers(
  value: unknown,
  field: string,
  count: number,
  maximum: number,
): number[] {
  if (!Array.isArray(value) || value.length !== count) {
    throw validationError(`${field} must be an array of ${count} integers.`);
  }
  value.forEach((entry, index) => {
    if (!Number.isInteger(entry) || entry < 0) {
      throw validationError(`${field} must contain only integers >= 0.`);
    }
    if (index > 0 && entry <= value[index - 1]) {
      throw validationError(`${field} must be strictly increasing.`);
    }
  });
  if (value[count - 1] > maximum) {
    throw validationError(`${field} cannot end above ${maximum}.`);
  }
  return value as number[];
}

export function parseStarRangeEnds(value: unknown): number[] {
  return strictlyIncreasingIntegers(
    value,
    "star_range_ends",
    12,
    Number.MAX_SAFE_INTEGER,
  );
}

/** El rango de +3 estrellas necesita al menos la nota 20, por eso el último fin llega a 19. */
export function parseGradeRangeEnds(value: unknown): number[] {
  return strictlyIncreasingIntegers(
    value,
    "grade_range_ends",
    6,
    MAX_GRADE - 1,
  );
}

export function medalRanges(starRangeEnds: number[]): MedalRange[] {
  return MEDAL_NAMES.map(([code, name], index) => ({
    code,
    name,
    min_stars: index === 0 ? 0 : starRangeEnds[index - 1]! + 1,
    max_stars: starRangeEnds[index] ?? null,
  }));
}

export function gradeRanges(gradeRangeEnds: number[]): GradeRange[] {
  return STARS_BY_SECTION.map((stars, index) => ({
    stars,
    min_grade: index === 0 ? 0 : gradeRangeEnds[index - 1]! + 1,
    max_grade: gradeRangeEnds[index] ?? MAX_GRADE,
  }));
}

export function medalForStars(
  stars: number,
  starRangeEnds: number[],
): MedalCode {
  const index = starRangeEnds.findIndex((end) => stars <= end);
  return MEDAL_NAMES[index < 0 ? MEDAL_NAMES.length - 1 : index]![0];
}

/** Nota de 0 a 20 con 2 decimales (16.33333 → 16.33, 17.75555 → 17.76). */
export function sessionGrade(
  correctCount: number,
  totalQuestions: number,
): number {
  if (totalQuestions <= 0) return 0;
  const grade = (correctCount / totalQuestions) * MAX_GRADE;
  return Math.round((grade + Number.EPSILON) * 100) / 100;
}

/**
 * Estrellas de una nota. Los rangos se escriben en enteros ("14-17"), así que
 * una nota con decimales cae en el rango de su parte entera: 17.75 está en 14-17.
 */
export function starsForGrade(
  grade: number,
  gradeRangeEnds: number[],
): StarsForGrade {
  const wholeGrade = Math.floor(grade);
  const index = gradeRangeEnds.findIndex((end) => wholeGrade <= end);
  return STARS_BY_SECTION[index < 0 ? STARS_BY_SECTION.length - 1 : index]!;
}

/**
 * Cambio de estrellas de un intento en un tema y su nueva mejor marca. Misma
 * regla que aplica `edge_apply_session_medal` en la base de datos:
 *  - Estrellas negativas siempre restan.
 *  - Tema sin completar: suma la diferencia con su mejor marca.
 *  - Tema completado: solo un +3 suma +1.
 */
export function topicStarsOutcome(
  starsForAttempt: StarsForGrade,
  bestStars: number,
  completed: boolean,
): { gain: number; best_stars: number } {
  if (starsForAttempt < 0) {
    return { gain: starsForAttempt, best_stars: bestStars };
  }
  if (!completed) {
    return {
      gain: Math.max(starsForAttempt - bestStars, 0),
      best_stars: Math.max(starsForAttempt, bestStars),
    };
  }
  return {
    gain: starsForAttempt === MAX_STARS_PER_TOPIC ? 1 : 0,
    best_stars: bestStars,
  };
}
