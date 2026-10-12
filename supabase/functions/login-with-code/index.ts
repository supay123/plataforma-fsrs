import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { RPCS } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import {
  isWithinDateRange,
  limaDate,
  requiredString,
} from "../_shared/validation.ts";
import type { AppProfile } from "../_shared/types.ts";
import type { LoginWithCodeBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "publishable" },
    (request, context) =>
      handle(async () => {
        const body = await readJson<LoginWithCodeBody>(request);
        // Los estudiantes con correo pueden entrar con él; todas las cuentas
        // siguen entrando con su código.
        const code = requiredString(body.code, "code", 254);
        const password = requiredString(body.password, "password", 200);
        const expectedRole = body.expected_role === undefined
          ? undefined
          : requiredString(body.expected_role, "expected_role", 20);

        const { data: candidates, error: profileError } = code.includes("@")
          ? await context.supabaseAdmin.rpc(RPCS.findProfileByEmail, {
            p_email: code,
          })
          : await context.supabaseAdmin.rpc(RPCS.findProfileByCode, {
            p_code: code,
          });
        if (profileError) {
          throw new AppError(
            500,
            "login_failed",
            "Unable to verify credentials.",
          );
        }

        const profile = candidates?.[0] as AppProfile | undefined;
        const invalid = () =>
          new AppError(401, "invalid_credentials", "Invalid code or password.");

        if (!profile || !profile.is_active) throw invalid();
        if (expectedRole && profile.role !== expectedRole) throw invalid();
        if (
          profile.role === "student" &&
          !isWithinDateRange(
            limaDate(),
            profile.access_valid_from,
            profile.access_valid_until,
          )
        ) {
          throw new AppError(
            403,
            "student_access_expired",
            "Student access is outside its validity period.",
          );
        }

        const { data: authUser, error: authUserError } = await context
          .supabaseAdmin
          .auth.admin.getUserById(profile.id);
        if (authUserError || !authUser.user?.email) throw invalid();

        const { data: login, error: loginError } = await context.supabase.auth
          .signInWithPassword({ email: authUser.user.email, password });
        if (loginError || !login.session) throw invalid();

        return json({
          session: login.session,
          user: {
            id: profile.id,
            code: profile.user_code,
            full_name: profile.full_name,
            role: profile.role,
            college_id: profile.college_id,
          },
        });
      }),
  ),
};
