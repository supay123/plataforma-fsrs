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
        access_valid_from: "2026-01-01",
        access_valid_until: "2027-12-31",
      },
      { token: adminToken },
      201,
    );
    const studentId = (studentCreate.user as { id: string }).id;
    const studentPin =
      (studentCreate.credentials as { temporary_password: string })
        .temporary_password;
    assert.match(studentPin, /^\d{6}$/);

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
    await jsonResponse(
      "account-security",
      {
        action: "save_recovery",
        security_question: "¿Cuál es la ciudad de integración?",
        security_answer: "Lima Norte",
      },
      { token: teacherToken },
    );
    const recoveryQuestion = await jsonResponse("recover-password", {
      action: "get_question",
      code: `TEACHER-RESET-${suffix}`,
      expected_role: "teacher",
    });
    assert.equal(
      recoveryQuestion.security_question,
      "¿Cuál es la ciudad de integración?",
    );
    await jsonResponse(
      "recover-password",
      {
        action: "reset_password",
        code: `TEACHER-RESET-${suffix}`,
        expected_role: "teacher",
        answer: "respuesta incorrecta",
      },
      {},
      401,
    );
    const recovered = await jsonResponse("recover-password", {
      action: "reset_password",
      code: `TEACHER-RESET-${suffix}`,
      expected_role: "teacher",
      answer: "  lima   norte ",
    });
    const recoveredPassword = (recovered.credentials as {
      temporary_password: string;
    }).temporary_password;
    assert.match(recoveredPassword, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/);
    await jsonResponse("login-with-code", {
      code: `TEACHER-RESET-${suffix}`,
      password: recoveredPassword,
      expected_role: "teacher",
    });
    const studentLogin = await jsonResponse("login-with-code", {
      code: `STUDENT-${suffix}`,
      password: studentPin,
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

    const rows = Array.from({ length: 20 }, (_, index) => ({
      pregunta: `What is ${index + 1} + 1?`,
      respuesta_a: String(index + 2),
      respuesta_b: String(index + 3),
      respuesta_c: String(index + 4),
      respuesta_d: String(index + 5),
      respuesta_correcta: "A",
      explicacion: index === 0 ? "Add one." : "",
    }));
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
      20,
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
        .eq("statement", "What is 2 + 1?")
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
    let questions = started.questions as Array<{
      session_question_id: string;
      question: Record<string, unknown>;
    }>;
    assert.equal(session.total_questions, 20);
    assert.equal(questions.length, 20);
    assert.equal("correct_option" in questions[0]!.question, false);
    assert.equal("explanation" in questions[0]!.question, false);

    const preservedIds = questions.slice(0, 16).map((question) => question.session_question_id);
    const { error: shrinkQuestionsError } = await adminClient
      .from(TABLES.assessmentSessionQuestions)
      .delete()
      .eq("session_id", session.id)
      .gt("position", 16);
    assert.ifError(shrinkQuestionsError);
    const { error: shrinkSessionError } = await adminClient
      .from(TABLES.assessmentSessions)
      .update({ total_questions: 16 })
      .eq("id", session.id);
    assert.ifError(shrinkSessionError);

    const resumed = await jsonResponse(
      "start-session",
      { topic_id: topic.id },
      { token: studentToken },
      201,
    );
    assert.equal((resumed.session as { id: string }).id, session.id);
    questions = resumed.questions as typeof questions;
    assert.equal(questions.length, 20);
    assert.deepEqual(
      questions.slice(0, 16).map((question) => question.session_question_id),
      preservedIds,
    );
    await jsonResponse(
      "get-session",
      { session_id: session.id },
      { token: studentToken },
    );

    await jsonResponse(
      "answer-question",
      {
        session_question_id: questions[0]!.session_question_id,
        selected_option: "A",
        response_time_ms: 1200,
      },
      { token: studentToken },
    );
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
      {
        session_id: session.id,
        answers: questions.slice(1).map((question) => ({
          session_question_id: question.session_question_id,
          selected_option: "A",
          response_time_ms: 1200,
        })),
      },
      { token: studentToken },
    );
    assert.equal(
      (completed.session as { answered_questions: number }).answered_questions,
      20,
    );
    await jsonResponse(
      "complete-session",
      { session_id: session.id, answers: [] },
      { token: studentToken },
    );

    const review = await jsonResponse(
      "get-session-review",
      { session_id: session.id },
      { token: studentToken },
    );
    assert.equal((review.questions as unknown[]).length, 20);
    assert.ok(
      "correct_option" in (review.questions as Record<string, unknown>[])[0]!,
    );
    assert.ok(
      "explanation" in (review.questions as Record<string, unknown>[])[0]!,
    );

    const scheduledSession = await jsonResponse(
      "start-session",
      { topic_id: topic.id },
      { token: studentToken },
      201,
    );
    const scheduledQuestions = scheduledSession.questions as Array<{
      selection_reason: string;
    }>;
    assert.equal(scheduledQuestions.length, 20);
    assert.ok(scheduledQuestions.every((question) => question.selection_reason === "scheduled"));

    const { data: shortTopic, error: shortTopicError } = await adminClient
      .from(TABLES.topics)
      .insert({
        course_id: course.id,
        name: `Short topic ${suffix}`,
        position: 2,
        status: "active",
        created_by: teacherId,
      })
      .select("id")
      .single();
    assert.ifError(shortTopicError);
    const { error: shortQuestionsError } = await adminClient
      .from(TABLES.questions)
      .insert(Array.from({ length: 19 }, (_, index) => ({
        topic_id: shortTopic.id,
        statement: `Short question ${index + 1}`,
        option_a: "A",
        option_b: "B",
        option_c: "C",
        option_d: "D",
        correct_option: "A",
        status: "active",
        created_by: teacherId,
      })));
    assert.ifError(shortQuestionsError);
    const insufficient = await jsonResponse(
      "start-session",
      { topic_id: shortTopic.id },
      { token: studentToken },
      409,
    );
    assert.equal(
      (insufficient.error as { code: string }).code,
      "insufficient_active_questions",
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
    assert.equal(cardCount, 20);
    assert.equal(logCount, 20);
  },
});
