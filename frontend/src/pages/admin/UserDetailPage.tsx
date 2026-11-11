import { Navigate, useParams } from "react-router-dom";

export function TeacherDetailPage() {
  const { teacherId = "" } = useParams();
  return <Navigate to={`/admin/asignaciones?profesor=${teacherId}`} replace />;
}
