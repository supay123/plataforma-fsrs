export function averageCourseScore(
  scores: ReadonlyArray<number | string | null | undefined>,
): number | null {
  const values = scores
    .filter((score): score is number | string => score !== null && score !== undefined)
    .map(Number)
    .filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 3 }).format(value);
}

/** Pasa un acierto en porcentaje (0 a 100) a la nota de 0 a 20 con un decimal, como en "Mi aprendizaje". */
export function percentageToGrade(percentage: number): number {
  return Number((percentage / 5).toFixed(1));
}
