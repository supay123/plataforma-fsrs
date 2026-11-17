import { AppError } from "./errors.ts";
import { normalizePhone, parseEmail, parsePersonName } from "./registration.ts";

/** Código reservado de la institución demo que alimenta el modo gratuito. */
export const DEMO_COLLEGE_CODE = "CHANCON-DEMO";
export const FREE_MODE_QUESTION_COUNT = 10;

export function isDemoCollegeCode(code: string): boolean {
  return code.trim().toLowerCase() === DEMO_COLLEGE_CODE.toLowerCase();
}

export interface FreeModeCatalogGroup {
  id: string;
  name: string;
  courses: Array<
    { id: string; name: string; topics: Array<{ id: string; name: string }> }
  >;
}

export interface CatalogSource {
  teachers: Array<{ id: string; full_name: string }>;
  courses: Array<{ id: string; teacher_id: string; name: string }>;
  topics: Array<
    { id: string; course_id: string; name: string; position: number }
  >;
  /** Preguntas activas por tema. */
  questionCounts: Map<string, number>;
}

/**
 * Grupos → cursos → temas para los selectores. Solo aparecen los temas con
 * preguntas suficientes para una prueba, y no los cursos ni grupos que se
 * quedan sin temas.
 */
export function buildCatalog(source: CatalogSource): FreeModeCatalogGroup[] {
  const groups: FreeModeCatalogGroup[] = [];
  for (const teacher of source.teachers) {
    const courses = source.courses
      .filter((course) => course.teacher_id === teacher.id)
      .map((course) => ({
        id: course.id,
        name: course.name,
        topics: source.topics
          .filter((topic) =>
            topic.course_id === course.id &&
            (source.questionCounts.get(topic.id) ?? 0) >=
              FREE_MODE_QUESTION_COUNT
          )
          .sort((first, second) => first.position - second.position)
          .map((topic) => ({ id: topic.id, name: topic.name })),
      }))
      .filter((course) => course.topics.length > 0);
    if (courses.length > 0) {
      groups.push({ id: teacher.id, name: teacher.full_name, courses });
    }
  }
  return groups;
}

/** Elige `count` elementos al azar, sin repetir (Fisher-Yates). */
export function pickRandom<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy.slice(0, count);
}

export interface LeadInput {
  given_names: string;
  family_names: string;
  email: string;
  /** Celular peruano de 9 dígitos, sin código de país. */
  phone: string;
}

export type LeadRequest =
  | { kind: "honeypot" }
  | { kind: "lead"; lead: LeadInput };

/**
 * Valida el cuerpo de POST /free-mode/leads. Si el campo trampa (`website`,
 * oculto para personas) viene lleno es un bot: no se guarda nada.
 */
export function parseLeadRequest(request: object): LeadRequest {
  const body = request as Record<string, unknown>;
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return { kind: "honeypot" };
  }
  if (body.accepted_data_policy !== true) {
    throw new AppError(
      400,
      "consent_required",
      "You must accept the personal data policy.",
    );
  }
  return {
    kind: "lead",
    lead: {
      given_names: parsePersonName(body.given_names, "given_names"),
      family_names: parsePersonName(body.family_names, "family_names"),
      email: parseEmail(body.email),
      phone: normalizePhone(body.phone),
    },
  };
}

const LIMA_TIMESTAMP = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Lima",
  dateStyle: "short",
  timeStyle: "medium",
});

/** Fila del Google Sheet: fecha (hora de Lima), nombres, apellidos, correo y WhatsApp. */
export function leadSheetRow(lead: LeadInput, createdAt: Date): string[] {
  return [
    LIMA_TIMESTAMP.format(createdAt),
    lead.given_names,
    lead.family_names,
    lead.email,
    `+51${lead.phone}`,
  ];
}

export type LeadLogEvent =
  | "free_mode.lead_sheet_not_configured"
  | "free_mode.lead_sheet_failed"
  | "free_mode.lead_registration_failed";

/**
 * Línea de log del registro de leads. Solo lleva el evento, el id de la
 * petición y el motivo técnico: nunca datos del interesado (nombre, correo,
 * WhatsApp ni IP).
 */
export function leadLogLine(
  event: LeadLogEvent,
  requestId: string,
  cause?: unknown,
): string {
  const status = typeof cause === "object" && cause !== null &&
      "status" in cause && typeof cause.status === "number"
    ? cause.status
    : undefined;
  const message = cause instanceof Error
    ? cause.message
    : typeof cause === "object" && cause !== null && "message" in cause &&
        typeof cause.message === "string"
    ? cause.message
    : undefined;
  return JSON.stringify({
    event,
    request_id: requestId,
    ...(status === undefined ? {} : { status }),
    ...(message === undefined ? {} : { message }),
  });
}
