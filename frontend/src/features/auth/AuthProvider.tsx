import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useToast } from "../../components/ui/use-toast";
import { clearAllSessionDrafts } from "../sessions/draft";
import { queryClient } from "../../lib/query/client";
import { supabase } from "../../lib/supabase/client";
import type { AppRole, LoginResponse, Profile } from "../../types/contracts";
import { invokeFunction } from "../../lib/api/functions";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  login: (code: string, password: string, role: AppRole) => Promise<void>;
  logout: () => Promise<void>;
  /** Vuelve a leer el perfil (por ejemplo, después de editar el nombre). */
  refreshProfile: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);

const SESSION_ENDED = "Tu sesión ha terminado. Vuelve a conectarte.";
const ACCOUNT_DISABLED = "Tu cuenta fue desactivada. Comunícate con el administrador.";

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("id,college_id,role,user_code,full_name,is_active,access_valid_from,access_valid_until,security_question").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const generation = useRef(0);
  const currentUserId = useRef<string | null>(null);
  // La salida pedida por el usuario (botón Salir) no muestra el aviso de sesión terminada.
  const signingOut = useRef(false);

  const sync = useCallback(async (next: Session | null) => {
    const syncGeneration = ++generation.current;
    setLoading(true);
    setProfile(null);
    await queryClient.cancelQueries();
    queryClient.clear();
    setSession(next);
    currentUserId.current = next?.user.id ?? null;
    try {
      const nextProfile = next ? await loadProfile(next.user.id) : null;
      if (generation.current !== syncGeneration) return;
      setProfile(nextProfile);
    } finally {
      if (generation.current === syncGeneration) setLoading(false);
    }
  }, []);

  /**
   * Al volver a la pestaña, revisa en segundo plano (sin recargar la pantalla)
   * que la sesión y la cuenta sigan vigentes. Si el servidor ya no reconoce la
   * sesión, Supabase la borra y avisa con SIGNED_OUT. Un error de red no saca
   * a nadie: se vuelve a revisar la próxima vez.
   */
  const revalidate = useCallback(async () => {
    const userId = currentUserId.current;
    const { error } = await supabase.auth.getUser();
    if (error || !userId) return;
    const nextProfile = await loadProfile(userId).catch(() => undefined);
    if (nextProfile === undefined || currentUserId.current !== userId) return;
    if (nextProfile?.is_active) {
      // El guard vuelve a revisar el perfil (por ejemplo, el acceso vencido del estudiante).
      setProfile(nextProfile);
      return;
    }
    toast.error(nextProfile ? ACCOUNT_DISABLED : SESSION_ENDED);
    signingOut.current = true;
    await supabase.auth.signOut({ scope: "local" });
  }, [toast]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      queueMicrotask(() => {
        if (event === "SIGNED_OUT") clearAllSessionDrafts();
        // Mismo usuario (token renovado o vuelta a la pestaña): solo se actualiza
        // la sesión, sin recargar la pantalla ni perder lo escrito.
        if (next && next.user.id === currentUserId.current) {
          setSession(next);
          if (event === "SIGNED_IN") void revalidate();
          return;
        }
        // La sesión terminó sin que el usuario saliera: al quedar sin perfil,
        // el guard lo lleva al login de su portal.
        if (event === "SIGNED_OUT" && currentUserId.current && !signingOut.current) toast.error(SESSION_ENDED);
        signingOut.current = false;
        void sync(next).catch((error) => console.error("Authentication synchronization failed", error));
      });
    });
    return () => data.subscription.unsubscribe();
  }, [sync, revalidate, toast]);

  const login = useCallback(async (code: string, password: string, role: AppRole) => {
    const result = await invokeFunction<LoginResponse, { code: string; password: string; expected_role: AppRole }>("login-with-code", { code, password, expected_role: role });
    const { data, error } = await supabase.auth.setSession({ access_token: result.session.access_token, refresh_token: result.session.refresh_token });
    if (error || !data.session) throw error ?? new Error("No se pudo guardar la sesión.");
    await sync(data.session);
  }, [sync]);

  const logout = useCallback(async () => {
    signingOut.current = true;
    clearAllSessionDrafts();
    await supabase.auth.signOut();
    await sync(null);
  }, [sync]);

  const refreshProfile = useCallback(async () => {
    const userId = currentUserId.current;
    if (!userId) return;
    const nextProfile = await loadProfile(userId);
    if (currentUserId.current === userId) setProfile(nextProfile);
  }, []);

  const value = useMemo(() => ({ session, profile, loading, login, logout, refreshProfile }), [session, profile, loading, login, logout, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return value;
}
