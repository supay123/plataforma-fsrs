import { supabase } from "../../lib/supabase/client";

export interface CollegeXpSettings {
  base_xp: number; growth: number; xp_per_correct: number;
  streak_3_bonus: number; streak_7_bonus: number; streak_20_bonus: number;
}

/** Valores con los que nace cada institución (iguales a los de la tabla `college_xp_settings`). */
export const DEFAULT_XP_SETTINGS: CollegeXpSettings = {
  base_xp: 100, growth: 0.2, xp_per_correct: 75, streak_3_bonus: 15, streak_7_bonus: 42, streak_20_bonus: 137,
};

const COLUMNS = "base_xp,growth,xp_per_correct,streak_3_bonus,streak_7_bonus,streak_20_bonus";

/** Sin fila (institución que nunca tuvo xp) se muestran los valores por defecto. */
export async function getCollegeXpSettings(collegeId: string): Promise<CollegeXpSettings> {
  const { data, error } = await supabase.from("college_xp_settings").select(COLUMNS).eq("college_id", collegeId).maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_XP_SETTINGS;
}

export async function saveCollegeXpSettings(collegeId: string, settings: CollegeXpSettings): Promise<void> {
  const { error } = await supabase.from("college_xp_settings").upsert({ college_id: collegeId, ...settings, updated_at: new Date().toISOString() }, { onConflict: "college_id" });
  if (error) throw error;
}
