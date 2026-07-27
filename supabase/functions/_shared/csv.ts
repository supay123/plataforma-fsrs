export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object"
    ? JSON.stringify(value)
    : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "\uFEFF";
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      headers.map((header) => csvCell(row[header])).join(",")
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
