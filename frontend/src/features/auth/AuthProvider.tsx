import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
}
const AuthContext = createContext<AuthState | null>(null);

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("id,college_id,role,user_code,full_name,is_active,access_valid_from,access_valid_until").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const sync = useCallback(async (next: Session | null) => {
    setSession(next);
    setProfile(next ? await loadProfile(next.user.id) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => sync(data.session)).catch(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { queueMicrotask(() => void sync(next)); });
    return () => data.subscription.unsubscribe();
  }, [sync]);

  const login = useCallback(async (code: string, password: string, role: AppRole) => {
    const result = await invokeFunction<LoginResponse, { code: string; password: string; expected_role: AppRole }>("login-with-code", { code, password, expected_role: role });
    const { data, error } = await supabase.auth.setSession({ access_token: result.session.access_token, refresh_token: result.session.refresh_token });
    if (error || !data.session) throw error ?? new Error("No se pudo guardar la sesión.");
    await sync(data.session);
  }, [sync]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    await sync(null);
  }, [sync]);

  const value = useMemo(() => ({ session, profile, loading, login, logout }), [session, profile, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return value;
}
