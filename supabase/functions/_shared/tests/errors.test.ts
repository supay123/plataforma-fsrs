import assert from "node:assert/strict";
import { AppError, handle } from "../errors.ts";

Deno.test("serializes expected application errors without leaking a stack", async () => {
  const response = await handle(() =>
    Promise.reject(new AppError(409, "conflict", "Already exists."))
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: { code: "conflict", message: "Already exists." },
  });
});
