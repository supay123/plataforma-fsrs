import { afterEach, describe, expect, it, vi } from "vitest";
import { saveCredentials } from "./save-credentials";

describe("saveCredentials", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks the browser to store the email and password where PasswordCredential exists", async () => {
    const store = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("PasswordCredential", class { data: unknown; constructor(data: unknown) { this.data = data; } });
    vi.stubGlobal("navigator", { credentials: { store } });
    await saveCredentials("ana@example.com", "Secreta9");
    expect(store).toHaveBeenCalledWith(expect.objectContaining({ data: { id: "ana@example.com", password: "Secreta9" } }));
  });

  it("does nothing in browsers without PasswordCredential", async () => {
    const store = vi.fn();
    vi.stubGlobal("navigator", { credentials: { store } });
    await saveCredentials("ana@example.com", "Secreta9");
    expect(store).not.toHaveBeenCalled();
  });

  it("never throws when the browser rejects the request", async () => {
    vi.stubGlobal("PasswordCredential", class { data: unknown; constructor(data: unknown) { this.data = data; } });
    vi.stubGlobal("navigator", { credentials: { store: vi.fn().mockRejectedValue(new Error("blocked")) } });
    await expect(saveCredentials("ana@example.com", "Secreta9")).resolves.toBeUndefined();
  });
});
