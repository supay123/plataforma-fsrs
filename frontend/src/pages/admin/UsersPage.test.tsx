import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import { UsersPage } from "./UsersPage";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  listColleges: vi.fn(),
  listUsers: vi.fn(),
  updateUser: vi.fn(),
  listInvitations: vi.fn(),
  createInvitation: vi.fn(),
  resendInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  listRegistrationTeachers: vi.fn(),
}));

vi.mock("../../features/colleges/api", () => ({
  listColleges: mocks.listColleges,
}));
vi.mock("../../features/invitations/api", () => ({
  invitationsQueryKey: ["invitations"],
  listInvitations: mocks.listInvitations,
  createInvitation: mocks.createInvitation,
  resendInvitation: mocks.resendInvitation,
  cancelInvitation: mocks.cancelInvitation,
}));
vi.mock("../../features/registration/api", () => ({
  listRegistrationTeachers: mocks.listRegistrationTeachers,
}));
vi.mock("../../features/users/api", () => ({
  createUser: mocks.createUser,
  deleteUser: mocks.deleteUser,
  listUsers: mocks.listUsers,
  updateUser: mocks.updateUser,
  roleLabel: (role: string) => role === "teacher" ? "Profesor" : "Estudiante",
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><ModalProvider><MemoryRouter><UsersPage /></MemoryRouter></ModalProvider></ToastProvider></QueryClientProvider>);
}

describe("UsersPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.listColleges.mockResolvedValue([
      { id: "college-1", name: "Ciencias", is_active: true },
      { id: "college-2", name: "Letras", is_active: true },
    ]);
    mocks.listUsers.mockResolvedValue([
      { id: "teacher-1", college_id: "college-1", role: "teacher", user_code: "PROFE-1", full_name: "Profesor Carlos", is_active: true },
      { id: "student-1", college_id: "college-2", role: "student", user_code: "ALUMNA-1", full_name: "Ana Torres", is_active: true },
    ]);
    mocks.deleteUser.mockResolvedValue({ user_id: "teacher-1" });
    mocks.listInvitations.mockResolvedValue([{
      id: "invitation-1", email: "pendiente@example.com", college_id: null, college_name: null, teacher_id: null, teacher_name: null,
      access_valid_from: "2026-03-01", access_valid_until: "2026-12-31",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(), created_at: new Date().toISOString(),
    }]);
    mocks.listRegistrationTeachers.mockResolvedValue([
      { id: "teacher-1", name: "Profesor Carlos", college_id: "college-1", college_name: "Ciencias" },
    ]);
    mocks.createInvitation.mockResolvedValue({ id: "invitation-2" });
    mocks.resendInvitation.mockResolvedValue({ id: "invitation-1" });
    mocks.cancelInvitation.mockResolvedValue({ invitation_id: "invitation-1" });
  });

  it("filters users by college and requires confirmation before deletion", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("PROFE-1");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por colegio" }), "college-1");
    expect(within(screen.getByRole("table")).getByText("Profesor Carlos")).toBeInTheDocument();
    expect(screen.queryByText("Ana Torres")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Eliminar usuario" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));

    await waitFor(() => expect(mocks.deleteUser.mock.calls[0]?.[0]).toBe("teacher-1"));
  });

  it("explains why the demo teacher cannot be deleted instead of asking to confirm", async () => {
    const user = userEvent.setup();
    mocks.listUsers.mockResolvedValue([
      { id: "5c1f4a9e-7d2b-4c3a-9e68-0d1c4a5b7e01", college_id: "college-1", role: "teacher", user_code: "chancon-demo-profesor", full_name: "Grupo de prueba Chancón", is_active: true },
    ]);
    renderPage();

    await screen.findByText("Protegido");
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(screen.getByRole("dialog", { name: "Este usuario no se puede eliminar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar definitivamente" })).not.toBeInTheDocument();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("shows students with an expired plan as expired instead of active", async () => {
    mocks.listUsers.mockResolvedValue([
      { id: "student-1", college_id: "college-2", role: "student", user_code: "ALUMNA-1", full_name: "Ana Torres", is_active: true, access_valid_from: "2020-01-01", access_valid_until: "2020-01-31" },
      { id: "student-2", college_id: "college-2", role: "student", user_code: "ALUMNO-2", full_name: "Beto Ruiz", is_active: true, access_valid_from: "2020-01-01", access_valid_until: "2999-12-31" },
      { id: "student-3", college_id: "college-2", role: "student", user_code: "ALUMNO-3", full_name: "Cira Paz", is_active: false, access_valid_from: "2020-01-01", access_valid_until: "2020-01-31" },
    ]);
    renderPage();

    const row = (name: string) => within(screen.getByText(name).closest("tr")!);
    await screen.findByText("Ana Torres");
    expect(row("Ana Torres").getByText("Vencido")).toBeInTheDocument();
    expect(row("Ana Torres").queryByText("Activo")).not.toBeInTheDocument();
    expect(row("Beto Ruiz").getByText("Activo")).toBeInTheDocument();
    expect(row("Cira Paz").getByText("Inactivo")).toBeInTheDocument();
  });

  it("invites students by email instead of creating them directly", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("option", { name: "Profesor Carlos" });
    expect(screen.getByRole("combobox", { name: "Rol" })).toHaveValue("student");
    expect(screen.queryByLabelText("Código")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Grupo (opcional)" }), "teacher-1");
    await user.type(screen.getByLabelText("Correo del estudiante"), "nueva@example.com");
    await user.type(screen.getByLabelText("Inicio"), "2026-03-01");
    await user.type(screen.getByLabelText("Vencimiento"), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "Enviar invitación" }));

    expect(await screen.findByText("Enviamos la invitación a nueva@example.com.")).toBeInTheDocument();
    expect(mocks.createInvitation.mock.calls[0]?.[0]).toEqual({
      email: "nueva@example.com", teacher_id: "teacher-1", access_valid_from: "2026-03-01", access_valid_until: "2026-12-31",
    });
    expect(screen.getByLabelText("Correo del estudiante")).toHaveValue("");
  });

  it("lets the student choose a group when the admin does not fix one", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("option", { name: "Profesor Carlos" });

    await user.type(screen.getByLabelText("Correo del estudiante"), "libre@example.com");
    await user.type(screen.getByLabelText("Inicio"), "2026-03-01");
    await user.type(screen.getByLabelText("Vencimiento"), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "Enviar invitación" }));

    expect(await screen.findByText("Enviamos la invitación a libre@example.com.")).toBeInTheDocument();
    expect(mocks.createInvitation.mock.calls[0]?.[0]).toEqual({
      email: "libre@example.com", access_valid_from: "2026-03-01", access_valid_until: "2026-12-31",
    });
  });

  it("keeps creating teachers with a code", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("PROFE-1");
    await user.selectOptions(screen.getByRole("combobox", { name: "Rol" }), "teacher");
    expect(screen.getByLabelText("Código")).toBeInTheDocument();
    expect(screen.queryByLabelText("Correo del estudiante")).not.toBeInTheDocument();
  });

  it("resends and cancels pending invitations", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("pendiente@example.com")).toBeInTheDocument();
    expect(screen.getByText(/El estudiante elegirá su grupo · Acceso del/)).toBeInTheDocument();
    expect(screen.getByText(/Acceso del 01\/03\/2026 al 31\/12\/2026/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reenviar" }));
    expect(await screen.findByText("Reenviamos la invitación a pendiente@example.com.")).toBeInTheDocument();
    expect(mocks.resendInvitation.mock.calls[0]?.[0]).toBe("invitation-1");

    await user.click(screen.getByRole("button", { name: "Anular" }));
    expect(mocks.cancelInvitation).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Anular invitación" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Anular" }));
    await waitFor(() => expect(mocks.cancelInvitation.mock.calls[0]?.[0]).toBe("invitation-1"));
  });
});
