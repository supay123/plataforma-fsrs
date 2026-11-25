import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { CoursesView } from "./CoursesView";
import { chooseSelectValue } from "../../components/ui/select-test-helpers";

const mocks = vi.hoisted(() => ({
  archiveCourse: vi.fn(),
  createCourse: vi.fn(),
  duplicateCourse: vi.fn(),
  moveCourse: vi.fn(),
  listCourses: vi.fn(),
  listCoursesPage: vi.fn(),
  listUsers: vi.fn(),
  listColleges: vi.fn(),
  updateCourse: vi.fn(),
}));

vi.mock("./api", () => ({
  archiveCourse: mocks.archiveCourse,
  createCourse: mocks.createCourse,
  duplicateCourse: mocks.duplicateCourse,
  moveCourse: mocks.moveCourse,
  listCourses: mocks.listCourses,
  listCoursesPage: mocks.listCoursesPage,
  updateCourse: mocks.updateCourse,
}));
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { id: "admin-1", role: "admin", college_id: null } }),
}));
vi.mock("../users/api", () => ({ listUsers: mocks.listUsers }));
vi.mock("../colleges/api", () => ({ listColleges: mocks.listColleges }));

const courses = [
  {
    id: "course-1", teacher_id: "teacher-1", college_id: "college-1", name: "Álgebra", description: "Curso base",
    status: "active", colleges: { name: "Colegio Norte" }, profiles: { full_name: "Ana Profesora" },
  },
  {
    id: "course-2", teacher_id: "teacher-1", college_id: "college-1", name: "Geometría", description: null,
    status: "inactive", colleges: { name: "Colegio Norte" }, profiles: { full_name: "Ana Profesora" },
  },
  {
    id: "course-3", teacher_id: "teacher-2", college_id: "college-2", name: "Historia", description: "Historia universal",
    status: "active", colleges: { name: "Colegio Sur" }, profiles: [{ full_name: "Beto Profesor" }],
  },
];

const users = [
  { id: "teacher-1", full_name: "Ana Profesora", role: "teacher", college_id: "college-1" },
  { id: "teacher-2", full_name: "Beto Profesor", role: "teacher", college_id: "college-2" },
];

const colleges = [
  { id: "college-1", name: "Colegio Norte" },
  { id: "college-2", name: "Colegio Sur" },
];

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ModalProvider><MemoryRouter><CoursesView /></MemoryRouter></ModalProvider></QueryClientProvider>);
}

