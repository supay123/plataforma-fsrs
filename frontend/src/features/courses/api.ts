import { translateDatabaseError } from "../../lib/api/errors";
import { supabase } from "../../lib/supabase/client";
import type { TablesInsert, TablesUpdate } from "../../types/database";
export async function listCourses() { const { data, error } = await supabase.from("courses").select("*, colleges(name), profiles!courses_teacher_id_fkey(full_name)").neq("status", "archived").order("name"); if (error) throw error; return data; }
export const COURSES_PAGE_SIZE = 10;
export type CoursesPageFilters = { page: number; search: string; teacherId: string; collegeId: string };
/** Cursos no archivados de 10 en 10, con los filtros aplicados en la base de datos. */
export async function listCoursesPage({ page, search, teacherId, collegeId }: CoursesPageFilters) {
  const firstIndex = (page - 1) * COURSES_PAGE_SIZE;
  let query = supabase.from("courses").select("*, colleges(name), profiles!courses_teacher_id_fkey(full_name)", { count: "exact" })
    .neq("status", "archived").order("teacher_id").order("name").order("id").range(firstIndex, firstIndex + COURSES_PAGE_SIZE - 1);
  if (teacherId) query = query.eq("teacher_id", teacherId);
  if (collegeId) query = query.eq("college_id", collegeId);
  const term = search.replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  const { data, count, error } = await query;
  if (error) throw error;
  return { courses: data, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / COURSES_PAGE_SIZE) };
}
export async function createCourse(value: TablesInsert<"courses">) { const { data, error } = await supabase.from("courses").insert(value).select().single(); if (error) throw translateDatabaseError(error); return data; }
export async function updateCourse(id: string, value: TablesUpdate<"courses">) { const { data, error } = await supabase.from("courses").update(value).eq("id", id).select().single(); if (error) throw translateDatabaseError(error); return data; }
export async function archiveCourse(id: string) { const { error } = await supabase.from("courses").update({ status: "archived" }).eq("id", id); if (error) throw error; return id; }
export async function listTopics(courseId: string) { const { data, error } = await supabase.from("topics").select("*").eq("course_id", courseId).neq("status", "archived").order("position"); if (error) throw error; return data; }
export async function createTopic(value: TablesInsert<"topics">) { const { data, error } = await supabase.from("topics").insert(value).select().single(); if (error) throw error; return data; }
export async function updateTopic(id: string, value: TablesUpdate<"topics">) { const { data, error } = await supabase.from("topics").update(value).eq("id", id).select().single(); if (error) throw error; return data; }
export async function listStudentCourses() { const { data, error } = await supabase.from("courses").select("*, course_enrollments!inner(student_id,status)").eq("course_enrollments.status", "active").eq("status", "active").order("name"); if (error) throw error; return data; }
export async function enrollStudent(value: { course_id: string; student_id: string; enrolled_by: string }) { const { data, error } = await supabase.from("course_enrollments").upsert({ ...value, status: "active", ended_at: null }, { onConflict: "course_id,student_id" }).select().single(); if (error) throw error; return data; }
export async function moveCourse(value: { courseId: string; teacherId: string }) { const { error } = await supabase.rpc("admin_move_course", { p_course_id: value.courseId, p_teacher_id: value.teacherId }); if (error) throw translateDatabaseError(error); }
export async function duplicateCourse(courseId: string) { const { data, error } = await supabase.rpc("admin_duplicate_course", { p_course_id: courseId }); if (error) throw translateDatabaseError(error); return data; }
