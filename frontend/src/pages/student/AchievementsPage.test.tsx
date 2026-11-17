import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalProvider } from "../../components/ui/modal";
import { ToastProvider } from "../../components/ui/toast";
import { StudentAchievementsPage } from "./AchievementsPage";

const mocks = vi.hoisted(() => ({
  getStreak: vi.fn(), getLastGrades: vi.fn(), listStudentCourses: vi.fn(), courseProgress: vi.fn(),
  getMyMedal: vi.fn(), getMedalSettings: vi.fn(), getXpRules: vi.fn(),
}));
vi.mock("../../features/achievements/api", () => ({ getStreak: mocks.getStreak, getLastGrades: mocks.getLastGrades }));
vi.mock("../../features/courses/api", () => ({ listStudentCourses: mocks.listStudentCourses }));
vi.mock("../../features/progress/api", () => ({ courseProgress: mocks.courseProgress }));
vi.mock("../../features/medals/api", () => ({ getMyMedal: mocks.getMyMedal, getMedalSettings: mocks.getMedalSettings }));
vi.mock("../../features/sessions/api", () => ({ getXpRules: mocks.getXpRules }));

const range = (code: string, name: string, min: number, max: number | null) => ({ code, name, min_stars: min, max_stars: max });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ToastProvider><ModalProvider><StudentAchievementsPage /></ModalProvider></ToastProvider></QueryClientProvider>);
}

describe("StudentAchievementsPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.listStudentCourses.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    mocks.courseProgress.mockResolvedValue([{ course_id: "a", course_correct_percentage: 80 }, { course_id: "b", course_correct_percentage: 60 }]);
    mocks.getLastGrades.mockResolvedValue({ last_session: { session_id: "s", completed_at: "2026-11-15T10:00:00Z", topic_name: "Álgebra", grade: 15.5 }, last_route_lesson: { attempt_id: "a", completed_at: "2026-11-16T09:00:00Z", lesson_title: "Fracciones", grade: 18 } });
    mocks.getStreak.mockResolvedValue({ current_streak: 4, best_streak: 9, active_today: false, last_active_date: "2026-11-15", today: "2026-11-16", recent_active_days: [] });
    mocks.getXpRules.mockResolvedValue({ level: 3, xp: 40, xp_to_next: 100, xp_per_correct: 75, streak_3_bonus: 15, streak_7_bonus: 42, streak_20_bonus: 137 });
    mocks.getMyMedal.mockResolvedValue({ enabled: true, stars: 4, medal: range("postulante_2", "Postulante 2", 3, 5), next_medal: range("postulante_3", "Postulante 3", 6, 8), stars_to_next: 2 });
    mocks.getMedalSettings.mockResolvedValue({ medals: [range("postulante_2", "Postulante 2", 3, 5)], grade_ranges: [{ stars: -3, min_grade: 0, max_grade: 2 }] });
  });

  it("muestra promedio, última sesión, medalla, racha y nivel", async () => {
    renderPage();
    expect(await screen.findByLabelText("Promedio general")).toHaveTextContent("14 / 20");
    expect(await screen.findByText(/Última sesión \(Álgebra\)/)).toHaveTextContent("15.5");
    expect(screen.getByText(/Última lección del modo ruta \(Fracciones\)/)).toHaveTextContent("18");
    expect(await screen.findByText("Postulante 2", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/estrellas para/)).toHaveTextContent("faltan 2 estrellas para Postulante 3");
    expect(await screen.findByLabelText("Racha actual: 4 días")).toBeInTheDocument();
    expect(screen.getByText(/Completa una sesión hoy para no perder/)).toBeInTheDocument();
    expect(await screen.findByLabelText("Nivel 3")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "P" && /faltan 60 xp para el nivel 4/.test(element.textContent ?? ""))).toBeInTheDocument();
  });

  it("oculta la tarjeta de medalla cuando el colegio la desactivó", async () => {
    mocks.getMyMedal.mockResolvedValue({ enabled: false });
    renderPage();
    await screen.findByLabelText("Nivel 3");
    expect(screen.queryByText("Medalla")).not.toBeInTheDocument();
    expect(mocks.getMedalSettings).not.toHaveBeenCalled();
  });

  it("muestra un guion cuando aún no hay promedio", async () => {
    mocks.courseProgress.mockResolvedValue([]);
    mocks.getLastGrades.mockResolvedValue({ last_session: null, last_route_lesson: null });
    renderPage();
    expect(await screen.findByLabelText("Promedio general")).toHaveTextContent("—");
    expect(await screen.findByText("Aún no completas ninguna sesión.")).toBeInTheDocument();
  });
});
