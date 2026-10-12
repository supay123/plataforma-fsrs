import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { AppError } from "../../lib/api/errors";
import { ResetPasswordPage } from "./ResetPasswordPage";

const mocks = vi.hoisted(() => ({
  checkPasswordResetCode: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../features/account/api", () => ({
  checkPasswordResetCode: mocks.checkPasswordResetCode,
  resetPassword: mocks.resetPassword,
}));
vi.mock("../../features/auth/AuthProvider", () => ({ useAuth: () => ({ session: { user: { id: "user-1" } }, logout: mocks.logout }) }));

function renderPage(path = "/estudiante/reset?code=link-code") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ToastProvider><MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/estudiante/reset" element={<ResetPasswordPage />} />
      <Route path="/estudiante/login" element={<p>Pantalla de login</p>} />
    </Routes>
  </MemoryRouter></ToastProvider></QueryClientProvider>);
}

describe("ResetPasswordPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.checkPasswordResetCode.mockReset().mockResolvedValue({ status: "valid", expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    mocks.resetPassword.mockReset().mockResolvedValue({ status: "password_updated" });
    mocks.logout.mockReset().mockResolvedValue(undefined);
  });

  it("denies access without a code or with an invalid one", async () => {
    renderPage("/estudiante/reset");
    expect(screen.getByText("No tienes acceso a esta página")).toBeInTheDocument();
    expect(mocks.checkPasswordResetCode).not.toHaveBeenCalled();
    cleanup();

    mocks.checkPasswordResetCode.mockRejectedValueOnce(new AppError("invalid_reset_code", "El link no es válido."));
    renderPage();
    expect(await screen.findByText("No tienes acceso a esta página")).toBeInTheDocument();
    expect(mocks.checkPasswordResetCode).toHaveBeenCalledWith("link-code");
  });

  it("saves a password that follows the rules and goes to the login", async () => {
    const user = userEvent.setup();
    renderPage();
    const password = await screen.findByLabelText("Nueva contraseña");
    const confirmation = screen.getByLabelText("Repite tu contraseña");
    expect(screen.queryByText("Tu contraseña debe tener:")).not.toBeInTheDocument();

    await user.type(password, "abc");
    expect(screen.getByText("Tu contraseña debe tener:")).toBeInTheDocument();
    await user.type(confirmation, "abc");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByText("La contraseña no cumple los requisitos.")).toBeInTheDocument();
    expect(mocks.resetPassword).not.toHaveBeenCalled();

    await user.clear(password);
    await user.type(password, "Nueva123");
    await user.clear(confirmation);
    await user.type(confirmation, "Nueva123");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByText("Pantalla de login")).toBeInTheDocument();
    expect(mocks.resetPassword).toHaveBeenCalledWith("link-code", "Nueva123");
    expect(mocks.logout).toHaveBeenCalled();
  });

  it("shows the denied message when the link was already used", async () => {
    const user = userEvent.setup();
    mocks.resetPassword.mockRejectedValueOnce(new AppError("invalid_reset_code", "El link no es válido."));
    renderPage();
    await user.type(await screen.findByLabelText("Nueva contraseña"), "Nueva123");
    await user.type(screen.getByLabelText("Repite tu contraseña"), "Nueva123");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    await waitFor(() => expect(screen.getByText("No tienes acceso a esta página")).toBeInTheDocument());
  });
});
