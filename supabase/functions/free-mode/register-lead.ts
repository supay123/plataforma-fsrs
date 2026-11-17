import { RPCS, TABLES } from "../_shared/database.constants.ts";
import { clientIp } from "../_shared/complaints.ts";
import { AppError, json, readJson } from "../_shared/errors.ts";
import { leadSheetRow, parseLeadRequest } from "../_shared/free-mode.ts";
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
 * Agrega el lead al Google Sheet. Es un extra tolerante: sin hoja configurada
 * o con Google caído, el lead ya está en la tabla `leads` y la respuesta es OK
 * (la fila queda con sheet_synced_at en null para poder reenviarla).
 */
async function syncToSheet(
  context: EdgeContext,
  leadId: string,
  row: string[],
): Promise<void> {
  try {
    const { data: sheetId } = await context.supabaseAdmin.rpc(
      RPCS.leadsSheetId,
    );
    if (!sheetId) return;
    await appendSheetRow(sheetId, row);
    await context.supabaseAdmin
      .from(TABLES.leads)
      .update({ sheet_synced_at: new Date().toISOString() })
      .eq("id", leadId);
  } catch (error) {
    console.error("Lead could not be added to the Google Sheet", error);
  }
}

/**
 * POST /free-mode/leads
 * Guarda a quien probó el modo gratuito. No verifica duplicados. Límites: 5 por
 * IP cada hora y 3 por correo cada día. Con el campo trampa lleno responde OK
 * sin guardar.
 */
export async function registerLead(
  request: Request,
  context: EdgeContext,
): Promise<Response> {
  const parsed = parseLeadRequest(await readJson<RegisterLeadBody>(request));
  if (parsed.kind === "honeypot") return json({ ok: true }, 201);

  const { lead } = parsed;
  const { data: leadId, error } = await context.supabaseAdmin.rpc(
    RPCS.registerLead,
    {
      p_ip_hash: await sha256(clientIp(request)),
      p_given_names: lead.given_names,
      p_family_names: lead.family_names,
      p_email: lead.email,
      p_phone: lead.phone,
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
  if (error || !leadId) {
    throw new AppError(
      500,
      "lead_registration_failed",
      "The registration could not be saved.",
    );
  }

  await syncToSheet(context, leadId, leadSheetRow(lead, new Date()));
  return json({ ok: true }, 201);
}
