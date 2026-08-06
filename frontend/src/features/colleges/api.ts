import { supabase } from "../../lib/supabase/client";
import { invokeFunction } from "../../lib/api/functions";
import type { TablesInsert, TablesUpdate } from "../../types/database";
export async function listColleges() { const { data, error } = await supabase.from("colleges").select("*").order("name"); if (error) throw error; return data; }
export async function createCollege(value: TablesInsert<"colleges">) { const { data, error } = await supabase.from("colleges").insert(value).select().single(); if (error) throw error; return data; }
export async function updateCollege(id: string, value: TablesUpdate<"colleges">) { const { data, error } = await supabase.from("colleges").update(value).eq("id", id).select().single(); if (error) throw error; return data; }
export async function deleteCollege(collegeId: string) { return invokeFunction<{ college_id: string; deleted_users: number }, { college_id: string }>("admin-delete-college", { college_id: collegeId }); }
