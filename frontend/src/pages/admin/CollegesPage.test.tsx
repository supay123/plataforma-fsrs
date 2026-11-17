import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { CollegesPage } from "./CollegesPage";

const mocks = vi.hoisted(() => ({
  createCollege: vi.fn(),
  deleteCollege: vi.fn(),
  listColleges: vi.fn(),
  updateCollege: vi.fn(),
}));

vi.mock("../../features/colleges/api", () => mocks);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ModalProvider><MemoryRouter><CollegesPage /></MemoryRouter></ModalProvider></QueryClientProvider>);
}

describe("CollegesPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.listColleges.mockResolvedValue([{ id: "college-1", code: "CIEN", name: "Ciencias", description: "Colegio de ciencias", is_active: true }]);
    mocks.deleteCollege.mockResolvedValue({ college_id: "college-1", deleted_users: 2 });
  });

  it("requires confirmation before deleting a college", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Ciencias");
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(mocks.deleteCollege).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Eliminar colegio" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));

    await waitFor(() => expect(mocks.deleteCollege.mock.calls[0]?.[0]).toBe("college-1"));
  });

  it("explains why the demo college cannot be deleted instead of asking to confirm", async () => {
    const user = userEvent.setup();
    mocks.listColleges.mockResolvedValue([{ id: "demo", code: "CHANCON-DEMO", name: "Chancón – Modo gratuito", description: null, is_active: true }]);
    renderPage();

    await screen.findByText("Protegido");
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(screen.getByRole("dialog", { name: "Esta institución no se puede eliminar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar definitivamente" })).not.toBeInTheDocument();
    expect(mocks.deleteCollege).not.toHaveBeenCalled();
  });
});
