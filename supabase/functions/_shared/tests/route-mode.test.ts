import assert from "node:assert/strict";
import { AppError } from "../errors.ts";
import {
  buildRouteProgress,
  gradeRouteAttempt,
  parseRouteAnswers,
  parseRouteQuestions,
  routeScorePercent,
} from "../route-mode.ts";

const questionId = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const key = [1, 2, 3, 4, 5].map((n) => ({
  id: questionId(n),
  correct_option: "A",
}));
const answersWith = (wrong: number) =>
  key.map((question, index) => ({
    question_id: question.id,
    selected_option: index < wrong ? "B" as const : "A" as const,
  }));

Deno.test("score percent rounds down", () => {
  assert.equal(routeScorePercent(4, 5), 80);
  assert.equal(routeScorePercent(2, 3), 66);
  assert.equal(routeScorePercent(0, 0), 0);
});

Deno.test("4 of 5 passes and 3 of 5 does not", () => {
  const passed = gradeRouteAttempt(key, answersWith(1));
  assert.equal(passed.score_percent, 80);
  assert.equal(passed.passed, true);
  assert.equal(passed.correct_question_ids.length, 4);
  const failed = gradeRouteAttempt(key, answersWith(2));
  assert.equal(failed.passed, false);
});

Deno.test("grading requires every question exactly once", () => {
  assert.throws(
    () => gradeRouteAttempt(key, answersWith(0).slice(1)),
    (error) => error instanceof AppError && error.status === 409,
  );
  const foreign = answersWith(0);
  foreign[0] = { question_id: questionId(9), selected_option: "A" };
  assert.throws(() => gradeRouteAttempt(key, foreign), AppError);
});

const topics = [
  {
    id: "t2",
    teacher_id: "p1",
    name: "Tema 2",
    description: null,
    position: 2,
  },
  {
    id: "t1",
    teacher_id: "p1",
    name: "Tema 1",
    description: null,
    position: 1,
  },
  { id: "t3", teacher_id: "p2", name: "Otro", description: null, position: 1 },
];
const lessons = [
  { id: "l3", topic_id: "t2", position: 1, title: "C" },
  { id: "l2", topic_id: "t1", position: 2, title: "B" },
  { id: "l1", topic_id: "t1", position: 1, title: "A" },
  { id: "l4", topic_id: "t3", position: 1, title: "D" },
];

Deno.test("only the first lesson is open without attempts", () => {
  const progress = buildRouteProgress(topics, lessons, []);
  const statuses = progress.flatMap((topic) =>
    topic.lessons.map((lesson) => [lesson.id, lesson.status])
  );
  assert.deepEqual(statuses, [
    ["l1", "available"],
    ["l2", "locked"],
    ["l4", "available"],
    ["l3", "locked"],
  ]);
});

Deno.test("a failed attempt keeps the next lesson locked, a pass opens it across topics", () => {
  const failed = buildRouteProgress(topics, lessons, [
    { lesson_id: "l1", score_percent: 60, passed: false },
  ]);
  assert.equal(failed[0]?.lessons[0]?.status, "available");
  assert.equal(failed[0]?.lessons[0]?.best_percent, 60);
  assert.equal(failed[0]?.lessons[1]?.status, "locked");

  const passed = buildRouteProgress(topics, lessons, [
    { lesson_id: "l1", score_percent: 60, passed: false },
    { lesson_id: "l1", score_percent: 80, passed: true },
    { lesson_id: "l2", score_percent: 100, passed: true },
  ]);
  assert.equal(passed[0]?.lessons[0]?.status, "completed");
  assert.equal(passed[0]?.lessons[0]?.best_percent, 80);
  assert.equal(passed[0]?.lessons[0]?.attempts, 2);
  assert.equal(passed[0]?.completed_lessons, 2);
  assert.equal(
    passed.find((topic) => topic.id === "t2")?.lessons[0]?.status,
    "available",
  );
});

Deno.test("questions must be exactly five and valid", () => {
  const valid = {
    statement: "¿Cuánto es $2+2$?\nResponde.",
    option_a: "3",
    option_b: "4",
    option_c: "5",
    option_d: "6",
    correct_option: "b",
  };
  assert.throws(() => parseRouteQuestions([valid]), AppError);
  const parsed = parseRouteQuestions(Array(5).fill(valid));
  assert.equal(parsed[0]?.correct_option, "B");
  assert.equal(parsed[0]?.explanation, null);
  assert.equal(parsed[0]?.statement.includes("\n"), true);
  assert.throws(
    () => parseRouteQuestions(Array(5).fill({ ...valid, correct_option: "E" })),
    AppError,
  );
});

Deno.test("answers reject duplicates", () => {
  const answer = { question_id: questionId(1), selected_option: "a" };
  assert.equal(parseRouteAnswers([answer])[0]?.selected_option, "A");
  assert.throws(() => parseRouteAnswers([answer, answer]), AppError);
});
