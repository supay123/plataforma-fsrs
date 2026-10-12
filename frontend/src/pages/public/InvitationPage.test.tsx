import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { AppError } from "../../lib/api/errors";
import { InvitationPage } from "./InvitationPage";

const mocks = vi.hoisted(() => ({ checkStudentInvitation: vi.fn(), acceptStudentInvitation: vi.fn() }));

vi.mock("../../features/invitations/api", () => mocks);

function renderPage(path = "/estudiante/invitacion?code=link-code") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><ToastProvider><MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/estudiante/invitacion" element={<InvitationPage />} />
      <Route path="/estudiante/login" element={<p>Pantalla de login</p>} />
    </Routes>
  </MemoryRouter></ToastProvider></QueryClientProvider>);
}

describe("InvitationPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.checkStudentInvitation.mockReset().mockResolvedValue({
      email: "lucia@example.com", college_name: "Colegio Uno",
      access_valid_from: "2026-03-01", access_valid_until: "2026-12-31", expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    mocks.acceptStudentInvitation.mockReset().mockResolvedValue({ status: "accepted" });
  });

  it("explains when the invitation link is not valid", async () => {
    renderPage("/estudiante/invitacion");
    expect(screen.getByText("Esta invitación no es válida")).toBeInTheDocument();
    cleanup();

    mocks.checkStudentInvitation.mockRejectedValueOnce(new AppError("invalid_invitation", "La invitación no es válida."));
    renderPage();
    expect(await screen.findByText("Esta invitación no es válida")).toBeInTheDocument();
  });

  it("shows the fixed data and creates the account with the student's data", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByLabelText("Correo electrónico")).toHaveValue("lucia@example.com");
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Institución")).toHaveValue("Colegio Uno");
    expect(screen.getByText(/del 01\/03\/2026 al 31\/12\/2026/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nombres"), "Lucía");
    await user.type(screen.getByLabelText("Apellidos"), "Mamani");
    await user.type(screen.getByLabelText("Celular"), "987654321");
    await user.type(screen.getByLabelText("Número de documento"), "12345678");
    await user.type(screen.getByLabelText("Contraseña"), "Invitada9");
    await user.type(screen.getByLabelText("Repite tu contraseña"), "Invitada9");
    await user.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
    expect(await screen.findByText("Debes aceptar los términos y la política de privacidad.")).toBeInTheDocument();
    expect(mocks.acceptStudentInvitation).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
    expect(await screen.findByText("Pantalla de login")).toBeInTheDocument();
    expect(mocks.acceptStudentInvitation).toHaveBeenCalledWith({
      code: "link-code", given_names: "Lucía", family_names: "Mamani", phone: "987654321",
      identity_document_type: "DNI", identity_document_number: "12345678", password: "Invitada9", accepted_terms: true,
    });
  });
});
