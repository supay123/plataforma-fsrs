import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { AppError } from "../../lib/api/errors";
import type { AppRole } from "../../types/contracts";
import { LoginPage } from "./LoginPage";

const mocks = vi.hoisted(() => ({ requestPasswordResetLink: vi.fn() }));

vi.mock("./AuthProvider", () => ({
  useAuth: () => ({ loading: false, profile: null, session: null, login: vi.fn(), logout: vi.fn() }),
}));
vi.mock("../account/api", () => ({ requestPasswordResetLink: mocks.requestPasswordResetLink }));

function renderLogin(role: AppRole) {
  render(<ToastProvider><MemoryRouter><LoginPage role={role} /></MemoryRouter></ToastProvider>);
}

describe("LoginPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.requestPasswordResetLink.mockReset().mockResolvedValue({ status: "requested" });
  });

  it("shows placeholders in the access fields", () => {
    renderLogin("student");
    expect(screen.getByLabelText("Correo")).toHaveAttribute("placeholder", "tu@correo.com");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("placeholder", "Contraseña");
    cleanup();

    renderLogin("teacher");
    expect(screen.getByLabelText("Código")).toHaveAttribute("placeholder", "Tu código");
  });

  it("sends the reset link to the email of a student who forgot the password", async () => {
    const user = userEvent.setup();
    renderLogin("student");
    await user.click(screen.getByRole("button", { name: "¿Olvidaste tu contraseña?" }));
    expect(screen.getByRole("heading", { name: "Recuperar contraseña" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Correo"), "ana");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));
    expect(screen.getByText("Ingresa un correo válido.")).toBeInTheDocument();
    expect(mocks.requestPasswordResetLink).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Correo/), "@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));
    expect(await screen.findByText(/te enviamos un link para crear una nueva contraseña/)).toBeInTheDocument();
    expect(mocks.requestPasswordResetLink).toHaveBeenCalledWith("ana@example.com");

    await user.click(screen.getByRole("button", { name: "Inicia sesión" }));
    expect(screen.getByRole("heading", { name: "Acceso de Estudiante" })).toBeInTheDocument();
  });

  it("shows request errors in a toast", async () => {
    const user = userEvent.setup();
    mocks.requestPasswordResetLink.mockRejectedValueOnce(new AppError("network_error", "No se pudo conectar con el servicio."));
    renderLogin("student");
    await user.click(screen.getByRole("button", { name: "¿Olvidaste tu contraseña?" }));
    await user.type(screen.getByLabelText("Correo"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));
    expect(await screen.findByText("No se pudo conectar con el servicio.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeEnabled();
  });

  it("keeps the security question recovery for teachers", async () => {
    const user = userEvent.setup();
    renderLogin("teacher");
    await user.click(screen.getByRole("button", { name: "¿Olvidaste tu contraseña?" }));
    expect(screen.getByRole("heading", { name: "Restablecer contraseña" })).toBeInTheDocument();
    expect(screen.getByLabelText("Código")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Inicia sesión" }));
    expect(screen.getByRole("heading", { name: "Acceso de Profesor" })).toBeInTheDocument();
    expect(mocks.requestPasswordResetLink).not.toHaveBeenCalled();
  });
});
