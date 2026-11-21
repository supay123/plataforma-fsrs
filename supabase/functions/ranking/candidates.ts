import { TABLES, VIEWS } from "../_shared/database.constants.ts";
import { AppError } from "../_shared/errors.ts";
import type {
  RankingCandidate,
  RankingType,
} from "../_shared/interfaces/ranking.interfaces.ts";
import { MEDAL_NAMES, medalForStars } from "../_shared/medals.ts";
import { publicDisplayName } from "../_shared/ranking.ts";
import type { EdgeContext } from "../_shared/types.ts";
import { loadMedalRules } from "../medals/settings.ts";
import { fetchAllRows, queryByIds } from "./group.ts";

const NEVER = "9999-12-31T00:00:00.000Z";

function failure(error: { message: string }): AppError {
  return new AppError(500, "ranking_data_failed", error.message);
}

async function loadParticipants(
  context: EdgeContext,
  studentIds: string[],
  collegeId: string,
): Promise<RankingCandidate[]> {
  const profiles = await queryByIds(studentIds, async (batch) => {
    const { data, error } = await context.supabaseAdmin
      .from(TABLES.profiles)
      .select("id,full_name,given_names,family_names")
      .in("id", batch)
      .eq("role", "student")
      .eq("is_active", true)
      .eq("college_id", collegeId);
    if (error) throw failure(error);
    return data;
  });
  return profiles.map((profile) => ({
    user_id: profile.id,
    display_name: publicDisplayName(
      profile.given_names,
      profile.family_names,
      profile.full_name,
    ),
    achievedAt: NEVER,
  }));
}

/**
 * Datos de cada participante para la categoría pedida. NOTA es el promedio de
 * los porcentajes por curso de `v_student_course_progress`, el mismo cálculo de
 * "Mi aprendizaje" (`averageCourseScore`).
 */
export async function loadCandidates(
  context: EdgeContext,
  type: RankingType,
  studentIds: string[],
  collegeId: string,
): Promise<RankingCandidate[]> {
  const participants = await loadParticipants(context, studentIds, collegeId);
  const ids = participants.map((participant) => participant.user_id);
  const byId = new Map(participants.map((item) => [item.user_id, item]));

  if (type === "NIVEL") {
    const rows = await queryByIds(
      ids,
      (batch) =>
        fetchAllRows((from, to) =>
          context.supabaseAdmin.from(TABLES.studentLevels)
            .select("student_id,level,xp,updated_at")
            .in("student_id", batch).range(from, to)
        ),
    );
    const stored = new Map(rows.map((row) => [row.student_id, row]));
    return participants.map((participant) => {
      const row = stored.get(participant.user_id);
      return {
        ...participant,
        level: row?.level ?? 0,
        xp: row?.xp ?? 0,
        achievedAt: row?.updated_at ?? NEVER,
      };
    });
  }

  if (type === "MEDALLAS") {
    const collegeRules = (await loadMedalRules(context, collegeId)).rules;
    const rows = await queryByIds(
      ids,
      (batch) =>
        fetchAllRows((from, to) =>
          context.supabaseAdmin.from(TABLES.studentMedals)
            .select("student_id,stars,updated_at")
            .in("student_id", batch).range(from, to)
        ),
    );
    const stored = new Map(rows.map((row) => [row.student_id, row]));
    return participants.map((participant) => {
      const stars = stored.get(participant.user_id)?.stars ?? 0;
      const code = medalForStars(stars, collegeRules.star_range_ends);
      return {
        ...participant,
        stars,
        medal: {
          code,
          name: MEDAL_NAMES.find(([medalCode]) => medalCode === code)![1],
        },
        achievedAt: stored.get(participant.user_id)?.updated_at ?? NEVER,
      };
    });
  }

  const progress = await queryByIds(
    ids,
    (batch) =>
      fetchAllRows((from, to) =>
        context.supabaseAdmin.from(VIEWS.studentCourseProgress)
          .select(
            "student_id,course_id,course_correct_percentage,completed_sessions,last_completed_at",
          )
          .in("student_id", batch).range(from, to)
      ),
  );
  const percentagesByStudent = new Map<string, number[]>();
  const sessionsByStudent = new Map<string, number>();
  const lastCompletedByStudent = new Map<string, string>();
  for (const row of progress) {
    if (!row.student_id) continue;
    if (row.course_correct_percentage !== null) {
      const percentages = percentagesByStudent.get(row.student_id) ?? [];
      percentages.push(Number(row.course_correct_percentage));
      percentagesByStudent.set(row.student_id, percentages);
    }
    sessionsByStudent.set(
      row.student_id,
      (sessionsByStudent.get(row.student_id) ?? 0) +
        Number(row.completed_sessions ?? 0),
    );
    const last = lastCompletedByStudent.get(row.student_id);
    if (row.last_completed_at && (!last || row.last_completed_at > last)) {
      lastCompletedByStudent.set(row.student_id, row.last_completed_at);
    }
  }
  return participants.map((participant) => {
    const percentages = percentagesByStudent.get(participant.user_id);
    return {
      ...byId.get(participant.user_id)!,
      grade: percentages?.length
        ? percentages.reduce((total, value) => total + value, 0) /
          percentages.length
        : null,
      completed_sessions: sessionsByStudent.get(participant.user_id) ?? 0,
      achievedAt: lastCompletedByStudent.get(participant.user_id) ?? NEVER,
    };
  });
}
