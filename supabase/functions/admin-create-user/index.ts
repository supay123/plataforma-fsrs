import "@supabase/functions-js/edge-runtime.d.ts";
import { withAppSupabase } from "../_shared/server.ts";
import { requireProfile, writeAudit } from "../_shared/auth.ts";
import { TABLES } from "../_shared/database.constants.ts";
import { AppError, handle, json, readJson } from "../_shared/errors.ts";
import { assertCredential, generateCredential } from "../_shared/password.ts";
import {
  assertDateOrder,
  date,
  requiredString,
  uuid,
} from "../_shared/validation.ts";
import type { CreateUserBody } from "./interfaces.ts";

export default {
  fetch: withAppSupabase(
    { auth: "user" },
    (request, context) =>
      handle(async () => {
        const admin = await requireProfile(context, ["admin"]);
        const body = await readJson<CreateUserBody>(request);
        const role = requiredString(body.role, "role", 20);
        if (role !== "teacher" && role !== "student") {
          throw new AppError(
            400,
            "validation_error",
            "role must be teacher or student.",
          );
        }
        const userCode = requiredString(body.user_code, "user_code", 100);
        const fullName = requiredString(body.full_name, "full_name", 200);
        const collegeId = uuid(body.college_id, "college_id");
        const generatedPassword = body.password === undefined;
        const password = generatedPassword
          ? generateCredential(role)
          : requiredString(body.password, "password", 200);
        try {
          assertCredential(role, password);
        } catch (error) {
          throw new AppError(
            400,
            "weak_password",
            error instanceof Error ? error.message : "Weak password.",
          );
        }

        let validFrom: string | null = null;
        let validUntil: string | null = null;
        if (role === "student") {
          validFrom = date(body.access_valid_from, "access_valid_from");
          validUntil = date(body.access_valid_until, "access_valid_until");
          assertDateOrder(validFrom, validUntil);
        }

        const { data: college, error: collegeError } = await context
          .supabaseAdmin
          .from(TABLES.colleges)
          .select("id,is_active")
          .eq("id", collegeId)
          .maybeSingle();
        if (collegeError || !college?.is_active) {
          throw new AppError(
            400,
            "invalid_college",
            "An active college is required.",
          );
        }

        const opaqueEmail = `${crypto.randomUUID()}@users.fsrs.local`;
        const { data: created, error: createError } = await context
          .supabaseAdmin
          .auth.admin.createUser({
            email: opaqueEmail,
            password,
            email_confirm: true,
            app_metadata: { role },
          });
        if (createError || !created.user) {
          throw new AppError(
            400,
            "auth_user_creation_failed",
            createError?.message ?? "Unable to create user.",
          );
        }

        const { error: profileError } = await context.supabaseAdmin
          .from(TABLES.profiles)
          .insert({
            id: created.user.id,
            college_id: collegeId,
            role,
            user_code: userCode,
            full_name: fullName,
            is_active: true,
            access_valid_from: validFrom,
            access_valid_until: validUntil,
            created_by: admin.id,
          });
        if (profileError) {
          await context.supabaseAdmin.auth.admin.deleteUser(created.user.id);
          throw new AppError(
            400,
            "profile_creation_failed",
            profileError.message,
          );
        }

        await writeAudit(
          context,
          admin,
          "user.created",
          "profile",
          created.user.id,
          { role, college_id: collegeId },
        );
        return json(
          {
            user: {
              id: created.user.id,
              role,
              user_code: userCode,
              full_name: fullName,
              college_id: collegeId,
              access_valid_from: validFrom,
              access_valid_until: validUntil,
            },
            credentials: generatedPassword
              ? { user_code: userCode, temporary_password: password }
              : undefined,
          },
          201,
        );
      }),
  ),
};
