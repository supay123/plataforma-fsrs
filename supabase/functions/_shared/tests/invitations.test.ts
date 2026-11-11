import assert from "node:assert/strict";
import { invitationExpiry, invitationLink } from "../invitations.ts";

Deno.test("invitation links last seven days", () => {
  const now = new Date("2026-10-11T15:00:00Z");
  assert.equal(
    invitationExpiry("2026-12-31", now).toISOString(),
    "2026-10-18T15:00:00.000Z",
  );
});

Deno.test("invitation links never outlive the access period", () => {
  const now = new Date("2026-10-11T15:00:00Z");
  // Último momento del 13 de octubre en Lima (UTC-5).
  assert.equal(
    invitationExpiry("2026-10-13", now).toISOString(),
    "2026-10-14T04:59:59.999Z",
  );
});

Deno.test("invitation links point to the invitation page", () => {
  assert.equal(
    invitationLink("http://localhost:5173", "abc_-123"),
    "http://localhost:5173/estudiante/invitacion?code=abc_-123",
  );
});
