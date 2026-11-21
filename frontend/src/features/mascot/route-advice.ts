import type { Advice } from "./advice";

/** Guía del administrador en el modo ruta: qué elegir a continuación según lo que ya eligió. */
export function routeAdminAdvice({ hasCollege, teacherCount, hasTeacher }: { hasCollege: boolean; teacherCount: number; hasTeacher: boolean }): Advice {
  if (!hasCollege) return { event: "rest", tone: "neutral", text: "Primero selecciona la institución." };
  if (teacherCount === 0) return { event: "wrong", tone: "warning", text: "Esta institución no tiene profesores. Elige otra institución." };
  if (!hasTeacher) return { event: "rest", tone: "neutral", text: "Ahora selecciona al profesor." };
  return { event: "correct", tone: "success", text: "Ahora sí podemos crear el modo ruta para todos los estudiantes que tenga este profesor." };
}
