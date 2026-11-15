// Guía de estilo (solo desarrollo): datos y estado de la página /textura/chancon. Usan lo que existe en
// "Mi aprendizaje" más el xp por acierto (rama de gamificación), con muchos cursos como un colegio real. Se registra solo en desarrollo;
// borrar la carpeta pages/style-guide y sus rutas en app/router.tsx cuando los portales estén migrados.
import { useEffect, useRef, useState } from "react";

export type DemoView = "panel" | "curso" | "practica";
export type DemoOption = "A" | "B" | "C" | "D";

export const student = { name: "Manuel Student", role: "Estudiante" };

type DemoCourse = { id: string; name: string; description: string; percentage: number | null; sessions: number };

// Un colegio normal tiene entre 15 y 30 cursos; la demo usa 20, con algunos sin practicar.
const courseRows: [string, number | null, number][] = [
  ["Matemática", 72.5, 4], ["Comunicación", 58, 1], ["Aritmética", 81, 6], ["Álgebra", 64, 3],
  ["Geometría", 49.5, 2], ["Trigonometría", null, 0], ["Física", 55, 2], ["Química", 68, 3],
  ["Biología", 77, 5], ["Razonamiento matemático", 61, 4], ["Razonamiento verbal", 70, 2],
  ["Lenguaje", null, 0], ["Literatura", 83, 1], ["Historia del Perú", 59, 2],
  ["Historia universal", null, 0], ["Geografía", 66, 1], ["Economía", null, 0], ["Filosofía", 74, 1],
  ["Psicología", null, 0], ["Educación cívica", 52, 1],
];
export const courses: DemoCourse[] = courseRows.map(([name, percentage, sessions], i) => ({
  id: `c${i}`, name, percentage, sessions,
  description: i === 0 ? "Este es el curso de matemática." : "",
}));

const practiced = courses.filter((course) => course.percentage !== null);
export const totalScore = practiced.reduce((sum, course) => sum + course.percentage!, 0) / practiced.length;
export const totalGrade = Number((totalScore / 5).toFixed(1));
export const gradeOf = (percentage: number) => Number((percentage / 5).toFixed(1));

export const topics = [
  { id: "conj", name: "Conjuntos", percentage: 72.5 as number | null, sessions: 4, blocked: false, material: true },
  { id: "exp", name: "Leyes de exponentes", percentage: null as number | null, sessions: 0, blocked: false, material: false },
  { id: "pol", name: "Polinomios reales", percentage: null as number | null, sessions: 0, blocked: true, material: false },
  { id: "prod", name: "Productos notables", percentage: null as number | null, sessions: 0, blocked: false, material: false },
  { id: "ecu", name: "Ecuaciones lineales", percentage: null as number | null, sessions: 0, blocked: false, material: false },
];

export const XP_PER_CORRECT = 75;

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
