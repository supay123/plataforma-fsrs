import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsersPage } from "./UsersPage";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  listColleges: vi.fn(),
  listUsers: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../../features/colleges/api", () => ({
  listColleges: mocks.listColleges,
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
  return render(<QueryClientProvider client={client}><MemoryRouter><UsersPage /></MemoryRouter></QueryClientProvider>);
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
  });

  it("filters users by college and requires confirmation before deletion", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Profesor Carlos");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar por colegio" }), "college-1");
    expect(screen.getByText("Profesor Carlos")).toBeInTheDocument();
    expect(screen.queryByText("Ana Torres")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Eliminar usuario" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));

    await waitFor(() => expect(mocks.deleteUser.mock.calls[0]?.[0]).toBe("teacher-1"));
  });
});
