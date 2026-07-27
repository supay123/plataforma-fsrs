import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { TABLES } from "../_shared/database.constants.ts";
import type { InvokeOptions } from "./interfaces.ts";

const url = Deno.env.get("SUPABASE_URL");
const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY");
const secretKey = Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const enabled = Boolean(url && publishableKey && secretKey);

Deno.test({
  name: "complete authenticated Edge Function workflow",
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    assert.ok(url);
    assert.ok(publishableKey);
    assert.ok(secretKey);
    const testUrl = url as string;
    const testPublishableKey = publishableKey as string;
    const testSecretKey = secretKey as string;
    const adminClient = createClient(testUrl, testSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const suffix = crypto.randomUUID().slice(0, 8);
    const adminPassword = "AdminPass9!";
    const teacherPassword = "TeacherPass9!";
    const resetTeacherPassword = "NewTeacher9!";
    const studentPassword = "StudentPass9!";

    async function invoke(
      name: string,
      body: Record<string, unknown>,
      options: InvokeOptions = {},
    ): Promise<Response> {
      return await fetch(`${testUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": testPublishableKey,
          ...(options.token
            ? { "Authorization": `Bearer ${options.token}` }
            : {}),
        },
        body: JSON.stringify(body),
      });
    }

    async function jsonResponse(
      name: string,
      body: Record<string, unknown>,
      options: InvokeOptions = {},
      expectedStatus = 200,
    ): Promise<Record<string, unknown>> {
      const response = await invoke(name, body, options);
      const payload = await response.json();
      assert.equal(
        response.status,
        expectedStatus,
        `${name}: ${JSON.stringify(payload)}`,
      );
      return payload;
    }

    const { data: authAdmin, error: authAdminError } = await adminClient.auth
      .admin
      .createUser({
        email: `${suffix}@admin.fsrs.local`,
        password: adminPassword,
        email_confirm: true,
        app_metadata: { role: "admin" },
      });
    assert.ifError(authAdminError);
    assert.ok(authAdmin.user);

    const { error: adminProfileError } = await adminClient.from(TABLES.profiles)
      .insert({
        id: authAdmin.user.id,
        college_id: null,
        role: "admin",
        user_code: `ADMIN-${suffix}`,
        full_name: "Integration Admin",
        is_active: true,
      });
    assert.ifError(adminProfileError);

    const { data: college, error: collegeError } = await adminClient
      .from(TABLES.colleges)
      .insert({
        code: `COL-${suffix}`,
        name: `College ${suffix}`,
      })
      .select("id")
      .single();
    assert.ifError(collegeError);

    const adminLogin = await jsonResponse("login-with-code", {
      code: `ADMIN-${suffix}`,
      password: adminPassword,
      expected_role: "admin",
    });
    const adminToken =
      (adminLogin.session as { access_token: string }).access_token;

    const teacherCreate = await jsonResponse(
      "admin-create-user",
      {
        role: "teacher",
        user_code: `TEACHER-${suffix}`,
        full_name: "Integration Teacher",
        college_id: college.id,
        password: teacherPassword,
      },
      { token: adminToken },
      201,
    );
    const teacherId = (teacherCreate.user as { id: string }).id;

    const studentCreate = await jsonResponse(
      "admin-create-user",
      {
        role: "student",
        user_code: `STUDENT-${suffix}`,
        full_name: "Integration Student",
        college_id: college.id,
        password: studentPassword,
        access_valid_from: "2026-01-01",
        access_valid_until: "2027-12-31",
      },
      { token: adminToken },
      201,
    );
    const studentId = (studentCreate.user as { id: string }).id;

    await jsonResponse(
      "admin-update-user",
      { user_id: teacherId, full_name: "Updated Integration Teacher" },
      { token: adminToken },
    );
    await jsonResponse(
      "admin-reset-user-credentials",
      {
        user_id: teacherId,
        user_code: `TEACHER-RESET-${suffix}`,
        password: resetTeacherPassword,
      },
      { token: adminToken },
    );
    await jsonResponse(
      "admin-renew-access",
      {
        user_id: studentId,
        access_valid_from: "2026-01-01",
        access_valid_until: "2027-12-31",
      },
      { token: adminToken },
    );

    const teacherLogin = await jsonResponse("login-with-code", {
      code: `TEACHER-RESET-${suffix}`,
      password: resetTeacherPassword,
      expected_role: "teacher",
    });
    const teacherToken =
      (teacherLogin.session as { access_token: string }).access_token;
    const studentLogin = await jsonResponse("login-with-code", {
      code: `STUDENT-${suffix}`,
      password: studentPassword,
      expected_role: "student",
    });
    const studentToken =
      (studentLogin.session as { access_token: string }).access_token;

    const { data: course, error: courseError } = await adminClient
      .from(TABLES.courses)
      .insert({
        college_id: college.id,
        teacher_id: teacherId,
        name: `Mathematics ${suffix}`,
        created_by: teacherId,
      })
      .select("id")
      .single();
    assert.ifError(courseError);
    const { data: topic, error: topicError } = await adminClient
      .from(TABLES.topics)
      .insert({
        course_id: course.id,
        name: `Fractions ${suffix}`,
        position: 1,
        status: "active",
        created_by: teacherId,
      })
      .select("id")
      .single();
    assert.ifError(topicError);
    const { error: enrollmentError } = await adminClient
      .from(TABLES.courseEnrollments)
      .insert({
        course_id: course.id,
        student_id: studentId,
        enrolled_by: teacherId,
      });
    assert.ifError(enrollmentError);

    const rows = [
      {
        pregunta: "What is 1 + 1?",
        respuesta_a: "2",
        respuesta_b: "3",
        respuesta_c: "4",
        respuesta_d: "5",
        respuesta_correcta: "A",
        explicacion: "One plus one equals two.",
      },
      {
        pregunta: "What is 2 + 2?",
        respuesta_a: "3",
        respuesta_b: "4",
        respuesta_c: "5",
        respuesta_d: "6",
        respuesta_correcta: "B",
        explicacion: "",
      },
    ];
    const preview = await jsonResponse(
      "import-questions",
      {
        action: "validate",
        topic_id: topic.id,
        filename: "questions.xlsx",
        rows,
      },
      { token: teacherToken },
    );
    assert.equal(
      (preview.report as { accepted: number }).accepted,
      2,
    );
    await jsonResponse(
      "import-questions",
      {
        action: "confirm",
        topic_id: topic.id,
        filename: "questions.xlsx",
        rows,
      },
      { token: teacherToken },
      201,
    );
    const { data: questionWithoutExplanation, error: explanationError } =
      await adminClient
        .from(TABLES.questions)
        .select("explanation")
        .eq("topic_id", topic.id)
        .eq("statement", "What is 2 + 2?")
        .single();
    assert.ifError(explanationError);
    assert.equal(questionWithoutExplanation.explanation, null);

    const started = await jsonResponse(
      "start-session",
      { topic_id: topic.id },
      { token: studentToken },
      201,
    );
    const session = started.session as { id: string; total_questions: number };
    const questions = started.questions as Array<{
      session_question_id: string;
      question: Record<string, unknown>;
    }>;
    assert.equal(session.total_questions, 2);
    assert.equal(questions.length, 2);
    assert.equal("correct_option" in questions[0]!.question, false);
    assert.equal("explanation" in questions[0]!.question, false);

    const resumed = await jsonResponse(
      "start-session",
      { topic_id: topic.id },
      { token: studentToken },
      201,
    );
    assert.equal((resumed.session as { id: string }).id, session.id);
    await jsonResponse(
      "get-session",
      { session_id: session.id },
      { token: studentToken },
    );

    for (const question of questions) {
      await jsonResponse(
        "answer-question",
        {
          session_question_id: question.session_question_id,
          selected_option: "A",
          response_time_ms: 1200,
        },
        { token: studentToken },
      );
    }
    const retry = await jsonResponse(
      "answer-question",
      {
        session_question_id: questions[0]!.session_question_id,
        selected_option: "A",
        response_time_ms: 1200,
      },
      { token: studentToken },
    );
    assert.equal(retry.status, "already_answered");

    const completed = await jsonResponse(
      "complete-session",
      { session_id: session.id },
      { token: studentToken },
    );
    assert.equal(
      (completed.session as { answered_questions: number }).answered_questions,
      2,
    );
    await jsonResponse(
      "complete-session",
      { session_id: session.id },
      { token: studentToken },
    );

    const review = await jsonResponse(
      "get-session-review",
      { session_id: session.id },
      { token: studentToken },
    );
    assert.equal((review.questions as unknown[]).length, 2);
    assert.ok(
      "correct_option" in (review.questions as Record<string, unknown>[])[0]!,
    );
    assert.ok(
      "explanation" in (review.questions as Record<string, unknown>[])[0]!,
    );

    const exportResponse = await invoke(
      "export-data",
      { course_id: course.id },
      { token: teacherToken, raw: true },
    );
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get("content-type") ?? "", /text\/csv/);
    assert.match(await exportResponse.text(), /session_id/);

    const [{ count: cardCount, error: cardsError }, {
      count: logCount,
      error: logsError,
    }] = await Promise.all([
      adminClient.from(TABLES.studentQuestionCards).select("*", {
        count: "exact",
        head: true,
      }).eq("student_id", studentId),
      adminClient.from(TABLES.fsrsReviewLogs).select("*", {
        count: "exact",
        head: true,
      }).eq("student_id", studentId),
    ]);
    assert.ifError(cardsError);
    assert.ifError(logsError);
    assert.equal(cardCount, 2);
    assert.equal(logCount, 2);
  },
});
