import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { AppError } from "../../lib/api/errors";
import type { AccountProfile } from "./api";
import { ProfileSection } from "./ProfileSection";

const mocks = vi.hoisted(() => ({
  getAccountProfile: vi.fn(),
  updateAccountProfile: vi.fn(),
  requestEmailChange: vi.fn(),
  confirmEmailChange: vi.fn(),
  requestPasswordReset: vi.fn(),
  cancelPasswordReset: vi.fn(),
  refreshProfile: vi.fn(),
}));

vi.mock("./api", () => ({
  accountProfileQueryKey: ["account-profile"],
  getAccountProfile: mocks.getAccountProfile,
  updateAccountProfile: mocks.updateAccountProfile,
  requestEmailChange: mocks.requestEmailChange,
  confirmEmailChange: mocks.confirmEmailChange,
  requestPasswordReset: mocks.requestPasswordReset,
  cancelPasswordReset: mocks.cancelPasswordReset,
}));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ refreshProfile: mocks.refreshProfile }) }));

const profile: AccountProfile = {
  given_names: "Luis Manuel",
  family_names: "Tinoco Ccoto",
  email: "luis@example.com",
  phone: "+51967799163",
  identity_document_type: "DNI",
  identity_document_number: "12345678",
  college_id: "college-1",
  college_name: "Universidad Uno",
  group_name: "Ana Pérez",
};
const inOneMinute = () => new Date(Date.now() + 60_000).toISOString();

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ToastProvider><ProfileSection /></ToastProvider></QueryClientProvider>);
}

