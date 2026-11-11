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
