import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { AppError } from "../../lib/api/errors";
import { SignUpPage } from "./SignUpPage";

const mocks = vi.hoisted(() => ({
  listRegistrationTeachers: vi.fn(),
  validateStudentRegistration: vi.fn(),
  requestRegistrationCode: vi.fn(),
  validateRegistrationCode: vi.fn(),
  createRegistrationPayment: vi.fn(),
  getRegistrationPaymentStatus: vi.fn(),
  simulateRegistrationPayment: vi.fn(),
}));

vi.mock("../../features/registration/api", () => mocks);

function renderPage(path = "/estudiante/sign-up") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ToastProvider><MemoryRouter initialEntries={[path]}><SignUpPage /></MemoryRouter></ToastProvider></QueryClientProvider>);
}

async function fillForm(user: ReturnType<typeof userEvent.setup>, overrides: { password?: string } = {}) {
  await user.type(screen.getByLabelText("Nombres"), "Ana María");
  await user.type(screen.getByLabelText("Apellidos"), "Quispe");
  await user.type(screen.getByLabelText(/Correo electrónico/), "ana@example.com");
  await user.type(screen.getByLabelText("Celular"), "987 654 321");
  await user.type(screen.getByLabelText(/Número de documento/), "12345678");
  await user.type(screen.getByLabelText("Contraseña"), overrides.password ?? "Secreta9");
  await user.type(screen.getByLabelText("Repite tu contraseña"), overrides.password ?? "Secreta9");
  await user.click(screen.getByRole("checkbox"));
}

