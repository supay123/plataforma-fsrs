import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ReviewPage } from "./ReviewPage";

vi.mock("../../features/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { role: "student" } }),
}));
vi.mock("../../features/sessions/api", () => ({
  getSessionReview: vi.fn().mockResolvedValue({
    session: {
      course_name: "Historia",
      topic_name: "Incas",
      student_id: "student-1",
      correct_count: 0,
      incorrect_count: 1,
      correct_percentage: 0,
    },
    questions: [{
      position: 1,
      statement: "¿Quién escribió la obra?",
      option_a: "Garcilaso",
      option_b: "Guamán Poma",
      option_c: "Cieza de León",
      option_d: "Titu Cusi",
      selected_option: "C",
      correct_option: "A",
      explanation: "La respuesta esperada es Garcilaso.",
      is_correct: false,
    }],
  }),
}));

describe("ReviewPage", () => {
  it("shows full option texts, the correct answer and a dashboard return link", async () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/estudiante/sesiones/session-1/revision"]}><Routes><Route path="/estudiante/sesiones/:sessionId/revision" element={<ReviewPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText("Garcilaso")).toBeInTheDocument();
    expect(screen.getByText("Cieza de León")).toBeInTheDocument();
    expect(screen.getByLabelText("Respuesta correcta")).toBeInTheDocument();
    expect(screen.getByLabelText("Tu respuesta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a mi aprendizaje" })).toHaveAttribute("href", "/estudiante");
  });
});