describe("ProfileSection", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.getAccountProfile.mockReset().mockResolvedValue(profile);
    mocks.updateAccountProfile.mockReset().mockImplementation(async (body) => ({ ...profile, ...body }));
    mocks.requestEmailChange.mockReset().mockResolvedValue({ email: "nu***@example.com", code_expires_at: inOneMinute(), resend_available_at: inOneMinute() });
    mocks.confirmEmailChange.mockReset().mockResolvedValue({ email: "nuevo@example.com" });
    mocks.requestPasswordReset.mockReset().mockResolvedValue({ email: "lu***@example.com", expires_at: inOneMinute(), resend_available_at: inOneMinute() });
    mocks.cancelPasswordReset.mockReset().mockResolvedValue({ status: "cancelled" });
    mocks.refreshProfile.mockReset().mockResolvedValue(undefined);
  });

  it("shows the profile data and saves the edited fields", async () => {
    const user = userEvent.setup();
    renderSection();
    expect(await screen.findByLabelText("Nombres")).toHaveValue("Luis Manuel");
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("luis@example.com");
    // El grupo (profesor) se ve, pero no se puede cambiar; la institución ya no.
    expect(screen.getByLabelText("Grupo")).toHaveValue("Ana Pérez");
    expect(screen.getByLabelText("Grupo")).toHaveAttribute("readonly");
    expect(screen.queryByLabelText("Institución")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();

    await user.clear(screen.getByLabelText("Celular"));
    await user.type(screen.getByLabelText("Celular"), "912345678");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Guardamos correctamente tus datos")).toBeInTheDocument();
    expect(mocks.updateAccountProfile).toHaveBeenCalledWith({
      given_names: "Luis Manuel",
      family_names: "Tinoco Ccoto",
      phone: "912345678",
      identity_document_type: "DNI",
      identity_document_number: "12345678",
    });
    expect(mocks.requestEmailChange).not.toHaveBeenCalled();
    expect(mocks.refreshProfile).toHaveBeenCalled();
  });

  it("verifies the new email with a code before changing it", async () => {
    const user = userEvent.setup();
    renderSection();
    const email = await screen.findByLabelText("Correo electrónico");
    await user.clear(email);
    await user.type(email, "Nuevo@Example.com");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(/Enviamos un código de 6 dígitos/)).toBeInTheDocument();
    expect(mocks.requestEmailChange).toHaveBeenCalledWith("nuevo@example.com");
    expect(mocks.updateAccountProfile).not.toHaveBeenCalled();

    mocks.confirmEmailChange.mockRejectedValueOnce(new AppError("invalid_email_code", "El código es incorrecto.", { attempts_left: 4 }));
    await user.type(screen.getByLabelText("Código de verificación"), "000000");
    await user.click(screen.getByRole("button", { name: "Verificar correo" }));
    expect(await screen.findByText("El código es incorrecto. Te quedan 4 intentos.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Código de verificación"));
    await user.type(screen.getByLabelText("Código de verificación"), "246810");
    await user.click(screen.getByRole("button", { name: "Verificar correo" }));
    expect(await screen.findByText("Listo. Desde ahora inicia sesión con nuevo@example.com.")).toBeInTheDocument();
    expect(mocks.confirmEmailChange).toHaveBeenLastCalledWith("246810");
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("nuevo@example.com");
  });

  it("asks for a Peruvian mobile number", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.clear(await screen.findByLabelText("Celular"));
    await user.type(screen.getByLabelText("Celular"), "812345678");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Ingresa un celular válido de 9 dígitos, por ejemplo 987654321.")).toBeInTheDocument();
    expect(mocks.updateAccountProfile).not.toHaveBeenCalled();
  });

  it("shows a taken email next to the field", async () => {
    const user = userEvent.setup();
    mocks.requestEmailChange.mockRejectedValueOnce(new AppError("email_taken", "Este correo ya tiene una cuenta.", { field: "email" }));
    renderSection();
    const email = await screen.findByLabelText("Correo electrónico");
    await user.clear(email);
    await user.type(email, "otro@example.com");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Este correo ya tiene una cuenta.")).toBeInTheDocument();
    expect(screen.getByText("Hubo un error al guardar tus datos")).toBeInTheDocument();
  });

  it("warns with a toast when the data could not be saved", async () => {
    const user = userEvent.setup();
    mocks.updateAccountProfile.mockRejectedValueOnce(new AppError("profile_update_failed", "No se pudieron guardar tus datos."));
    renderSection();
    await user.clear(await screen.findByLabelText("Celular"));
    await user.type(screen.getByLabelText("Celular"), "912345678");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Hubo un error al guardar tus datos")).toBeInTheDocument();
    expect(screen.queryByText("Guardamos correctamente tus datos")).not.toBeInTheDocument();
  });

  it("sends the password reset link and waits before allowing another", async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(await screen.findByRole("button", { name: "Restablecer contraseña" }));
    expect(await screen.findByText("lu***@example.com")).toBeInTheDocument();
    expect(mocks.requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Reenviar link en \d+ s/ })).toBeDisabled();
  });

  it("cancels a link that was requested by mistake", async () => {
    const user = userEvent.setup();
    renderSection();
    expect(await screen.findByRole("button", { name: "Restablecer contraseña" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restablecer contraseña" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Anulamos el link que te enviamos.");
    expect(mocks.cancelPasswordReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Restablecer contraseña" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });

  it("keeps the link and warns when it could not be cancelled", async () => {
    const user = userEvent.setup();
    mocks.cancelPasswordReset.mockRejectedValueOnce(new AppError("password_reset_failed", "No se pudo restablecer la contraseña. Inténtalo de nuevo."));
    renderSection();
    await user.click(await screen.findByRole("button", { name: "Restablecer contraseña" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(await screen.findByText("No pudimos anular el link. Inténtalo de nuevo.")).toBeInTheDocument();
    expect(screen.getByText("lu***@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("lets a student created by the administrator complete the profile without an email", async () => {
    const user = userEvent.setup();
    mocks.getAccountProfile.mockResolvedValue({
      ...profile, given_names: null, family_names: null, email: null, phone: null, identity_document_type: null, identity_document_number: null,
    });
    renderSection();
    expect(await screen.findByText("Agrega un correo a tu perfil para poder restablecer tu contraseña.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restablecer contraseña" })).toBeDisabled();

    await user.type(screen.getByLabelText("Nombres"), "Luis");
    await user.type(screen.getByLabelText("Apellidos"), "Tinoco");
    await user.type(screen.getByLabelText("Celular"), "967799163");
    await user.type(screen.getByLabelText("Número de documento"), "87654321");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Guardamos correctamente tus datos")).toBeInTheDocument();
    expect(mocks.requestEmailChange).not.toHaveBeenCalled();
  });
});