describe("SignUpPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.listRegistrationTeachers.mockReset().mockResolvedValue([{ id: "teacher-1", name: "Prof. Rosa Díaz" }]);
    mocks.validateStudentRegistration.mockReset()
      .mockResolvedValueOnce({ registration_id: "registration-1", email: "an*@example.com" })
      .mockResolvedValue({ registration_id: "registration-2", email: "an*@example.com" });
    mocks.requestRegistrationCode.mockReset().mockResolvedValue({
      email: "an*@example.com",
      code_expires_at: new Date(Date.now() + 600_000).toISOString(),
      resend_available_at: new Date(Date.now() + 60_000).toISOString(),
    });
    mocks.validateRegistrationCode.mockReset().mockResolvedValue({ status: "verified", registration_id: "registration-1" });
    mocks.createRegistrationPayment.mockReset().mockResolvedValue({
      payment_id: "payment-1", plan: "mensual", amount: 14.9, qr_payload: "000201010212", bank_code: null, checkout_url: null,
      expires_at: new Date(Date.now() + 1_800_000).toISOString(), livemode: false,
    });
    mocks.getRegistrationPaymentStatus.mockReset().mockResolvedValue({ payment_id: "payment-1", status: "pending", expires_at: new Date(Date.now() + 1_800_000).toISOString() });
    window.scrollTo = vi.fn();
  });

  it("starts with the plan chosen in the pricing page and lets the user switch it", async () => {
    const user = userEvent.setup();
    renderPage("/estudiante/sign-up?plan=semestral");
    expect(screen.getByRole("radio", { name: /Plan Semestral/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Plan Estudiante/ })).toHaveAttribute("aria-checked", "false");

    await user.click(screen.getByRole("radio", { name: /Plan Estudiante/ }));
    expect(screen.getByRole("radio", { name: /Plan Estudiante/ })).toHaveAttribute("aria-checked", "true");
  });

  it("falls back to the monthly plan when the URL has no valid plan", () => {
    renderPage("/estudiante/sign-up?plan=anual");
    expect(screen.getByRole("radio", { name: /Plan Estudiante/ })).toHaveAttribute("aria-checked", "true");
  });

  it("validates the data, verifies the email code and reaches the payment step", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /Grupo/ })).toHaveValue("teacher-1"));
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(mocks.validateStudentRegistration).toHaveBeenCalledTimes(1));
    expect(mocks.validateStudentRegistration.mock.calls[0]![0]).toEqual({
      teacher_id: "teacher-1",
      given_names: "Ana María",
      family_names: "Quispe",
      email: "ana@example.com",
      phone: "987 654 321",
      identity_document_type: "DNI",
      identity_document_number: "12345678",
      password: "Secreta9",
      accepted_terms: true,
      replaces_registration_id: undefined,
    });

    expect(await screen.findByText("an*@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reenviar código en/ })).toBeDisabled();
    await user.type(screen.getByLabelText("Código de verificación"), "12a3456");
    await user.click(screen.getByRole("button", { name: "Verificar correo" }));
    // Validar los datos y enviar el código son dos llamadas distintas.
    expect(mocks.requestRegistrationCode).toHaveBeenCalledWith("registration-1");
    await waitFor(() => expect(mocks.validateRegistrationCode).toHaveBeenCalledWith("registration-1", "123456"));
    expect(await screen.findByTitle("QR de pago")).toBeInTheDocument();
    expect(mocks.createRegistrationPayment).toHaveBeenCalledWith("registration-1", "mensual");
    expect(screen.getByText("S/ 14.90")).toBeInTheDocument();
  });

  it("replaces the previous registration when the user goes back to fix the email", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /Grupo/ })).toHaveValue("teacher-1"));
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Corregir mis datos" }));

    // Los datos ya escritos se conservan.
    const email = screen.getByLabelText(/Correo electrónico/);
    expect(email).toHaveValue("ana@example.com");
    await user.clear(email);
    await user.type(email, "ana.maria@example.com");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(mocks.validateStudentRegistration).toHaveBeenCalledTimes(2));
    // El nuevo envío libera el registro anterior.
    expect(mocks.validateStudentRegistration.mock.calls[1]![0]).toMatchObject({
      email: "ana.maria@example.com",
      replaces_registration_id: "registration-1",
    });
    expect(await screen.findByText("Revisa tu correo")).toBeInTheDocument();
  });

  it("keeps the saved data and lets the user retry when the code email fails", async () => {
    mocks.requestRegistrationCode.mockRejectedValueOnce(new AppError("email_unavailable", "No pudimos enviar el correo de verificación."));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /Grupo/ })).toHaveValue("teacher-1"));
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("No pudimos enviar el correo de verificación.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByText("Te enviamos el código.")).toBeInTheDocument();
    expect(mocks.requestRegistrationCode).toHaveBeenCalledTimes(2);
    expect(mocks.validateStudentRegistration).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when the groups cannot be loaded", async () => {
    mocks.listRegistrationTeachers.mockReset().mockRejectedValue(new AppError("network_error", "No se pudo conectar con el servicio."));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar la lista de grupos. Recarga la página.");
    expect(screen.getByRole("combobox", { name: /Grupo/ })).toBeDisabled();
  });

  it("shows server field errors next to the field", async () => {
    mocks.validateStudentRegistration.mockReset().mockRejectedValueOnce(new AppError("email_taken", "Este correo ya tiene una cuenta.", { field: "email" }));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /Grupo/ })).toHaveValue("teacher-1"));
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Este correo ya tiene una cuenta.")).toBeInTheDocument();
    expect(screen.queryByText("Revisa tu correo")).not.toBeInTheDocument();
  });

  it("explains what is missing in the password and rejects invalid documents", async () => {
    const user = userEvent.setup();
    renderPage();
    // Se toman una vez: al mostrar un error, este pasa a formar parte de la etiqueta.
    const password = screen.getByLabelText("Contraseña");
    const confirmation = screen.getByLabelText("Repite tu contraseña");
    expect(screen.queryByText("Tu contraseña debe tener:")).not.toBeInTheDocument();
    await user.type(password, "abc");
    expect(screen.getByText("Al menos una letra minúscula").closest("li")).toHaveTextContent("(cumplido)");
    expect(screen.getByText("Al menos una letra mayúscula").closest("li")).toHaveTextContent("(pendiente)");
    await user.clear(password);
    expect(screen.queryByText("Tu contraseña debe tener:")).not.toBeInTheDocument();
    await user.type(confirmation, "x");
    expect(screen.getByText("Tu contraseña debe tener:")).toBeInTheDocument();
    await user.clear(confirmation);

    await user.type(password, "Abcde1");
    expect(screen.getByText("Mínimo 6 caracteres").closest("li")).toHaveTextContent("(cumplido)");
    await user.type(confirmation, "Abcde2");
    await user.type(screen.getByLabelText(/Número de documento/), "1234");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("El número de documento no es válido.")).toBeInTheDocument();
    expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(mocks.validateStudentRegistration).not.toHaveBeenCalled();
  });

  it("shows and hides the password and links to the student login", async () => {
    const user = userEvent.setup();
    renderPage();
    const password = screen.getByLabelText("Contraseña");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getAllByRole("button", { name: "Mostrar contraseña" })[0]!);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/estudiante/login");
  });
});
