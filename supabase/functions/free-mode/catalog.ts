import { TABLES } from "../_shared/database.constants.ts";
import { AppError, json } from "../_shared/errors.ts";
import { buildCatalog } from "../_shared/free-mode.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { demoCollegeId } from "./demo-college.ts";

/**
 * GET /free-mode/catalog
 * Grupos (profesores) de la institución demo con sus cursos y temas, para los
 * tres selectores en cascada. Solo salen los temas con preguntas suficientes.
 */
export async function getCatalog(
  _request: Request,
  context: EdgeContext,
): Promise<Response> {
  const collegeId = await demoCollegeId(context);
  const { supabaseAdmin } = context;
  const lookupFailed = (message: string) =>
    new AppError(500, "free_mode_lookup_failed", message);

  const { data: teachers, error: teachersError } = await supabaseAdmin
    .from(TABLES.profiles)
    .select("id,full_name")
    .eq("college_id", collegeId)
    .eq("role", "teacher")
    .eq("is_active", true)
    .order("full_name");
  if (teachersError) throw lookupFailed(teachersError.message);

  const { data: courses, error: coursesError } = await supabaseAdmin
    .from(TABLES.courses)
    .select("id,teacher_id,name")
    .eq("college_id", collegeId)
    .eq("status", "active")
    .order("name");
  if (coursesError) throw lookupFailed(coursesError.message);

  const courseIds = (courses ?? []).map((course) => course.id);
  if (courseIds.length === 0) return json({ groups: [] });

  const { data: topics, error: topicsError } = await supabaseAdmin
    .from(TABLES.topics)
    .select("id,course_id,name,position")
    .in("course_id", courseIds)
    .eq("status", "active");
  if (topicsError) throw lookupFailed(topicsError.message);

  const topicIds = (topics ?? []).map((topic) => topic.id);
  const questionCounts = new Map<string, number>();
  if (topicIds.length > 0) {
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from(TABLES.questions)
      .select("topic_id")
      .in("topic_id", topicIds)
      .eq("status", "active");
    if (questionsError) throw lookupFailed(questionsError.message);
    for (const { topic_id } of questions ?? []) {
      questionCounts.set(topic_id, (questionCounts.get(topic_id) ?? 0) + 1);
    }
  }

  return json({
    groups: buildCatalog({
      teachers: teachers ?? [],
      courses: courses ?? [],
      topics: topics ?? [],
      questionCounts,
    }),
  });
}
