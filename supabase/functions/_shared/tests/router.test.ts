import assert from "node:assert/strict";
import { AppError } from "../errors.ts";
import { functionSubpath, routeRequest } from "../router.ts";
import type { EdgeContext } from "../types.ts";

const context = {} as EdgeContext;
const ok = (label: string) => () => Promise.resolve(new Response(label));

Deno.test("reads the path after the function name", () => {
  for (
    const url of [
      "http://localhost:54321/functions/v1/registration/request-code",
      "http://edge-runtime/registration/request-code",
    ]
  ) {
    assert.equal(
      functionSubpath(new Request(url), "registration"),
      "/request-code",
    );
  }
  assert.equal(
    functionSubpath(
      new Request("http://x/registration/student/validate?a=1"),
      "registration",
    ),
    "/student/validate",
  );
  assert.equal(
    functionSubpath(new Request("http://x/registration"), "registration"),
    "/",
  );
});

Deno.test("dispatches by method and path with 404 and 405 errors", async () => {
  const routes = { "POST /request-code": ok("code"), "GET /colleges": ok("x") };
  const response = await routeRequest(
    new Request("http://x/registration/request-code", { method: "POST" }),
    context,
    "registration",
    routes,
  );
  assert.equal(await response.text(), "code");

  const statusOf = (method: string, path: string) => {
    try {
      routeRequest(
        new Request(`http://x/registration${path}`, { method }),
        context,
        "registration",
        routes,
      );
    } catch (error) {
      assert.ok(error instanceof AppError);
      return error.status;
    }
    assert.fail("Expected an AppError.");
  };
  assert.equal(statusOf("GET", "/request-code"), 405);
  assert.equal(statusOf("POST", "/unknown"), 404);
});
