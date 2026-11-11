import assert from "node:assert/strict";
import { withAppSupabase } from "../server.ts";

Deno.test("withAppSupabase allows the application request ID during preflight", async () => {
  const handler = withAppSupabase(
    { auth: "publishable" },
    () => Promise.resolve(Response.json({ ok: true })),
  );

  const response = await handler(
    new Request("http://localhost/example", {
      method: "OPTIONS",
      headers: {
        Origin: "https://aula-fsrs.netlify.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "apikey, content-type, x-client-info, x-client-request-id",
      },
    }),
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(
    response.headers.get("Access-Control-Allow-Headers") ?? "",
    /x-client-request-id/,
  );
});