describe("CoursesView como administrador", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.listCoursesPage.mockReset().mockResolvedValue({ courses, total: 3, totalPages: 1 });
    mocks.listUsers.mockReset().mockResolvedValue(users);
    mocks.listColleges.mockReset().mockResolvedValue(colleges);
    mocks.createCourse.mockReset().mockResolvedValue({});
    mocks.updateCourse.mockReset().mockResolvedValue({});
    mocks.archiveCourse.mockReset().mockResolvedValue("course-1");
    mocks.duplicateCourse.mockReset().mockResolvedValue("course-9");
    mocks.moveCourse.mockReset().mockResolvedValue(undefined);
  });

  it("agrupa los cursos por profesor", async () => {
    renderView();
    expect(await screen.findByRole("heading", { name: "Ana Profesora" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Beto Profesor" })).toBeInTheDocument();
    expect(screen.getByText("2 cursos")).toBeInTheDocument();
    expect(screen.getByText("1 curso")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Álgebra" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Historia" })).toBeInTheDocument();
  });

  it("abre el detalle de cada curso con la ruta del administrador", async () => {
    renderView();
    await screen.findByRole("heading", { name: "Ana Profesora" });

    const topicLinks = screen.getAllByRole("link", { name: "Temas" }).map((link) => link.getAttribute("href"));
    expect(topicLinks).toEqual(expect.arrayContaining([
      "/admin/cursos/course-1",
      "/admin/cursos/course-2",
      "/admin/cursos/course-3",
    ]));
  });

  it("busca por nombre de curso en el servidor y vuelve a la página 1", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Ana Profesora" });

    mocks.listCoursesPage.mockResolvedValue({ courses: [courses[2]], total: 1, totalPages: 1 });
    await user.type(screen.getByLabelText("Buscar curso"), "Historia");
    expect(await screen.findByRole("heading", { name: "Beto Profesor" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ana Profesora" })).not.toBeInTheDocument();
    expect(mocks.listCoursesPage).toHaveBeenLastCalledWith({ page: 1, search: "Historia", teacherId: "", collegeId: "" });
  });

  it("filtra por profesor en el servidor", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Ana Profesora" });

    mocks.listCoursesPage.mockResolvedValue({ courses: courses.slice(0, 2), total: 2, totalPages: 1 });
    await chooseSelectValue(user, screen.getByRole("combobox", { name: "Profesor" }), "teacher-1");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Beto Profesor" })).not.toBeInTheDocument());
    expect(screen.getByText("2 cursos")).toBeInTheDocument();
    expect(mocks.listCoursesPage).toHaveBeenLastCalledWith({ page: 1, search: "", teacherId: "teacher-1", collegeId: "" });
  });

  it("carga la siguiente página al llegar al final de la lista", async () => {
    let reachEnd: () => void = () => {};
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { reachEnd = () => callback([{ isIntersecting: true }]); }
      observe() {}
      disconnect() {}
    });
    mocks.listCoursesPage.mockResolvedValue({ courses: courses.slice(0, 2), total: 3, totalPages: 2 });
    renderView();
    await screen.findByRole("heading", { name: "Ana Profesora" });
    expect(screen.queryByRole("heading", { name: "Historia" })).not.toBeInTheDocument();

    mocks.listCoursesPage.mockResolvedValue({ courses: [courses[2]], total: 3, totalPages: 2 });
    reachEnd();
    expect(await screen.findByRole("heading", { name: "Historia" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Álgebra" })).toBeInTheDocument();
    expect(mocks.listCoursesPage).toHaveBeenLastCalledWith({ page: 2, search: "", teacherId: "", collegeId: "" });
    vi.unstubAllGlobals();
  });

  it("crea un curso desde el modal con colegio y profesor", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Ana Profesora" });

    await user.click(screen.getByRole("button", { name: "Nuevo Curso" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await chooseSelectValue(user, screen.getByRole("combobox", { name: "Colegio del curso" }), "college-1");
    await chooseSelectValue(user, screen.getByRole("combobox", { name: "Profesor del curso" }), "teacher-1");
    await user.type(screen.getByLabelText("Nombre"), "Física");
    await user.type(screen.getByLabelText("Descripción"), "Curso nuevo");
    await user.click(screen.getByRole("button", { name: "Crear curso" }));

    await waitFor(() => expect(mocks.createCourse).toHaveBeenCalledWith({
      name: "Física",
      description: "Curso nuevo",
      teacher_id: "teacher-1",
      college_id: "college-1",
      created_by: "admin-1",
    }));
  });

  it("edita un curso desde el modal", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Ana Profesora" });

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Colegio del curso" })).toHaveTextContent("Colegio Norte");
    expect(screen.getByRole("combobox", { name: "Profesor del curso" })).toHaveTextContent("Ana Profesora");

    const name = screen.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Álgebra II");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mocks.updateCourse).toHaveBeenCalledWith("course-1", {
      name: "Álgebra II",
      description: "Curso base",
      teacher_id: "teacher-1",
      college_id: "college-1",
    }));
  });

  it("desactiva un curso sin salir de la lista", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Ana Profesora" });

    await user.click(screen.getAllByRole("button", { name: "Desactivar" })[0]);

    await waitFor(() => expect(mocks.updateCourse).toHaveBeenCalledWith("course-1", { status: "inactive" }));
  });

  it("elimina un curso solo después de confirmar en el modal", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Ana Profesora" });

    await user.click(screen.getAllByRole("button", { name: "Eliminar" })[0]);

    const dialog = await screen.findByRole("dialog", { name: "Eliminar curso" });
    expect(within(dialog).getByText(/Esta acción es permanente/)).toBeInTheDocument();
    expect(within(dialog).getByText("Álgebra")).toBeInTheDocument();
    expect(mocks.archiveCourse).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Eliminar curso" }));

    await waitFor(() => expect(mocks.archiveCourse.mock.calls[0]?.[0]).toBe("course-1"));
  });

  it("duplica un curso solo después de confirmar", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Ana Profesora" });

    await user.click(screen.getAllByRole("button", { name: "Duplicar" })[0]);

    const dialog = await screen.findByRole("dialog", { name: "Duplicar curso" });
    expect(mocks.duplicateCourse).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Duplicar curso" }));

    await waitFor(() => expect(mocks.duplicateCourse.mock.calls[0]?.[0]).toBe("course-1"));
  });

  it("mueve un curso a otro profesor del mismo colegio", async () => {
    mocks.listUsers.mockResolvedValue([...users, { id: "teacher-3", full_name: "Carla Profesora", role: "teacher", college_id: "college-1" }]);
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Ana Profesora" });

    await user.click(screen.getAllByRole("button", { name: "Mover" })[0]);

    const dialog = await screen.findByRole("dialog", { name: "Mover curso" });
    const select = within(dialog).getByRole("combobox", { name: "Nuevo profesor" });
    const nativeSelect = dialog.querySelector("select")!;
    expect(within(nativeSelect).queryByText("Beto Profesor")).toBeNull();
    expect(within(nativeSelect).queryByText("Ana Profesora")).toBeNull();
    await chooseSelectValue(user, select, "teacher-3");
    await user.click(within(dialog).getByRole("button", { name: "Mover curso" }));

    await waitFor(() => expect(mocks.moveCourse.mock.calls[0]?.[0]).toEqual({ courseId: "course-1", teacherId: "teacher-3" }));
  });
});
