import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/toast";
import { AuthProvider, useAuth } from "./AuthProvider";

type Listener = (event: string, session: unknown) => void;
const mocks = vi.hoisted(() => ({
  listener: null as Listener | null,
  getUser: vi.fn(),
  signOut: vi.fn(),
  profile: null as Record<string, unknown> | null,
}));

vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: Listener) => {
        mocks.listener = listener;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.profile, error: null }) }) }) }),
  },
}));

const session = { user: { id: "user-1" }, access_token: "token" };
const activeProfile = { id: "user-1", role: "student", full_name: "Ana Quispe", is_active: true };

function Portal() {
  const { loading, profile, logout } = useAuth();
  if (loading) return <p>Cargando…</p>;
  if (!profile) return <p>Sin sesión</p>;
  return <>
    <p>{profile.full_name}</p>
    <input aria-label="Borrador" />
    <button type="button" onClick={() => void logout()}>Salir</button>
  </>;
}

async function emit(event: string, next: unknown) {
  await act(async () => { mocks.listener!(event, next); });
}

async function renderSignedIn() {
  render(<ToastProvider><AuthProvider><Portal /></AuthProvider></ToastProvider>);
  await emit("INITIAL_SESSION", session);
  expect(await screen.findByText("Ana Quispe")).toBeInTheDocument();
}

describe("AuthProvider", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.profile = { ...activeProfile };
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: session.user }, error: null });
    mocks.signOut.mockReset().mockImplementation(async () => {
      mocks.listener!("SIGNED_OUT", null);
      return { error: null };
    });
  });

  it("keeps the page as it was when the user returns to the tab", async () => {
    const user = userEvent.setup();
    await renderSignedIn();
    await user.type(screen.getByLabelText("Borrador"), "texto a medio escribir");

    mocks.profile = { ...activeProfile, full_name: "Ana Lucía Quispe" };
    await emit("SIGNED_IN", session);

    // Se revisa en segundo plano y la pantalla no se desmonta.
    expect(await screen.findByText("Ana Lucía Quispe")).toBeInTheDocument();
    expect(mocks.getUser).toHaveBeenCalled();
    expect(screen.queryByText("Cargando…")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Borrador")).toHaveValue("texto a medio escribir");
  });

  it("warns when the session ends without the user signing out", async () => {
    await renderSignedIn();
    await emit("SIGNED_OUT", null);
    expect(await screen.findByText("Tu sesión ha terminado. Vuelve a conectarte.")).toBeInTheDocument();
    expect(await screen.findByText("Sin sesión")).toBeInTheDocument();
  });

  it("does not warn when the user signs out", async () => {
    const user = userEvent.setup();
    await renderSignedIn();
    await user.click(screen.getByRole("button", { name: "Salir" }));
    expect(await screen.findByText("Sin sesión")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("signs out a deactivated account when the user returns to the tab", async () => {
    await renderSignedIn();
    mocks.profile = { ...activeProfile, is_active: false };
    await emit("SIGNED_IN", session);
    expect(await screen.findByText("Tu cuenta fue desactivada. Comunícate con el administrador.")).toBeInTheDocument();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(await screen.findByText("Sin sesión")).toBeInTheDocument();
    expect(screen.queryByText("Tu sesión ha terminado. Vuelve a conectarte.")).not.toBeInTheDocument();
  });

  it("keeps the session when the check fails for network reasons", async () => {
    await renderSignedIn();
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("Failed to fetch") });
    await emit("SIGNED_IN", session);
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    expect(screen.getByText("Ana Quispe")).toBeInTheDocument();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
