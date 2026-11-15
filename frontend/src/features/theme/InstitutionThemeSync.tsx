import { useEffect } from "react";
import { useTheme } from "../../lib/theme/theme-context";
import { useAuth } from "../auth/AuthProvider";
import { fetchCollegeCode } from "./api";

/**
 * Con la sesión iniciada, la institución sale del perfil (`college_id`): se guarda su `instId` y el
 * ThemeProvider carga sus colores. Un usuario sin colegio (p. ej. el admin) no cambia el `instId`.
 */
export function InstitutionThemeSync() {
  const { profile } = useAuth();
  const { setInstId } = useTheme();
  const collegeId = profile?.college_id ?? null;
  useEffect(() => {
    if (!collegeId) return;
    let cancelled = false;
    fetchCollegeCode(collegeId).then((code) => { if (!cancelled && code) setInstId(code); }).catch(() => { /* se mantiene el tema actual */ });
    return () => { cancelled = true; };
  }, [collegeId, setInstId]);
  return null;
}
