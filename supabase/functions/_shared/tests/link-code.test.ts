import assert from "node:assert/strict";
import { appOrigin } from "../app-url.ts";
import {
  generateLinkCode,
  hashLinkCode,
  isLinkCodeFormat,
} from "../link-code.ts";
import { passwordResetLink } from "../password-reset.ts";

Deno.test("link codes are long, url-safe and unique", () => {
  const code = generateLinkCode();
  assert.ok(isLinkCodeFormat(code));
  assert.notEqual(generateLinkCode(), code);
  assert.equal(isLinkCodeFormat("23kdf234"), false);
  assert.equal(isLinkCodeFormat(`${code.slice(0, 42)}=`), false);
  assert.equal(isLinkCodeFormat(undefined), false);
});

Deno.test("only the hash of a link code is compared", async () => {
  const code = generateLinkCode();
  const hash = await hashLinkCode(code);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(await hashLinkCode(code), hash);
  assert.notEqual(await hashLinkCode(generateLinkCode()), hash);
});

Deno.test("reset links point to an allowed frontend origin", () => {
  const request = (origin?: string) =>
    new Request("http://127.0.0.1/functions/v1/account/password-reset", {
      headers: origin ? { origin } : {},
    });
  assert.equal(
    appOrigin(request("http://localhost:5173")),
    "http://localhost:5173",
  );
  assert.equal(
    appOrigin(request("https://evil.example.com")),
    "https://aula-repaso.netlify.app",
  );
  assert.equal(appOrigin(request()), "https://aula-repaso.netlify.app");
  assert.equal(
    passwordResetLink("http://localhost:5173", "abc_-123"),
    "http://localhost:5173/estudiante/reset?code=abc_-123",
  );
});
