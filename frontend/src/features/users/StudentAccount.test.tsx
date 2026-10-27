import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import type { AdminStudentProfile } from "./api";
import { StudentDataCard, StudentPasswordResetCard } from "./StudentAccount";

const mocks = vi.hoisted(() => ({
  updateStudentProfile: vi.fn(),
  updateUser: vi.fn(),
  updateStudentEmail: vi.fn(),
  updateStudentGroup: vi.fn(),
  requestStudentPasswordReset: vi.fn(),
  cancelStudentPasswordReset: vi.fn(),
}));

vi.mock("./api", () => ({
  studentProfileQueryKey: (userId: string) => ["student-profile", userId],
  updateStudentProfile: mocks.updateStudentProfile,
  updateUser: mocks.updateUser,
  updateStudentEmail: mocks.updateStudentEmail,
  updateStudentGroup: mocks.updateStudentGroup,
  requestStudentPasswordReset: mocks.requestStudentPasswordReset,
  cancelStudentPasswordReset: mocks.cancelStudentPasswordReset,
}));
vi.mock("../registration/api", () => ({
  listRegistrationTeachers: async () => [
    { id: "teacher-1", name: "Ana Pérez", college_id: "college-1", college_name: "Universidad Uno" },
    { id: "teacher-2", name: "Luigi Emanual", college_id: "college-2", college_name: "Colegio Dos" },
  ],
}));

const student = { id: "student-1", full_name: "Luis Manuel Tinoco Ccoto", user_code: "20480750", is_active: true };
const profile: AdminStudentProfile = {
  given_names: "Luis Manuel",
  family_names: "Tinoco Ccoto",
  email: "luis@example.com",
  phone: "+51967799163",
  identity_document_type: "DNI",
  identity_document_number: "12345678",
  college_id: "college-1",
  college_name: "Universidad Uno",
  group_name: "Ana Pérez",
  group_teacher_ids: ["teacher-1"],
};
const emptyProfile: AdminStudentProfile = {
  ...profile, given_names: null, family_names: null, email: null, phone: null, identity_document_number: null, group_name: null, group_teacher_ids: [],
};
const inOneMinute = () => new Date(Date.now() + 60_000).toISOString();

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><ToastProvider><ModalProvider>{children}</ModalProvider></ToastProvider></QueryClientProvider>);
}

describe("StudentDataCard", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.updateStudentProfile.mockReset().mockImplementation(async (body) => ({ ...profile, ...body }));
    mocks.updateUser.mockReset().mockResolvedValue({});
    mocks.updateStudentEmail.mockReset().mockImplementation(async ({ email }) => ({ email }));
    mocks.updateStudentGroup.mockReset().mockResolvedValue({ teacher_id: "teacher-2", college_id: "college-2" });
  });

  it("shows the student's profile and saves the edited fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StudentDataCard user={student} profile={profile} />);
    expect(screen.getByLabelText("Nombres")).toHaveValue("Luis Manuel");
    expect(screen.getByLabelText("Apellidos")).toHaveValue("Tinoco Ccoto");
    expect(screen.getByLabelText("Celular")).toHaveValue("+51967799163");
    expect(screen.getByLabelText("Número de documento")).toHaveValue("12345678");
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("luis@example.com");
    expect(await screen.findByRole("option", { name: "Ana Pérez — Universidad Uno" })).toBeInTheDocument();
    expect(screen.getByLabelText("Grupo")).toHaveValue("teacher-1");
    expect(screen.getByLabelText("Código de acceso")).toHaveValue("20480750");

    await user.clear(screen.getByLabelText("Celular"));
    await user.type(screen.getByLabelText("Celular"), "987654321");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    // El botón del modal de confirmación.
    await user.click(screen.getAllByRole("button", { name: "Guardar cambios" }).at(-1)!);

    expect(mocks.updateStudentProfile).toHaveBeenCalledWith(expect.objectContaining({ user_id: "student-1", phone: "987654321" }));
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.updateStudentEmail).not.toHaveBeenCalled();
    expect(mocks.updateStudentGroup).not.toHaveBeenCalled();
  });

  it("warns how the email and group change affect the student before saving them", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StudentDataCard user={student} profile={profile} />);
    await screen.findByRole("option", { name: "Luigi Emanual — Colegio Dos" });
    await user.clear(screen.getByLabelText("Correo electrónico"));
    await user.type(screen.getByLabelText("Correo electrónico"), "nuevo@example.com");
    await user.selectOptions(screen.getByLabelText("Grupo"), "teacher-2");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText(/Su correo cambiará de luis@example.com a nuevo@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/al grupo de Luigi Emanual \(Colegio Dos\)/)).toBeInTheDocument();
    expect(screen.getByText(/Su progreso en los cursos que deja se borrará en 7 días/)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Guardar cambios" }).at(-1)!);

    expect(mocks.updateStudentEmail).toHaveBeenCalledWith({ user_id: "student-1", email: "nuevo@example.com" });
    expect(mocks.updateStudentGroup).toHaveBeenCalledWith({ user_id: "student-1", teacher_id: "teacher-2" });
    expect(mocks.updateStudentProfile).not.toHaveBeenCalled();
  });

  it("does not let the admin clear the email of a student who has one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StudentDataCard user={student} profile={profile} />);
    await user.clear(screen.getByLabelText("Correo electrónico"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Ingresa un correo válido.")).toBeInTheDocument();
    expect(mocks.updateStudentEmail).not.toHaveBeenCalled();
  });

  it("changes only the access code of an account without profile data", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StudentDataCard user={student} profile={emptyProfile} />);
    await user.clear(screen.getByLabelText("Código de acceso"));
    await user.type(screen.getByLabelText("Código de acceso"), "nuevo01");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await user.click(screen.getAllByRole("button", { name: "Guardar cambios" }).at(-1)!);

    expect(mocks.updateUser).toHaveBeenCalledWith({ user_id: "student-1", user_code: "nuevo01" });
    expect(mocks.updateStudentProfile).not.toHaveBeenCalled();
  });
});

describe("StudentPasswordResetCard", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.requestStudentPasswordReset.mockReset().mockResolvedValue({ email: "lu***@example.com", expires_at: inOneMinute(), resend_available_at: inOneMinute() });
    mocks.cancelStudentPasswordReset.mockReset().mockResolvedValue({ status: "cancelled" });
  });

  it("sends the reset link to the student's email after confirming", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StudentPasswordResetCard user={student} email="luis@example.com" />);
    await user.click(screen.getByRole("button", { name: /Enviar link de restablecimiento/ }));
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(mocks.requestStudentPasswordReset).toHaveBeenCalledWith("student-1");
    expect(await screen.findByText("lu***@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reenviar link en/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Anular link" }));
    expect(mocks.cancelStudentPasswordReset).toHaveBeenCalledWith("student-1");
  });
});
