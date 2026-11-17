import { z } from "zod";
import type { MedalCode } from "./api";

export const MEDAL_NAMES: Record<MedalCode, string> = {
  postulante_1: "Postulante 1", postulante_2: "Postulante 2", postulante_3: "Postulante 3",
  pre_universitario_1: "Pre-Universitario 1", pre_universitario_2: "Pre-Universitario 2", pre_universitario_3: "Pre-Universitario 3",
  candidato_1: "Candidato 1", candidato_2: "Candidato 2", candidato_3: "Candidato 3",
  pre_ingresante_1: "Pre-Ingresante 1", pre_ingresante_2: "Pre-Ingresante 2", pre_ingresante_3: "Pre-Ingresante 3",
  ingresante: "Ingresante",
};

/** Estrellas por sección de notas, de la más baja a la más alta. */
export const STARS_BY_GRADE_SECTION = [-3, -2, -1, 0, 1, 2, 3] as const;

/** Familia de la medalla ("Pre-Universitario 2" → "Pre-Universitario") para colorearla. */
export function medalFamily(code: MedalCode): string {
  return MEDAL_NAMES[code].replace(/ \d$/, "");
}

export const MEDAL_RULE_SUMMARY = "Cada tema da como máximo 3 estrellas. Si ya completaste un tema (3 estrellas) y lo vuelves a intentar, solo ganas +1 estrella cuando el resultado es +3; con +1 o +2 no suma. Una nota baja siempre resta estrellas.";

const MAX_GRADE_END = 19;

function strictlyIncreasing(maximum: number) {
  return (ends: number[], context: z.RefinementCtx) => {
    ends.forEach((end, index) => {
      if (index > 0 && end <= ends[index - 1]!) context.addIssue({ code: "custom", path: [index], message: "Debe ser mayor que el anterior." });
      if (end > maximum) context.addIssue({ code: "custom", path: [index], message: `No puede pasar de ${maximum}.` });
    });
  };
}

const endNumber = z.number("Escribe un número.").int("Usa un número entero.").min(0, "No puede ser negativo.");

export const starRangeEndsSchema = z.array(endNumber).length(12).superRefine(strictlyIncreasing(Number.MAX_SAFE_INTEGER));
/** El rango de +3 estrellas termina en 20, por eso el fin del anterior llega como máximo a 19. */
export const gradeRangeEndsSchema = z.array(endNumber).length(6).superRefine(strictlyIncreasing(MAX_GRADE_END));

/** Convierte lo escrito (texto) en números y devuelve el error de cada casilla (por posición). */
export function validateEnds(texts: string[], schema: typeof starRangeEndsSchema): { values: number[]; errors: Record<number, string> } {
  const values = texts.map((text) => (text.trim() === "" ? Number.NaN : Number(text)));
  const result = schema.safeParse(values);
  const errors: Record<number, string> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const index = issue.path[0];
      if (typeof index === "number" && !(index in errors)) errors[index] = Number.isNaN(values[index]) ? "Escribe un número." : issue.message;
    }
  }
  return { values, errors };
}
