import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { SecurityPage } from "./SecurityPage";

const mocks = vi.hoisted(() => ({ getAccountProfile: vi.fn(), role: "student" }));

vi.mock("../../features/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { role: mocks.role, security_question: null }, refreshProfile: vi.fn() }),
}));
vi.mock("../../features/account/api", () => ({
  accountProfileQueryKey: ["account-profile"],
  getAccountProfile: mocks.getAccountProfile,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ToastProvider><SecurityPage /></ToastProvider></QueryClientProvider>);
}

const studentProfile = {
  given_names: "Ana", family_names: "Quispe", email: "ana@example.com", phone: "987654321",
  identity_document_type: "DNI", identity_document_number: "12345678", college_id: "college-1", college_name: "Colegio Uno",
};

describe("SecurityPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.role = "student";
    mocks.getAccountProfile.mockReset();
  });

  it("shows only the profile to students", async () => {
    mocks.getAccountProfile.mockResolvedValue({ ...studentProfile, email: null, given_names: null, family_names: null });
    renderPage();
    expect(await screen.findByText("Mi perfil")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restablecer contraseña" })).toBeDisabled();
    expect(screen.queryByText("Restablecer credenciales")).not.toBeInTheDocument();
    expect(screen.queryByText("Pregunta de seguridad")).not.toBeInTheDocument();
  });

  it("keeps the original page for teachers and administrators", () => {
    mocks.role = "teacher";
    renderPage();
    expect(screen.getByText("Configuración de seguridad")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restablecer credenciales" })).toBeInTheDocument();
    expect(screen.getByText("Pregunta de seguridad")).toBeInTheDocument();
    expect(mocks.getAccountProfile).not.toHaveBeenCalled();
  });
});
