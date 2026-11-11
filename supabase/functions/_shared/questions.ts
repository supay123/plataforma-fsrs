import * as XLSX from "xlsx";
import { AppError } from "./errors.ts";

export const QUESTION_COLUMNS = [
  "pregunta",
  "respuesta_a",
  "respuesta_b",
  "respuesta_c",
  "respuesta_d",
  "respuesta_correcta",
  "explicacion",
] as const;

export type QuestionColumn = typeof QUESTION_COLUMNS[number];
export type QuestionRow = Record<QuestionColumn, string>;

const REQUIRED_QUESTION_COLUMNS = QUESTION_COLUMNS.filter(
  (column) => column !== "explicacion",
);

export type QuestionIssue = {
  row: number;
  code: string;
  message: string;
};

export type QuestionValidation = {
  total: number;
  accepted: QuestionRow[];
  rejected: number;
  duplicates: number;
  issues: QuestionIssue[];
};

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function rowsFromWorkbook(base64: string): unknown[] {
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(
      atob(base64),
      (character) => character.charCodeAt(0),
    );
  } catch {
    throw new AppError(
      400,
      "invalid_excel",
      "file_base64 is not valid base64.",
    );
  }
  if (bytes.byteLength > 5 * 1024 * 1024) {
    throw new AppError(
      413,
      "file_too_large",
      "The Excel file cannot exceed 5 MB.",
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: "array",
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      dense: true,
    });
  } catch {
    throw new AppError(
      400,
      "invalid_excel",
      "The file is not a valid XLSX workbook.",
    );
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new AppError(400, "invalid_excel", "The workbook has no worksheets.");
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new AppError(400, "invalid_excel", "The workbook has no worksheets.");
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });
  const headerRow = matrix[0];
  if (!headerRow) {
    throw new AppError(400, "invalid_excel", "The worksheet is empty.");
  }
  const headers = headerRow.map((value) => cellText(value).toLowerCase());

  return matrix.slice(1).map((source) => {
    const row: Record<string, string> = {};
    for (const [index, header] of headers.entries()) {
      if (header !== "") row[header] = cellText(source[index]);
    }
    return row;
  });
}

function normalizedStatement(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export function validateQuestionRows(
  sourceRows: unknown[],
  existingStatements: string[] = [],
  existingQuestionCount = 0,
): QuestionValidation {
  const accepted: QuestionRow[] = [];
  const issues: QuestionIssue[] = [];
  const seen = new Set(existingStatements.map(normalizedStatement));
  let duplicates = 0;

  sourceRows.forEach((source, index) => {
    const rowNumber = index + 2;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      issues.push({
        row: rowNumber,
        code: "invalid_row",
        message: "The row must contain the official template columns.",
      });
      return;
    }

    const record = source as Record<string, unknown>;
    const row = Object.fromEntries(
      QUESTION_COLUMNS.map((column) => [
        column,
        typeof record[column] === "string" ? record[column].trim() : "",
      ]),
    ) as QuestionRow;

    const missing = REQUIRED_QUESTION_COLUMNS.filter(
      (column) => row[column] === "",
    );
    if (missing.length > 0) {
      issues.push({
        row: rowNumber,
        code: "missing_fields",
        message: `Missing required values: ${missing.join(", ")}.`,
      });
      return;
    }

    row.respuesta_correcta = row.respuesta_correcta.toUpperCase();
    if (!["A", "B", "C", "D"].includes(row.respuesta_correcta)) {
      issues.push({
        row: rowNumber,
        code: "invalid_correct_answer",
        message: "respuesta_correcta must be A, B, C, or D.",
      });
      return;
    }

    const statementKey = normalizedStatement(row.pregunta);
    if (seen.has(statementKey)) {
      duplicates++;
      issues.push({
        row: rowNumber,
        code: "duplicate",
        message: "The question duplicates another row or an existing question.",
      });
      return;
    }

    if (existingQuestionCount + accepted.length >= 50) {
      issues.push({
        row: rowNumber,
        code: "topic_limit",
        message: "The topic cannot contain more than 50 questions.",
      });
      return;
    }

    seen.add(statementKey);
    accepted.push(row);
  });

  return {
    total: sourceRows.length,
    accepted,
    rejected: sourceRows.length - accepted.length,
    duplicates,
    issues,
  };
}
