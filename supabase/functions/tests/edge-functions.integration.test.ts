import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { TABLES } from "../_shared/database.constants.ts";
import type { Database } from "../_shared/database.types.ts";
import { hashEmailCode } from "../_shared/email-code.ts";
import { generateLinkCode, hashLinkCode } from "../_shared/link-code.ts";
import { planPeriod } from "../_shared/plans.ts";
import { activateStudentRegistration } from "../_shared/registration-activation.ts";
import type { InvokeOptions } from "./interfaces.ts";
import { TestData } from "./test-data.ts";

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
    // Todo lo que crea el test se borra al terminar, pase o falle.
    await using created = new TestData(adminClient);
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
    created.user(authAdmin.user.id);

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
    created.college(college.id);

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
    const teacherId = created.user((teacherCreate.user as { id: string }).id);

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
    const studentId = created.user((studentCreate.user as { id: string }).id);
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
      "practice-session/start",
      { topic_id: topic.id },
      { token: studentToken },
      201,
    );
    const session = started.session as { id: string; total_questions: number };
    let questions = started.questions as Array<{
      session_question_id: string;
      question: Record<string, unknown>;
      feedback: unknown;
    }>;
    assert.equal(session.total_questions, 20);
    assert.equal(questions.length, 20);
    assert.equal("correct_option" in questions[0]!.question, false);
    assert.equal("explanation" in questions[0]!.question, false);

    // The answer key ships encrypted and decrypts with the key it carries.
    const answerKey = started.answer_key as {
      algorithm: string;
      key: string;
      items: Record<string, { iv: string; data: string }>;
    };
    assert.equal(answerKey.algorithm, "AES-GCM");
    assert.equal(Object.keys(answerKey.items).length, 20);
    assert.ok(!JSON.stringify(answerKey.items).includes("correct_option"));
    const fromBase64 = (value: string) =>
      Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      fromBase64(answerKey.key),
      "AES-GCM",
      false,
      ["decrypt"],
    );
    const firstItem = answerKey.items[questions[0]!.session_question_id]!;
    const decrypted = JSON.parse(
      new TextDecoder().decode(
        await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: fromBase64(firstItem.iv) },
          cryptoKey,
          fromBase64(firstItem.data),
        ),
      ),
    );
    assert.equal(decrypted.correct_option, "A");
    assert.ok("explanation" in decrypted);

    const preservedIds = questions.slice(0, 16).map((question) =>
      question.session_question_id
    );
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
      "practice-session/start",
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
    assert.ok(questions.every((question) => question.feedback === null));

    // Every pending question must be submitted at once.
    const incomplete = await jsonResponse(
      "practice-session/submit",
      {
        session_id: session.id,
        answers: questions.slice(1).map((question) => ({
          session_question_id: question.session_question_id,
          selected_option: "A",
          response_time_ms: 1200,
        })),
      },
      { token: studentToken },
      409,
    );
    assert.equal(
      (incomplete.error as { code: string }).code,
      "incomplete_submission",
    );

    const completed = await jsonResponse(
      "practice-session/submit",
      {
        session_id: session.id,
        answers: questions.map((question) => ({
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
      "practice-session/submit",
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
      "practice-session/start",
      { topic_id: topic.id },
      { token: studentToken },
      201,
    );
    const scheduledQuestions = scheduledSession.questions as Array<{
      selection_reason: string;
    }>;
    assert.equal(scheduledQuestions.length, 20);
    assert.ok(
      scheduledQuestions.every((question) =>
        question.selection_reason === "scheduled"
      ),
    );

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
      "practice-session/start",
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

    const adminSessionClient = createClient(testUrl, testPublishableKey, {
      global: { headers: { Authorization: `Bearer ${adminToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const teacherSessionClient = createClient(testUrl, testPublishableKey, {
      global: { headers: { Authorization: `Bearer ${teacherToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: assignmentError } = await adminSessionClient.rpc(
      "admin_sync_teacher_students",
      { p_teacher_id: teacherId, p_student_ids: [studentId] },
    );
    assert.ifError(assignmentError);

    const { error: topicBlockError } = await adminSessionClient
      .from(TABLES.studentTopicAccess)
      .upsert({
        student_id: studentId,
        topic_id: shortTopic.id,
        is_blocked: true,
        updated_by: authAdmin.user.id,
      }, { onConflict: "student_id,topic_id" });
    assert.ifError(topicBlockError);

    const { error: blockCourseError } = await adminSessionClient
      .from(TABLES.courseEnrollments)
      .update({ status: "inactive", ended_at: new Date().toISOString() })
      .eq("course_id", course.id)
      .eq("student_id", studentId);
    assert.ifError(blockCourseError);

    const { data: hiddenTopicRows, error: hiddenTopicError } =
      await adminSessionClient
        .from("v_student_topic_access_status")
        .select("topic_id")
        .eq("topic_id", shortTopic.id)
        .eq("student_id", studentId);
    assert.ifError(hiddenTopicError);
    assert.equal(hiddenTopicRows.length, 0);

    const { error: resyncError } = await adminSessionClient.rpc(
      "admin_sync_teacher_students",
      { p_teacher_id: teacherId, p_student_ids: [studentId] },
    );
    assert.ifError(resyncError);
    const { data: preservedEnrollment, error: preservedEnrollmentError } =
      await adminClient.from(TABLES.courseEnrollments)
        .select("status")
        .eq("course_id", course.id)
        .eq("student_id", studentId)
        .single();
    assert.ifError(preservedEnrollmentError);
    assert.equal(preservedEnrollment.status, "inactive");

    const { error: restoreCourseError } = await adminSessionClient
      .from(TABLES.courseEnrollments)
      .update({ status: "active", ended_at: null })
      .eq("course_id", course.id)
      .eq("student_id", studentId);
    assert.ifError(restoreCourseError);
    const { data: restoredTopic, error: restoredTopicError } =
      await adminSessionClient
        .from("v_student_topic_access_status")
        .select("is_blocked")
        .eq("topic_id", shortTopic.id)
        .eq("student_id", studentId)
        .single();
    assert.ifError(restoredTopicError);
    assert.equal(restoredTopic.is_blocked, true);

    const { error: deactivateStudentError } = await adminClient
      .from(TABLES.profiles)
      .update({ is_active: false })
      .eq("id", studentId);
    assert.ifError(deactivateStudentError);
    const { data: futureCourse, error: futureCourseError } =
      await teacherSessionClient.from(TABLES.courses).insert({
        college_id: college.id,
        teacher_id: teacherId,
        name: `Future course ${suffix}`,
        created_by: teacherId,
      }).select("id").single();
    assert.ifError(futureCourseError);
    const { count: futureEnrollmentCount, error: futureEnrollmentError } =
      await adminClient.from(TABLES.courseEnrollments).select("*", {
        count: "exact",
        head: true,
      }).eq("course_id", futureCourse.id).eq("student_id", studentId);
    assert.ifError(futureEnrollmentError);
    assert.equal(futureEnrollmentCount, 1);

    const secondTeacherCreate = await jsonResponse(
      "admin-create-user",
      {
        role: "teacher",
        user_code: `TEACHER-SECOND-${suffix}`,
        full_name: "Second Integration Teacher",
        college_id: college.id,
        password: teacherPassword,
      },
      { token: adminToken },
      201,
    );
    const secondTeacherId = created.user(
      (secondTeacherCreate.user as { id: string }).id,
    );
    const { data: secondTeacherCourse, error: secondTeacherCourseError } =
      await adminClient.from(TABLES.courses).insert({
        college_id: college.id,
        teacher_id: secondTeacherId,
        name: `Second teacher course ${suffix}`,
        created_by: secondTeacherId,
      }).select("id").single();
    assert.ifError(secondTeacherCourseError);
    const { error: secondAssignmentError } = await adminSessionClient.rpc(
      "admin_sync_teacher_students",
      { p_teacher_id: secondTeacherId, p_student_ids: [studentId] },
    );
    assert.ifError(secondAssignmentError);
    const {
      count: secondTeacherEnrollmentCount,
      error: secondTeacherEnrollmentError,
    } = await adminClient.from(TABLES.courseEnrollments).select("*", {
      count: "exact",
      head: true,
    }).eq("course_id", secondTeacherCourse.id).eq("student_id", studentId);
    assert.ifError(secondTeacherEnrollmentError);
    assert.equal(secondTeacherEnrollmentCount, 1);

    const { error: forbiddenSyncError } = await teacherSessionClient.rpc(
      "admin_sync_teacher_students",
      { p_teacher_id: teacherId, p_student_ids: [studentId] },
    );
    assert.ok(forbiddenSyncError);
    assert.equal(forbiddenSyncError.code, "42501");

    const teacherWithoutCourses = await jsonResponse(
      "admin-create-user",
      {
        role: "teacher",
        user_code: `TEACHER-EMPTY-${suffix}`,
        full_name: "Teacher Without Courses",
        college_id: college.id,
        password: teacherPassword,
      },
      { token: adminToken },
      201,
    );
    created.user((teacherWithoutCourses.user as { id: string }).id);
    const { error: emptyTeacherError } = await adminSessionClient.rpc(
      "admin_sync_teacher_students",
      {
        p_teacher_id: (teacherWithoutCourses.user as { id: string }).id,
        p_student_ids: [studentId],
      },
    );
    assert.ok(emptyTeacherError);
    assert.match(emptyTeacherError.message, /at least one course/i);

    const { error: unassignError } = await adminSessionClient.rpc(
      "admin_sync_teacher_students",
      { p_teacher_id: teacherId, p_student_ids: [] },
    );
    assert.ifError(unassignError);
    const { count: firstTeacherRemaining, error: firstTeacherRemainingError } =
      await adminClient.from(TABLES.courseEnrollments)
        .select("course_id,courses!inner(teacher_id)", {
          count: "exact",
          head: true,
        })
        .eq("student_id", studentId)
        .eq("courses.teacher_id", teacherId);
    assert.ifError(firstTeacherRemainingError);
    assert.equal(firstTeacherRemaining, 0);
    const {
      count: secondTeacherRemaining,
      error: secondTeacherRemainingError,
    } = await adminClient.from(TABLES.courseEnrollments)
      .select("course_id,courses!inner(teacher_id)", {
        count: "exact",
        head: true,
      })
      .eq("student_id", studentId)
      .eq("courses.teacher_id", secondTeacherId);
    assert.ifError(secondTeacherRemainingError);
    assert.equal(secondTeacherRemaining, 1);

    const teacherWithoutCoursesId =
      (teacherWithoutCourses.user as { id: string }).id;
    await jsonResponse(
      "admin-delete-user",
      { user_id: teacherWithoutCoursesId },
      { token: adminToken },
    );
    const { data: deletedTeacherProfile, error: deletedTeacherProfileError } =
      await adminClient.from(TABLES.profiles).select("id")
        .eq("id", teacherWithoutCoursesId).maybeSingle();
    assert.ifError(deletedTeacherProfileError);
    assert.equal(deletedTeacherProfile, null);

    const collegeDeletion = await jsonResponse(
      "admin-delete-college",
      { college_id: college.id },
      { token: adminToken },
    );
    assert.equal(collegeDeletion.college_id, college.id);
    assert.equal(collegeDeletion.deleted_users, 3);
    const [{ data: deletedCollege, error: deletedCollegeError }, {
      count: remainingCollegeProfiles,
      error: remainingCollegeProfilesError,
    }] = await Promise.all([
      adminClient.from(TABLES.colleges).select("id").eq("id", college.id)
        .maybeSingle(),
      adminClient.from(TABLES.profiles).select("id", {
        count: "exact",
        head: true,
      })
        .eq("college_id", college.id),
    ]);
    assert.ifError(deletedCollegeError);
    assert.ifError(remainingCollegeProfilesError);
    assert.equal(deletedCollege, null);
    assert.equal(remainingCollegeProfiles, 0);
  },
});

Deno.test({
  name: "student self-registration verifies the email and activates on payment",
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const testUrl = url as string;
    const testPublishableKey = publishableKey as string;
    const adminClient = createClient<Database>(testUrl, secretKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await using created = new TestData(adminClient);
    const suffix = crypto.randomUUID().slice(0, 8);
    const password = "Registro9";

    async function call(
      path: string,
      body: Record<string, unknown> | null,
      expectedStatus = 200,
    ): Promise<Record<string, unknown>> {
      const response = await fetch(`${testUrl}/functions/v1/${path}`, {
        method: body === null ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": testPublishableKey,
        },
        body: body === null ? undefined : JSON.stringify(body),
      });
      const payload = await response.json();
      assert.equal(
        response.status,
        expectedStatus,
        `${path}: ${JSON.stringify(payload)}`,
      );
      return payload;
    }

    const { data: college, error: collegeError } = await adminClient
      .from(TABLES.colleges)
      .insert({ code: `REG-${suffix}`, name: `Registro ${suffix}` })
      .select("id")
      .single();
    assert.ifError(collegeError);
    created.college(college.id);

    const listed = await call("public/colleges", null);
    assert.ok(
      (listed.colleges as Array<{ id: string }>).some((item) =>
        item.id === college.id
      ),
    );
    // Cada endpoint responde solo a su método y ruta.
    await call("public/colleges", {}, 405);
    await call("registration/unknown", {}, 404);

    // El grupo es un profesor: solo se listan los que tienen algún curso.
    const { data: teacherUser, error: teacherUserError } = await adminClient
      .auth.admin.createUser({
        email: `profe.${suffix}@teachers.invalid`,
        password: "Profesor9",
        email_confirm: true,
      });
    assert.ifError(teacherUserError);
    const teacherId = created.user(teacherUser.user.id);
    const { error: teacherError } = await adminClient.from(TABLES.profiles)
      .insert({
        id: teacherId,
        college_id: college.id,
        role: "teacher",
        user_code: `PROFE-${suffix}`,
        full_name: `Profesor ${suffix}`,
        is_active: true,
      });
    assert.ifError(teacherError);
    const listsTeacher = async () =>
      ((await call("public/teachers", null)).teachers as Array<{ id: string }>)
        .some((item) => item.id === teacherId);
    assert.equal(await listsTeacher(), false);
    const { data: firstCourse, error: firstCourseError } = await adminClient
      .from(TABLES.courses)
      .insert({
        college_id: college.id,
        teacher_id: teacherId,
        name: `Curso ${suffix}`,
        created_by: teacherId,
      })
      .select("id")
      .single();
    assert.ifError(firstCourseError);
    assert.equal(await listsTeacher(), true);

    const form = {
      teacher_id: teacherId,
      given_names: "Ana María",
      family_names: "Quispe",
      email: `ana.${suffix}@example.com`,
      phone: "987654321",
      identity_document_type: "DNI",
      identity_document_number: "12345678",
      password,
      accepted_terms: true,
    };
    const invalidDocument = await call(
      "registration/student/validate",
      { ...form, identity_document_number: "123" },
      400,
    );
    assert.equal(
      (invalidDocument.error as { details: { field: string } }).details.field,
      "identity_document_number",
    );
    const invalidTeacher = await call(
      "registration/student/validate",
      { ...form, teacher_id: crypto.randomUUID() },
      400,
    );
    assert.equal(
      (invalidTeacher.error as { code: string }).code,
      "invalid_teacher",
    );

    const firstStart = await call("registration/student/validate", form, 201);
    assert.match(firstStart.email as string, /^an\*+@example\.com$/);

    // El usuario vuelve a corregir su correo: el registro anterior se reemplaza
    // en lugar de bloquear el nuevo envío.
    const correctedEmail = `ana.maria.${suffix}@example.com`;
    const started = await call(
      "registration/student/validate",
      {
        ...form,
        email: correctedEmail,
        replaces_registration_id: firstStart.registration_id,
      },
      201,
    );
    const registrationId = started.registration_id as string;
    const { count: previousRegistrations, error: previousError } =
      await adminClient
        .from(TABLES.studentRegistrations)
        .select("id", { count: "exact", head: true })
        .eq("id", firstStart.registration_id as string);
    assert.ifError(previousError);
    assert.equal(previousRegistrations, 0);

    // Validar los datos no envía el código: se pide aparte.
    const { data: unsent, error: unsentError } = await adminClient
      .from(TABLES.studentRegistrations)
      .select("email_code_send_count")
      .eq("id", registrationId)
      .single();
    assert.ifError(unsentError);
    assert.equal(unsent.email_code_send_count, 0);

    const delivery = await call("registration/request-code", {
      registration_id: registrationId,
    });
    assert.match(delivery.email as string, /^an\*+@example\.com$/);
    assert.ok(delivery.resend_available_at);
    await call(
      "registration/request-code",
      { registration_id: registrationId },
      429,
    );
    const wrong = await call(
      "registration/validateCode",
      { registration_id: registrationId, code: "000000" },
      400,
    );
    assert.equal((wrong.error as { code: string }).code, "invalid_email_code");

    // El código real solo llega por correo: el test fija uno conocido.
    const { error: codeError } = await adminClient
      .from(TABLES.studentRegistrations)
      .update({
        email_code_hash: await hashEmailCode(registrationId, "135790"),
      })
      .eq("id", registrationId);
    assert.ifError(codeError);
    const verified = await call("registration/validateCode", {
      registration_id: registrationId,
      code: "135790",
    });
    assert.equal(verified.status, "verified");

    // Mercado Pago aprobó el pago del plan semestral (no se le llama en el test).
    const paymentId = crypto.randomUUID();
    const { error: paymentError } = await adminClient
      .from(TABLES.planPayments)
      .insert({
        id: paymentId,
        provider_payment_id: `mp_test_${suffix}`,
        livemode: false,
        plan: "semestral",
        amount: 77.4,
        registration_id: registrationId,
        email: correctedEmail,
        status: "succeeded",
        paid_at: new Date().toISOString(),
      });
    assert.ifError(paymentError);

    const activated = await activateStudentRegistration(
      adminClient,
      paymentId,
    );
    created.user(activated.user_id);

    const { data: payment, error: appliedError } = await adminClient
      .from(TABLES.planPayments)
      .select("profile_id,period_start,period_end,registration_id")
      .eq("id", paymentId)
      .single();
    assert.ifError(appliedError);
    assert.equal(payment.profile_id, activated.user_id);
    assert.equal(payment.period_end, activated.period.period_end);
    assert.equal(payment.registration_id, null);
    // Un aviso repetido no vuelve a activar.
    await assert.rejects(
      activateStudentRegistration(adminClient, paymentId),
    );
    const { data: profile, error: profileError } = await adminClient
      .from(TABLES.profiles)
      .select(
        "full_name,email,phone,identity_document_type,identity_document_number,access_valid_from,access_valid_until",
      )
      .eq("id", activated.user_id)
      .single();
    assert.ifError(profileError);
    assert.equal(profile.full_name, "Ana María Quispe");
    assert.equal(profile.email, correctedEmail);
    assert.equal(profile.identity_document_type, "DNI");
    assert.equal(profile.access_valid_until, activated.period.period_end);
    assert.equal(
      activated.period.period_end,
      planPeriod(activated.access_valid_from, "semestral").period_end,
    );
    assert.ok(activated.user_code.startsWith(`ana.maria.${suffix}`));

    // Queda inscrito en los cursos del profesor, también en los que cree después.
    const { data: laterCourse, error: laterCourseError } = await adminClient
      .from(TABLES.courses)
      .insert({
        college_id: college.id,
        teacher_id: teacherId,
        name: `Curso nuevo ${suffix}`,
        created_by: teacherId,
      })
      .select("id")
      .single();
    assert.ifError(laterCourseError);
    const { data: enrollments, error: enrollmentsError } = await adminClient
      .from(TABLES.courseEnrollments)
      .select("course_id")
      .eq("student_id", activated.user_id)
      .eq("status", "active");
    assert.ifError(enrollmentsError);
    assert.deepEqual(
      enrollments.map((row) => row.course_id).sort(),
      [firstCourse.id, laterCourse.id].sort(),
    );

    // Entra con su correo (sin importar mayúsculas) y también con el código
    // generado, que es lo que ven el administrador y los profesores.
    for (
      const identifier of [correctedEmail.toUpperCase(), activated.user_code]
    ) {
      const login = await fetch(`${testUrl}/functions/v1/login-with-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": testPublishableKey,
        },
        body: JSON.stringify({
          code: identifier,
          password,
          expected_role: "student",
        }),
      });
      assert.equal(login.status, 200, await login.clone().text());
      await login.body?.cancel();
    }
  },
});

Deno.test({
  name: "student profile edits, email change and password reset by link",
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const testUrl = url as string;
    const testPublishableKey = publishableKey as string;
    const adminClient = createClient<Database>(testUrl, secretKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await using created = new TestData(adminClient);
    const newClient = () =>
      createClient<Database>(testUrl, testPublishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const suffix = crypto.randomUUID().slice(0, 8);
    // Fecha fija en el pasado: no depende de la zona horaria de Lima.
    const accessFrom = "2026-01-01";

    async function call(
      path: string,
      init: { method?: string; body?: unknown; token?: string },
      expectedStatus = 200,
    ): Promise<Record<string, unknown>> {
      const response = await fetch(`${testUrl}/functions/v1/${path}`, {
        method: init.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": testPublishableKey,
          ...(init.token ? { "Authorization": `Bearer ${init.token}` } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const payload = await response.json();
      assert.equal(
        response.status,
        expectedStatus,
        `${path}: ${JSON.stringify(payload)}`,
      );
      return payload;
    }
    const errorCode = (payload: Record<string, unknown>) =>
      (payload.error as { code: string }).code;

    const { data: college, error: collegeError } = await adminClient
      .from(TABLES.colleges)
      .insert({ code: `PRF-${suffix}`, name: `Perfil ${suffix}` })
      .select("id")
      .single();
    assert.ifError(collegeError);
    created.college(college.id);
    const collegeId = college.id;

    async function createStudent(
      label: string,
      email: string | null,
    ): Promise<{ id: string; authEmail: string; password: string }> {
      const authEmail = email ?? `${label}.${suffix}@students.invalid`;
      const password = "Inicial9";
      const { data, error } = await adminClient.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
      });
      assert.ifError(error);
      created.user(data.user.id);
      const { error: profileError } = await adminClient
        .from(TABLES.profiles)
        .insert({
          id: data.user.id,
          college_id: collegeId,
          role: "student",
          user_code: `${label}${suffix}`,
          full_name: "Ana Quispe",
          ...(email
            ? {
              given_names: "Ana",
              family_names: "Quispe",
              email,
              phone: "987654321",
              identity_document_type: "DNI" as const,
              identity_document_number: "12345678",
            }
            : {}),
          is_active: true,
          access_valid_from: accessFrom,
          access_valid_until: "2099-12-31",
        });
      assert.ifError(profileError);
      return { id: data.user.id, authEmail, password };
    }

    const student = await createStudent(
      "perfil",
      `perfil.${suffix}@example.com`,
    );
    const bystander = await createStudent("otro", `otro.${suffix}@example.com`);
    const collegeStudent = await createStudent("colegio", null);

    const studentClient = newClient();
    const { data: signedIn, error: signInError } = await studentClient.auth
      .signInWithPassword({
        email: student.authEmail,
        password: student.password,
      });
    assert.ifError(signInError);
    const token = signedIn.session!.access_token;
    const bystanderClient = newClient();
    const { error: bystanderError } = await bystanderClient.auth
      .signInWithPassword({
        email: bystander.authEmail,
        password: bystander.password,
      });
    assert.ifError(bystanderError);

    // Perfil: lectura y edición; full_name se recompone con nombres y apellidos.
    await call("account/profile", { method: "GET" }, 401);
    const loaded = await call("account/profile", { method: "GET", token });
    assert.equal(
      (loaded.profile as { email: string }).email,
      `perfil.${suffix}@example.com`,
    );
    assert.equal(
      (loaded.profile as { college_name: string }).college_name,
      `Perfil ${suffix}`,
    );
    const updated = await call("account/profile", {
      method: "PUT",
      token,
      body: {
        given_names: "Ana Lucía",
        family_names: "Quispe Mamani",
        phone: "+51 912 345 678",
        identity_document_type: "CE",
        identity_document_number: "abc123456",
      },
    });
    const updatedProfile = updated.profile as {
      phone: string;
      identity_document_number: string;
    };
    assert.equal(updatedProfile.phone, "912345678");
    assert.equal(updatedProfile.identity_document_number, "ABC123456");
    const { data: renamed } = await adminClient
      .from(TABLES.profiles)
      .select("full_name")
      .eq("id", student.id)
      .single();
    assert.equal(renamed?.full_name, "Ana Lucía Quispe Mamani");

    // Un estudiante creado por el administrador (sin correo real) también
    // tiene perfil: lo completa y agrega un correo verificado.
    const { data: collegeSession, error: collegeSignInError } =
      await newClient()
        .auth.signInWithPassword({
          email: collegeStudent.authEmail,
          password: collegeStudent.password,
        });
    assert.ifError(collegeSignInError);
    const collegeToken = collegeSession.session!.access_token;
    const emptyProfile = await call("account/profile", {
      method: "GET",
      token: collegeToken,
    });
    assert.equal((emptyProfile.profile as { email: null }).email, null);
    await call("account/profile", {
      method: "PUT",
      token: collegeToken,
      body: {
        given_names: "Luis",
        family_names: "Tinoco",
        phone: "967799163",
        identity_document_type: "DNI",
        identity_document_number: "87654321",
      },
    });
    const withoutEmail = await call("account/password-reset", {
      token: collegeToken,
    }, 409);
    assert.equal(errorCode(withoutEmail), "email_required");
    const collegeEmail = `colegio.real.${suffix}@example.com`;
    await call("account/email-change", {
      token: collegeToken,
      body: { email: collegeEmail },
    });
    await adminClient
      .from(TABLES.emailChangeRequests)
      .update({ code_hash: await hashEmailCode(collegeStudent.id, "135791") })
      .eq("user_id", collegeStudent.id);
    await call("account/email-change/confirm", {
      token: collegeToken,
      body: { code: "135791" },
    });
    // Sigue entrando con su código y ahora también con su correo.
    for (const identifier of [`colegio${suffix}`, collegeEmail]) {
      await call("login-with-code", {
        body: {
          code: identifier,
          password: collegeStudent.password,
          expected_role: "student",
        },
      });
    }

    // Restablecer contraseña: el link sirve una sola vez.
    const sent = await call("account/password-reset", { token });
    assert.match(sent.email as string, /^pe\*+@example\.com$/);
    await call("account/password-reset", { token }, 429);
    // Anular un link pedido por error lo borra y permite pedir otro enseguida.
    assert.equal(
      (await call("account/password-reset", { method: "DELETE", token }))
        .status,
      "cancelled",
    );
    const { count: cancelledLinks } = await adminClient
      .from(TABLES.passwordResetCodes)
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", student.id);
    assert.equal(cancelledLinks, 0);
    await call("account/password-reset", { token });

    // "¿Olvidaste tu contraseña?" del login: avisa si el correo no tiene
    // cuenta de estudiante y solo crea el link para un estudiante real.
    await adminClient.from(TABLES.passwordResetCodes).delete().eq(
      "user_id",
      student.id,
    );
    const unknown = await call("password-reset/request-link", {
      body: { email: `nadie.${suffix}@example.com` },
    }, 404);
    assert.equal((unknown.error as { code: string }).code, "email_not_found");
    const requested = await call("password-reset/request-link", {
      body: { email: student.authEmail },
    });
    assert.deepEqual(requested, { status: "requested" });
    const { count: requestedLinks } = await adminClient
      .from(TABLES.passwordResetCodes)
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", student.id);
    assert.equal(requestedLinks, 1);
    // Pedirlo de nuevo enseguida no falla: el link anterior sigue sirviendo.
    await call("password-reset/request-link", {
      body: { email: student.authEmail },
    });

    // El link real solo llega por correo: el test fija uno conocido.
    const resetCode = generateLinkCode();
    await adminClient.from(TABLES.passwordResetCodes).delete().eq(
      "user_id",
      student.id,
    );
    const { error: codeError } = await adminClient
      .from(TABLES.passwordResetCodes)
      .insert({
        code_hash: await hashLinkCode(resetCode),
        user_id: student.id,
        expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      });
    assert.ifError(codeError);
    const query = `password-reset?code=${resetCode}`;
    assert.equal((await call(query, { method: "GET" })).status, "valid");
    const unknownLink = await call(
      `password-reset?code=${generateLinkCode()}`,
      { method: "GET" },
      404,
    );
    assert.equal(errorCode(unknownLink), "invalid_reset_code");
    // Una contraseña que no cumple las reglas no gasta el link.
    const weak = await call("password-reset", {
      body: { code: resetCode, password: "debil" },
    }, 400);
    assert.equal(errorCode(weak), "weak_password");
    await call(query, { method: "GET" });

    const newPassword = "Nueva123";
    const reset = await call("password-reset", {
      body: { code: resetCode, password: newPassword },
    });
    assert.equal(reset.status, "password_updated");
    const reused = await call("password-reset", {
      body: { code: resetCode, password: newPassword },
    }, 404);
    assert.equal(errorCode(reused), "invalid_reset_code");
    await call(query, { method: "GET" }, 404);

    // Solo se cierran las sesiones de quien restableció.
    const { error: revokedError } = await studentClient.auth.refreshSession();
    assert.ok(revokedError, "the student session should be revoked");
    const { error: bystanderRefreshError } = await bystanderClient.auth
      .refreshSession();
    assert.ifError(bystanderRefreshError);
    const { error: oldPasswordError } = await newClient().auth
      .signInWithPassword({
        email: student.authEmail,
        password: student.password,
      });
    assert.ok(oldPasswordError);
    const { data: relogged, error: reloggedError } = await newClient().auth
      .signInWithPassword({ email: student.authEmail, password: newPassword });
    assert.ifError(reloggedError);
    const newToken = relogged.session!.access_token;

    // Cambio de correo: el código va al correo nuevo y se borra al usarse.
    const taken = await call("account/email-change", {
      token: newToken,
      body: { email: bystander.authEmail },
    }, 409);
    assert.equal(errorCode(taken), "email_taken");
    const newEmail = `ana.nueva.${suffix}@example.com`;
    const delivery = await call("account/email-change", {
      token: newToken,
      body: { email: newEmail.toUpperCase() },
    });
    assert.match(delivery.email as string, /^an\*+@example\.com$/);
    await call("account/email-change", {
      token: newToken,
      body: { email: newEmail },
    }, 429);
    const wrong = await call("account/email-change/confirm", {
      token: newToken,
      body: { code: "000000" },
    }, 400);
    assert.equal(errorCode(wrong), "invalid_email_code");
    const { error: emailCodeError } = await adminClient
      .from(TABLES.emailChangeRequests)
      .update({ code_hash: await hashEmailCode(student.id, "246810") })
      .eq("user_id", student.id);
    assert.ifError(emailCodeError);
    const changed = await call("account/email-change/confirm", {
      token: newToken,
      body: { code: "246810" },
    });
    assert.equal(changed.email, newEmail);
    const { count: leftover } = await adminClient
      .from(TABLES.emailChangeRequests)
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", student.id);
    assert.equal(leftover, 0);
    await call("account/email-change/confirm", {
      token: newToken,
      body: { code: "246810" },
    }, 404);
    const { error: newEmailLoginError } = await newClient().auth
      .signInWithPassword({ email: newEmail, password: newPassword });
    assert.ifError(newEmailLoginError);
  },
});

Deno.test({
  name: "admin invites a student who completes the account from the link",
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const testUrl = url as string;
    const testPublishableKey = publishableKey as string;
    const adminClient = createClient<Database>(testUrl, secretKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await using created = new TestData(adminClient);
    const suffix = crypto.randomUUID().slice(0, 8);

    async function call(
      path: string,
      init: { method?: string; body?: unknown; token?: string },
      expectedStatus = 200,
    ): Promise<Record<string, unknown>> {
      const response = await fetch(`${testUrl}/functions/v1/${path}`, {
        method: init.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": testPublishableKey,
          ...(init.token ? { "Authorization": `Bearer ${init.token}` } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const payload = await response.json();
      assert.equal(
        response.status,
        expectedStatus,
        `${path}: ${JSON.stringify(payload)}`,
      );
      return payload;
    }
    const errorCode = (payload: Record<string, unknown>) =>
      (payload.error as { code: string }).code;

    const { data: college, error: collegeError } = await adminClient
      .from(TABLES.colleges)
      .insert({ code: `INV-${suffix}`, name: `Invitaciones ${suffix}` })
      .select("id")
      .single();
    assert.ifError(collegeError);
    created.college(college.id);

    const adminEmail = `admin.${suffix}@example.com`;
    const { data: adminUser, error: adminError } = await adminClient.auth.admin
      .createUser({
        email: adminEmail,
        password: "Admin1234",
        email_confirm: true,
      });
    assert.ifError(adminError);
    created.user(adminUser.user.id);
    const { error: adminProfileError } = await adminClient
      .from(TABLES.profiles)
      .insert({
        id: adminUser.user.id,
        role: "admin",
        user_code: `ADMIN-INV-${suffix}`,
        full_name: "Admin Invitaciones",
        is_active: true,
      });
    assert.ifError(adminProfileError);
    const { data: adminSession, error: adminSignInError } = await createClient(
      testUrl,
      testPublishableKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ).auth.signInWithPassword({ email: adminEmail, password: "Admin1234" });
    assert.ifError(adminSignInError);
    const token = adminSession.session!.access_token;

    // Grupo con un curso en la institución: es lo que fija la
    // invitación y de donde salen la institución y la inscripción.
    const teacherEmail = `teacher.${suffix}@example.com`;
    const { data: teacherUser, error: teacherError } = await adminClient.auth
      .admin.createUser({
        email: teacherEmail,
        password: "Teacher1234",
        email_confirm: true,
      });
    assert.ifError(teacherError);
    const teacherId = created.user(teacherUser.user.id);
    const { error: teacherProfileError } = await adminClient
      .from(TABLES.profiles)
      .insert({
        id: teacherId,
        college_id: college.id,
        role: "teacher",
        user_code: `TEACHER-INV-${suffix}`,
        full_name: "Profesor Invitaciones",
        is_active: true,
      });
    assert.ifError(teacherProfileError);
    const { data: teacherCourse, error: teacherCourseError } = await adminClient
      .from(TABLES.courses)
      .insert({
        college_id: college.id,
        teacher_id: teacherId,
        name: `Curso invitaciones ${suffix}`,
        created_by: teacherId,
      })
      .select("id")
      .single();
    assert.ifError(teacherCourseError);

    // Solo el administrador invita, y no a un correo que ya tiene cuenta.
    await call("invitations", { method: "GET" }, 401);
    const studentEmail = `invitada.${suffix}@example.com`;
    const invitationBody = {
      email: studentEmail.toUpperCase(),
      teacher_id: teacherId,
      access_valid_from: "2026-01-01",
      access_valid_until: "2099-12-31",
    };
    const taken = await call("invitations", {
      token,
      body: { ...invitationBody, email: adminEmail },
    }, 409);
    assert.equal(errorCode(taken), "email_taken");
    const pastAccess = await call("invitations", {
      token,
      body: { ...invitationBody, access_valid_until: "2026-01-02" },
    }, 400);
    assert.equal(errorCode(pastAccess), "validation_error");

    const createdInvitation = await call("invitations", {
      token,
      body: invitationBody,
    }, 201);
    const invitation = createdInvitation.invitation as {
      id: string;
      email: string;
      teacher_name: string;
      college_name: string;
    };
    assert.equal(invitation.email, studentEmail);
    assert.equal(invitation.teacher_name, "Profesor Invitaciones");
    assert.equal(invitation.college_name, `Invitaciones ${suffix}`);
    const listed = await call("invitations", { method: "GET", token });
    assert.ok(
      (listed.invitations as Array<{ id: string }>).some((item) =>
        item.id === invitation.id
      ),
    );

    // Reenviar cambia el link: el anterior deja de servir.
    const { data: beforeResend } = await adminClient
      .from(TABLES.studentInvitations)
      .select("code_hash")
      .eq("id", invitation.id)
      .single();
    await call("invitations/resend", {
      token,
      body: { invitation_id: invitation.id },
    });
    const { data: afterResend } = await adminClient
      .from(TABLES.studentInvitations)
      .select("code_hash")
      .eq("id", invitation.id)
      .single();
    assert.notEqual(afterResend?.code_hash, beforeResend?.code_hash);

    // El link real solo llega por correo: el test fija uno conocido.
    const linkCode = generateLinkCode();
    const { error: codeError } = await adminClient
      .from(TABLES.studentInvitations)
      .update({ code_hash: await hashLinkCode(linkCode) })
      .eq("id", invitation.id);
    assert.ifError(codeError);
    assert.equal(
      errorCode(
        await call(`student-invitation?code=${generateLinkCode()}`, {
          method: "GET",
        }, 404),
      ),
      "invalid_invitation",
    );
    const checked = await call(`student-invitation?code=${linkCode}`, {
      method: "GET",
    });
    assert.deepEqual(
      {
        email: (checked.invitation as { email: string }).email,
        teacher: (checked.invitation as { teacher_name: string }).teacher_name,
        college: (checked.invitation as { college_name: string }).college_name,
      },
      {
        email: studentEmail,
        teacher: "Profesor Invitaciones",
        college: `Invitaciones ${suffix}`,
      },
    );

    const form = {
      code: linkCode,
      teacher_id: teacherId,
      given_names: "Lucía",
      family_names: "Mamani",
      phone: "987654321",
      identity_document_type: "DNI",
      identity_document_number: "12345678",
      password: "Invitada9",
      accepted_terms: true,
    };
    // Datos inválidos no gastan el link.
    const weak = await call("student-invitation", {
      body: { ...form, password: "debil" },
    }, 400);
    assert.equal(errorCode(weak), "weak_password");
    await call(`student-invitation?code=${linkCode}`, { method: "GET" });

    assert.equal(
      (await call("student-invitation", { body: form }, 201)).status,
      "accepted",
    );
    const { data: student, error: studentError } = await adminClient
      .from(TABLES.profiles)
      .select(
        "id,full_name,email,college_id,role,access_valid_from,access_valid_until",
      )
      .eq("email", studentEmail)
      .single();
    assert.ifError(studentError);
    created.user(student.id);
    assert.deepEqual(
      {
        full_name: student.full_name,
        college_id: student.college_id,
        role: student.role,
        access_valid_from: student.access_valid_from,
        access_valid_until: student.access_valid_until,
      },
      {
        full_name: "Lucía Mamani",
        college_id: college.id,
        role: "student",
        access_valid_from: "2026-01-01",
        access_valid_until: "2099-12-31",
      },
    );
    // La institución sale del grupo y el estudiante queda inscrito en su curso.
    const { count: enrollmentCount, error: enrollmentError } = await adminClient
      .from(TABLES.courseEnrollments)
      .select("*", { count: "exact", head: true })
      .eq("course_id", teacherCourse.id)
      .eq("student_id", student.id);
    assert.ifError(enrollmentError);
    assert.equal(enrollmentCount, 1);
    // El link se borró al usarse.
    await call("student-invitation", { body: form }, 404);
    const { count: leftover } = await adminClient
      .from(TABLES.studentInvitations)
      .select("id", { count: "exact", head: true })
      .eq("id", invitation.id);
    assert.equal(leftover, 0);
    await call("login-with-code", {
      body: {
        code: studentEmail,
        password: "Invitada9",
        expected_role: "student",
      },
    });

    // Anular una invitación la borra.
    const toCancel = await call("invitations", {
      token,
      body: { ...invitationBody, email: `anulada.${suffix}@example.com` },
    }, 201);
    const cancelId = (toCancel.invitation as { id: string }).id;
    await call(`invitations?id=${cancelId}`, { method: "DELETE", token });
    await call(`invitations?id=${cancelId}`, { method: "DELETE", token }, 404);
  },
});

Deno.test({
  name: "complaints book numbers, limits by IP and returns the sheet PDF",
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const data = {
      consumer_name: "Ana Pérez",
      consumer_document_type: "DNI",
      consumer_document_number: "12345678",
      consumer_address: "Av. Lima 123",
      consumer_department: "Lima",
      consumer_province: "Lima",
      consumer_district: "Miraflores",
      consumer_phone: null,
      consumer_email: "ana@example.com",
      is_minor: false,
      guardian_name: null,
      guardian_document_type: null,
      guardian_document_number: null,
      item_type: "servicio",
      item_description: "Plan Estudiante",
      claimed_amount: 14.9,
      kind: "reclamo",
      detail: "Se me cobró dos veces.",
      consumer_request: "Devolución del cobro duplicado.",
    };
    // Una IP distinta en cada corrida, para que el límite diario no dependa de
    // las anteriores.
    const ip = `198.51.100.${
      Math.floor(Math.random() * 250) + 1
    }-${crypto.randomUUID()}`;
    const submit = async (
      fields: Record<string, string>,
      files: File[] = [],
    ) => {
      const form = new FormData();
      form.append("data", JSON.stringify(data));
      for (const [name, value] of Object.entries(fields)) {
        form.append(name, value);
      }
      for (const file of files) form.append("evidence", file, file.name);
      const response = await fetch(`${url}/functions/v1/complaints/sheets`, {
        method: "POST",
        headers: { "apikey": publishableKey!, "cf-connecting-ip": ip },
        body: form,
      });
      return { status: response.status, body: await response.json() };
    };

    const test = await submit({ test: "true" });
    assert.equal(test.status, 200, JSON.stringify(test.body));
    assert.equal(test.body.sheet_number, null);
    assert.ok(atob(test.body.pdf).startsWith("%PDF-"));

    const first = await submit({}, [
      new File(["%PDF-1.3"], "voucher.pdf", { type: "application/pdf" }),
    ]);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(typeof first.body.sheet_number, "number");
    const second = await submit({});
    assert.equal(second.body.sheet_number, first.body.sheet_number + 1);

    const limited = await submit({});
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, "complaint_daily_limit");
    // El modo prueba no tiene límite.
    assert.equal((await submit({ test: "true" })).status, 200);

    const invalid = await submit({ test: "true" }, [
      new File(["x"], "virus.exe", { type: "application/octet-stream" }),
    ]);
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, "invalid_evidence");
  },
});
