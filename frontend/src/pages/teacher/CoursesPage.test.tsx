import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { CoursesPage } from "./CoursesPage";

const mocks = vi.hoisted(() => ({
  archiveCourse: vi.fn(),
  listCourses: vi.fn(),
}));

vi.mock("../../features/courses/api", () => ({
  archiveCourse: mocks.archiveCourse,
  listCourses: mocks.listCourses,
  createCourse: vi.fn(),
  duplicateCourse: vi.fn(),
  moveCourse: vi.fn(),
  updateCourse: vi.fn(),
}));
vi.mock("../../features/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { id: "teacher-1", college_id: "college-1" } }),
}));

describe("CoursesPage", () => {
  beforeEach(() => {
    mocks.archiveCourse.mockReset().mockResolvedValue("course-1");
    mocks.listCourses.mockReset().mockResolvedValue([{
      id: "course-1",
      name: "Historia",
      description: "Historia universal",
      status: "active",
    }]);
  });

  it("archives a course only after confirmation", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ModalProvider><MemoryRouter><CoursesPage /></MemoryRouter></ModalProvider></QueryClientProvider>);
    await user.click(await screen.findByRole("button", { name: "Eliminar" }));
    const dialog = await screen.findByRole("dialog", { name: "Eliminar curso" });
    expect(mocks.archiveCourse).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Eliminar curso" }));
    await waitFor(() => expect(mocks.archiveCourse.mock.calls[0]?.[0]).toBe("course-1"));
  });
});
