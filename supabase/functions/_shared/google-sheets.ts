import { googleAccessToken } from "./gmail.ts";

const SHEETS_URL = "https://sheets.googleapis.com/v4/spreadsheets";

export class GoogleSheetsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "GoogleSheetsError";
  }
}

/** Solo el mensaje de Google (p. ej. "insufficient authentication scopes"); nunca el cuerpo completo. */
async function googleErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as
    | { error?: { message?: unknown } }
    | null;
  const message = body?.error?.message;
  return typeof message === "string" ? message : response.statusText;
}

/**
 * Agrega una fila al final de la primera hoja del documento. Usa la misma
 * cuenta de Google que envía los correos (su refresh token debe incluir el
 * scope spreadsheets). Lanza error si Google falla: quien llama decide si
 * tolerarlo.
 */
export async function appendSheetRow(
  spreadsheetId: string,
  row: string[],
): Promise<void> {
  const token = await googleAccessToken();
  // RAW: el texto se guarda tal cual, sin que Sheets interprete fórmulas.
  const url =
    `${SHEETS_URL}/${encodeURIComponent(spreadsheetId)}/values/A1:append` +
    "?valueInputOption=RAW&insertDataOption=INSERT_ROWS";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [row] }),
  });
  if (!response.ok) {
    throw new GoogleSheetsError(
      response.status,
      await googleErrorMessage(response),
    );
  }
}
