import { invokeFunction } from "../../lib/api/functions";

/** GET `achievements/streak`. Los días son "AAAA-MM-DD" del calendario de America/Lima. */
export interface Streak {
  current_streak: number; best_streak: number; active_today: boolean;
  last_active_date: string | null; today: string; recent_active_days: string[];
}

export interface LastSessionGrade { session_id: string; completed_at: string; topic_name: string | null; grade: number }

/** GET `achievements/last-grades`. `last_route_lesson` queda en null hasta que exista Modo Ruta. */
export interface LastGrades { last_session: LastSessionGrade | null; last_route_lesson: null }

export const getStreak = () => invokeFunction<Streak, Record<string, never>>("achievements/streak", {}, { method: "GET" });
export const getLastGrades = () => invokeFunction<LastGrades, Record<string, never>>("achievements/last-grades", {}, { method: "GET" });
