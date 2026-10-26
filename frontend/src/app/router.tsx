import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PortalLayout } from "../components/layout/PortalLayout";
import { Spinner } from "../components/ui";
import { LoginPage } from "../features/auth/LoginPage";
import { HomePage, NotFoundPage } from "../pages/HomePage";
import { RoleGuard } from "./guards";
const SignUpPage = lazy(() => import("../pages/public/SignUpPage").then((m) => ({ default: m.SignUpPage })));
const InvitationPage = lazy(() => import("../pages/public/InvitationPage").then((m) => ({ default: m.InvitationPage })));
const ResetPasswordPage = lazy(() => import("../pages/public/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const TermsPage = lazy(() => import("../pages/public/LegalPages").then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import("../pages/public/LegalPages").then((m) => ({ default: m.PrivacyPage })));
const RefundPolicyPage = lazy(() => import("../pages/public/LegalPages").then((m) => ({ default: m.RefundPolicyPage })));
const ComplaintsBookPage = lazy(() => import("../pages/public/ComplaintsBookPage").then((m) => ({ default: m.ComplaintsBookPage })));
const CollegesPage = lazy(() => import("../pages/admin/CollegesPage").then((m) => ({ default: m.CollegesPage })));
const AssignmentsPage = lazy(() => import("../pages/admin/AssignmentsPage").then((m) => ({ default: m.AssignmentsPage })));
const TeacherDetailPage = lazy(() => import("../pages/admin/UserDetailPage").then((m) => ({ default: m.TeacherDetailPage })));
const UserAccountPage = lazy(() => import("../pages/admin/UserAccountPage").then((m) => ({ default: m.UserAccountPage })));
const UsersPage = lazy(() => import("../pages/admin/UsersPage").then((m) => ({ default: m.UsersPage })));
const ReviewPage = lazy(() => import("../pages/shared/ReviewPage").then((m) => ({ default: m.ReviewPage })));
const SecurityPage = lazy(() => import("../pages/shared/SecurityPage").then((m) => ({ default: m.SecurityPage })));
const StudentCoursePage = lazy(() => import("../pages/student/CoursePage").then((m) => ({ default: m.StudentCoursePage })));
const StudentDashboardPage = lazy(() => import("../pages/student/DashboardPage").then((m) => ({ default: m.StudentDashboardPage })));
const RenewPage = lazy(() => import("../pages/student/RenewPage").then((m) => ({ default: m.RenewPage })));
const SessionPage = lazy(() => import("../pages/student/SessionPage").then((m) => ({ default: m.SessionPage })));
const CoursesPage = lazy(() => import("../pages/teacher/CoursesPage").then((m) => ({ default: m.CoursesPage })));
const ImportPage = lazy(() => import("../pages/teacher/ImportPage").then((m) => ({ default: m.ImportPage })));
const StudentResultsPage = lazy(() => import("../pages/teacher/StudentResultsPage").then((m) => ({ default: m.StudentResultsPage })));
const StudentsPage = lazy(() => import("../pages/teacher/StudentsPage").then((m) => ({ default: m.StudentsPage })));
const TopicsPage = lazy(() => import("../pages/teacher/TopicsPage").then((m) => ({ default: m.TopicsPage })));

export function AppRouter() {
  return <Suspense fallback={<Spinner />}><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/terminos" element={<TermsPage />} />
    <Route path="/privacidad" element={<PrivacyPage />} />
    <Route path="/reembolsos" element={<RefundPolicyPage />} />
    <Route path="/libro-reclamaciones" element={<ComplaintsBookPage />} />
    <Route path="/admin/login" element={<LoginPage role="admin" />} />
    <Route path="/profesor/login" element={<LoginPage role="teacher" />} />
    <Route path="/estudiante/login" element={<LoginPage role="student" />} />
    <Route path="/estudiante/sign-up" element={<SignUpPage />} />
    <Route path="/estudiante/reset" element={<ResetPasswordPage />} />
    <Route path="/estudiante/invitacion" element={<InvitationPage />} />
    <Route path="/estudiante/renovar" element={<RoleGuard role="student" allowExpired><RenewPage /></RoleGuard>} />
    <Route path="/admin" element={<RoleGuard role="admin"><PortalLayout role="admin" /></RoleGuard>}>
      <Route index element={<Navigate to="usuarios" replace />} /><Route path="usuarios" element={<UsersPage />} /><Route path="usuarios/:userId" element={<UserAccountPage />} /><Route path="colegios" element={<CollegesPage />} /><Route path="asignaciones" element={<AssignmentsPage />} /><Route path="profesores/:teacherId" element={<TeacherDetailPage />} /><Route path="configuracion" element={<SecurityPage />} />
    </Route>
    <Route path="/profesor" element={<RoleGuard role="teacher"><PortalLayout role="teacher" /></RoleGuard>}>
      <Route index element={<Navigate to="cursos" replace />} /><Route path="cursos" element={<CoursesPage />} /><Route path="cursos/:courseId" element={<TopicsPage />} /><Route path="temas/:topicId/importar" element={<ImportPage />} /><Route path="estudiantes" element={<StudentsPage />} /><Route path="estudiantes/:studentId/resultados" element={<StudentResultsPage />} /><Route path="sesiones/:sessionId" element={<ReviewPage />} /><Route path="configuracion" element={<SecurityPage />} />
    </Route>
    <Route path="/estudiante" element={<RoleGuard role="student"><PortalLayout role="student" /></RoleGuard>}>
      <Route index element={<StudentDashboardPage />} /><Route path="cursos/:courseId" element={<StudentCoursePage />} /><Route path="temas/:topicId/sesion" element={<SessionPage />} /><Route path="sesiones/:sessionId/revision" element={<ReviewPage />} /><Route path="configuracion" element={<SecurityPage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense>;
}
