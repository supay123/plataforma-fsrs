import { invokeFunction } from "../../lib/api/functions";

export async function exportData(
  filters: Record<string, string | undefined> = {},
) {
  const csv = await invokeFunction<
    string,
    Record<string, string | undefined>
  >("export-data", filters);
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fsrs-export-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
