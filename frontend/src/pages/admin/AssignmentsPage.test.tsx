import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { AssignmentsPage } from "./AssignmentsPage";

const mocks = vi.hoisted(() => ({
  listColleges: vi.fn(),
  listCourses: vi.fn(),
  listTeacherAssignments: vi.fn(),
  listUsers: vi.fn(),
  setCourseEnrollmentStatus: vi.fn(),
  setTopicAccess: vi.fn(),
  syncTeacherStudents: vi.fn(),
  topicAccess: vi.fn(),
}));

vi.mock("../../features/assignments/api", () => ({
  listTeacherAssignments: mocks.listTeacherAssignments,
  setCourseEnrollmentStatus: mocks.setCourseEnrollmentStatus,
  syncTeacherStudents: mocks.syncTeacherStudents,
}));
vi.mock("../../features/colleges/api", () => ({ listColleges: mocks.listColleges }));
vi.mock("../../features/courses/api", () => ({ listCourses: mocks.listCourses }));
vi.mock("../../features/progress/api", () => ({ setTopicAccess: mocks.setTopicAccess, topicAccess: mocks.topicAccess }));
vi.mock("../../features/users/api", () => ({ listUsers: mocks.listUsers }));
vi.mock("../../features/auth/AuthProvider", () => ({ useAuth: () => ({ profile: { id: "admin-1" } }) }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ModalProvider><MemoryRouter><AssignmentsPage /></MemoryRouter></ModalProvider></QueryClientProvider>);
}

describe("AssignmentsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.listColleges.mockResolvedValue([{ id: "college-1", name: "Ciencias", is_active: true }]);
    mocks.listCourses.mockResolvedValue([{ id: "course-1", name: "Álgebra", teacher_id: "teacher-1", status: "active" }]);
    mocks.listTeacherAssignments.mockResolvedValue([]);
    mocks.listUsers.mockResolvedValue([
      { id: "teacher-1", role: "teacher", college_id: "college-1", full_name: "Profesor Carlos", user_code: "PROFE-1", is_active: true },
      { id: "student-1", role: "student", college_id: "college-1", full_name: "Ana Torres", user_code: "ALUMNA-1", is_active: true },
    ]);
    mocks.topicAccess.mockResolvedValue([]);
    mocks.syncTeacherStudents.mockResolvedValue(undefined);
  });

  it("enables the tools after selecting one teacher and confirms the global assignment", async () => {
    const user = userEvent.setup();
    renderPage();

    const assignmentButton = await screen.findByRole("button", { name: "Asignar alumnos a este profesor" });
    expect(assignmentButton).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Seleccionar a Profesor Carlos" }));
    expect(assignmentButton).toBeEnabled();
    await user.click(assignmentButton);
    await user.click(screen.getByRole("checkbox", { name: "Asignar a Ana Torres" }));
    await user.click(screen.getByRole("button", { name: "Confirmar asignaciones" }));

    expect(screen.getByRole("dialog", { name: "Confirmar asignaciones" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(mocks.syncTeacherStudents).toHaveBeenCalledWith({
      teacherId: "teacher-1",
      studentIds: ["student-1"],
    }));
  });

  it("keeps course access as a separate exception for assigned students", async () => {
    mocks.listTeacherAssignments.mockResolvedValue([{
      teacher_id: "teacher-1",
      teacher_name: "Profesor Carlos",
      course_id: "course-1",
      course_name: "Álgebra",
      student_id: "student-1",
      student_name: "Ana Torres",
      student_code: "ALUMNA-1",
      enrollment_status: "active",
    }]);
    mocks.setCourseEnrollmentStatus.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: "Seleccionar a Profesor Carlos" }));
    await user.click(screen.getByRole("button", { name: "Asignar o bloquear acceso de alumnos a un curso" }));
    await user.click(screen.getByRole("button", { name: "Bloquear acceso" }));

    await waitFor(() => expect(mocks.setCourseEnrollmentStatus).toHaveBeenCalledWith({
      courseId: "course-1",
      studentId: "student-1",
      status: "inactive",
    }));
  });
});
