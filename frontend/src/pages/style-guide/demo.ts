// Guía de estilo (solo desarrollo): datos y estado compartidos por las páginas /textura/*. Solo usan lo
// que ya existe en "Mi aprendizaje" (sin XP, medallas ni rachas). Se registra solo en desarrollo; borrar la
// carpeta pages/style-guide y sus rutas en app/router.tsx cuando los portales estén migrados.
import { useEffect, useRef, useState } from "react";

export type DemoView = "panel" | "curso" | "practica";
export type DemoOption = "A" | "B" | "C" | "D";

export const student = { name: "Manuel Student", role: "Estudiante" };

export const courses = [
  { id: "mat", name: "Matemática", description: "Este es el curso de matemática.", percentage: 72.5, sessions: 4 },
  { id: "com", name: "Comunicación", description: "", percentage: 58, sessions: 1 },
] as const;

export const totalScore = (courses[0].percentage + courses[1].percentage) / 2;
export const totalGrade = Number((totalScore / 5).toFixed(1));

export const topics = [
  { id: "conj", name: "Conjuntos", percentage: 72.5 as number | null, sessions: 4, blocked: false, material: true },
  { id: "exp", name: "Leyes de exponentes", percentage: null as number | null, sessions: 0, blocked: false, material: false },
  { id: "pol", name: "Polinomios reales", percentage: null as number | null, sessions: 0, blocked: true, material: false },
];

export const question = {
  total: 20,
  statement: "Simplifica: $(2ab^3)^4$",
  options: [
    ["A", "$8a^4b^{12}$"],
    ["B", "$16a^4b^{12}$"],
    ["C", "$16a^4b^7$"],
    ["D", "$2a^4b^{12}$"],
  ] as const,
  correct: "B" as DemoOption,
  explanation: "Cada factor se eleva a la cuarta: $2^4 = 16$, $a^4$ y $(b^3)^4 = b^{12}$.",
};

export const LOADING_MS = 1600;

/** Navegación y estado de la pregunta de la demo. */
export function useDemo() {
  const [view, setView] = useState<DemoView>("panel");
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<DemoOption | null>(null);
  const [answered, setAnswered] = useState<DemoOption | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const startPractice = () => {
    setView("practica");
    setLoading(true);
    setIndex(0);
    setSelected(null);
    setAnswered(null);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLoading(false), LOADING_MS);
  };
  const confirm = () => { if (selected) setAnswered(selected); };
  const next = () => {
    setIndex((value) => (value + 1) % question.total);
    setSelected(null);
    setAnswered(null);
  };
  const feedback = answered ? { isCorrect: answered === question.correct, chosen: answered } : null;
  return { view, setView, loading, index, selected, setSelected, answered, feedback, startPractice, confirm, next };
}

/** Carga fuentes de Google Fonts solo mientras la página está abierta. */
export function useGoogleFonts(query: string) {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [query]);
}

export const formatPercentage = (value: number) => `${Number(value.toFixed(2))}%`;
