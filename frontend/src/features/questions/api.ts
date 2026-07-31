import { invokeFunction } from "../../lib/api/functions";
import type { ImportResponse } from "../../types/contracts";
export async function importQuestions(body: { action: "validate" | "confirm"; topic_id: string; filename: string; file_base64: string }) { return invokeFunction<ImportResponse, typeof body>("import-questions", body); }
export async function fileToBase64(file: File) { const buffer = await file.arrayBuffer(); let binary = ""; for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte); return btoa(binary); }
