import { invokeFunction } from "../../lib/api/functions";
import type { AnswerOption } from "../../types/contracts";

export interface FreeModeCatalogGroup {
  id: string;
  name: string;
  courses: Array<{ id: string; name: string; topics: Array<{ id: string; name: string }> }>;
}

export interface FreeModeQuestion {
  id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: AnswerOption;
  explanation: string | null;
}

export interface FreeModeLead {
  given_names: string;
  family_names: string;
  email: string;
  phone: string;
  accepted_data_policy: boolean;
  /** Campo trampa: debe viajar vacío; solo los bots lo llenan. */
  website: string;
}

/** GET /free-mode/catalog: grupos → cursos → temas de la institución demo. */
export async function getFreeModeCatalog() {
  const { groups } = await invokeFunction<{ groups: FreeModeCatalogGroup[] }, Record<string, never>>("free-mode/catalog", {}, { method: "GET" });
  return groups;
}

/** GET /free-mode/questions: 10 preguntas al azar del tema, con su respuesta correcta. */
export const getFreeModeQuestions = (topicId: string) =>
  invokeFunction<{ topic: { id: string; name: string }; questions: FreeModeQuestion[] }, Record<string, never>>(`free-mode/questions?topic_id=${encodeURIComponent(topicId)}`, {}, { method: "GET" });

/** POST /free-mode/leads: guarda a quien probó el modo gratuito. */
export const registerFreeModeLead = (lead: FreeModeLead) => invokeFunction<{ ok: true }, FreeModeLead>("free-mode/leads", lead);
