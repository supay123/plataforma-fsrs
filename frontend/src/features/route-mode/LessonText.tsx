import { MathText } from "../../lib/math";

/**
 * Texto de una lección: respeta los saltos de línea que escribió el profesor y
 * renderiza las fórmulas con KaTeX igual que las preguntas ($...$ y $$...$$).
 */
export function LessonText({ children, className }: { children: string; className?: string }) {
  return <div className={`whitespace-pre-wrap break-words ${className ?? ""}`}><MathText>{children}</MathText></div>;
}
