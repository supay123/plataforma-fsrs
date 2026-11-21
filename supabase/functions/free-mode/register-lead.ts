import { RPCS } from "../_shared/database.constants.ts";
import { clientIp } from "../_shared/complaints.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import {
  leadLogLine,
  leadSheetRow,
  parseLeadRequest,
} from "../_shared/free-mode.ts";
import { appendSheetRow } from "../_shared/google-sheets.ts";
import type { EdgeContext } from "../_shared/types.ts";
import type { RegisterLeadBody } from "./interfaces.ts";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * POST /free-mode/leads
 * El lead no se guarda en la base: solo se agrega al Google Sheet. Límites: 5
 * por IP cada hora y 3 por correo cada día (solo hashes). Con el campo trampa
 * lleno responde OK sin hacer nada. Sin hoja configurada o con Google caído
 * responde 503 leads_unavailable.
 */
export async function registerLead(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const parsed = parseLeadRequest(await readJson<RegisterLeadBody>(request));
  if (parsed.kind === "honeypot") return json({ ok: true }, 201);

  const { lead } = parsed;
  const requestId = request.headers.get("x-client-request-id") ??
    crypto.randomUUID();
  const { error } = await context.supabaseAdmin.rpc(
    RPCS.checkLeadRateLimit,
    {
      p_ip_hash: await sha256(clientIp(request)),
      p_email_hash: await sha256(lead.email),
    },
  );
  if (error?.message === "lead_ip_limit") {
    throw new AppError(
      429,
      "lead_ip_limit",
      "Too many registrations from this connection. Try again later.",
    );
  }
  if (error?.message === "lead_email_limit") {
    throw new AppError(
      429,
      "lead_email_limit",
      "This email was already registered several times today.",
    );
  }
  if (error) {
    console.error(
      leadLogLine("free_mode.lead_registration_failed", requestId, error),
    );
    throw new AppError(
      500,
      "lead_registration_failed",
      "The registration could not be processed.",
    );
  }

  try {
    const { data: sheetId, error: sheetIdError } = await context.supabaseAdmin
      .rpc(RPCS.leadsSheetId);
    if (sheetIdError) throw sheetIdError;
    if (!sheetId) {
      console.error(
        leadLogLine("free_mode.lead_sheet_not_configured", requestId),
      );
      throw new AppError(
        503,
        "leads_unavailable",
        "The registration is not available right now.",
      );
    }
    await appendSheetRow(sheetId, leadSheetRow(lead, new Date()));
  } catch (cause) {
    if (cause instanceof AppError && cause.code === "leads_unavailable") {
      throw cause;
    }
    console.error(leadLogLine("free_mode.lead_sheet_failed", requestId, cause));
    throw new AppError(
      503,
      "leads_unavailable",
      "The registration is not available right now.",
    );
  }
  return json({ ok: true }, 201);
}
