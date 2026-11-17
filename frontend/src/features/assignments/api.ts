import { supabase } from "../../lib/supabase/client";

export async function listTeacherAssignments() {
  const { data, error } = await supabase.from("v_teacher_students").select("*").order("student_name");
  if (error) throw error;
  return data;
}

export async function syncTeacherStudents(value: { teacherId: string; studentIds: string[] }) {
  const { error } = await supabase.rpc("admin_sync_teacher_students", {
    p_teacher_id: value.teacherId,
    p_student_ids: value.studentIds,
  });
  if (error) throw error;
}

export async function setCourseEnrollmentStatus(value: {
  courseId: string;
  studentId: string;
  status: "active" | "inactive";
}) {
  const { data, error } = await supabase
    .from("course_enrollments")
    .update({ status: value.status, ended_at: value.status === "active" ? null : new Date().toISOString() })
    .eq("course_id", value.courseId)
    .eq("student_id", value.studentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
