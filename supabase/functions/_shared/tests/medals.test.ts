import assert from "node:assert/strict";
import {
  DEFAULT_MEDAL_RULES,
  gradeRanges,
  medalForStars,
  medalRanges,
  parseGradeRangeEnds,
  parseStarRangeEnds,
  sessionGrade,
  starsForGrade,
  topicStarsOutcome,
} from "../medals.ts";

const gradeEnds = DEFAULT_MEDAL_RULES.grade_range_ends;
const starEnds = DEFAULT_MEDAL_RULES.star_range_ends;

Deno.test("grades are rounded to two decimals", () => {
  assert.equal(sessionGrade(49, 60), 16.33);
  assert.equal(sessionGrade(71, 80), 17.75);
  assert.equal(sessionGrade(20, 20), 20);
  assert.equal(sessionGrade(0, 0), 0);
});

Deno.test("default grade ranges give the documented stars", () => {
  const cases: Array<[number, number]> = [
    [0, -3],
    [2, -3],
    [3, -2],
    [5, -2],
    [6, -1],
    [8, -1],
    [9, 0],
    [10, 1],
    [13, 1],
    [14, 2],
    [17, 2],
    [18, 3],
    [20, 3],
  ];
  for (const [grade, stars] of cases) {
    assert.equal(starsForGrade(grade, gradeEnds), stars, `grade ${grade}`);
  }
});

Deno.test("decimal grades fall in the range of their integer part", () => {
  assert.equal(starsForGrade(17.75, gradeEnds), 2);
  assert.equal(starsForGrade(9.99, gradeEnds), 0);
  assert.equal(starsForGrade(2.5, gradeEnds), -3);
});

Deno.test("default star ranges give the documented medals", () => {
  const cases: Array<[number, string]> = [
    [0, "postulante_1"],
    [2, "postulante_1"],
    [3, "postulante_2"],
    [8, "postulante_3"],
    [9, "pre_universitario_1"],
    [23, "pre_universitario_3"],
    [24, "candidato_1"],
    [50, "candidato_3"],
    [51, "pre_ingresante_1"],
    [101, "pre_ingresante_3"],
    [102, "ingresante"],
    [5000, "ingresante"],
  ];
  for (const [stars, medal] of cases) {
    assert.equal(medalForStars(stars, starEnds), medal, `${stars} stars`);
  }
});

Deno.test("medal and grade ranges derive their start from the previous end", () => {
  const medals = medalRanges(starEnds);
  assert.equal(medals.length, 13);
  assert.deepEqual(medals[0], {
    code: "postulante_1",
    name: "Postulante 1",
    min_stars: 0,
    max_stars: 2,
  });
  assert.deepEqual(medals[12], {
    code: "ingresante",
    name: "Ingresante",
    min_stars: 102,
    max_stars: null,
  });
  const grades = gradeRanges(gradeEnds);
  assert.deepEqual(grades[0], { stars: -3, min_grade: 0, max_grade: 2 });
  assert.deepEqual(grades[6], { stars: 3, min_grade: 18, max_grade: 20 });
});

Deno.test("ranges must be integers in strictly increasing order", () => {
  assert.deepEqual(parseStarRangeEnds(starEnds), starEnds);
  assert.throws(() => parseStarRangeEnds([...starEnds.slice(0, 11)]));
  assert.throws(() => parseStarRangeEnds([-1, ...starEnds.slice(1)]));
  assert.throws(() => parseStarRangeEnds([2, 2, ...starEnds.slice(2)]));
  assert.throws(() => parseStarRangeEnds([2.5, ...starEnds.slice(1)]));
  assert.deepEqual(parseGradeRangeEnds([0, 1, 2, 3, 4, 19]), [
    0,
    1,
    2,
    3,
    4,
    19,
  ]);
  assert.throws(() => parseGradeRangeEnds([2, 5, 8, 9, 13, 20]));
  assert.throws(() => parseGradeRangeEnds([2, 5, 8, 9, 9, 17]));
});

Deno.test("negative stars always subtract, even in a completed topic", () => {
  assert.deepEqual(topicStarsOutcome(-2, 1, false), {
    gain: -2,
    best_stars: 1,
  });
  assert.deepEqual(topicStarsOutcome(-1, 3, true), { gain: -1, best_stars: 3 });
});

Deno.test("an unfinished topic only adds the difference with its best mark", () => {
  assert.deepEqual(topicStarsOutcome(3, 2, false), { gain: 1, best_stars: 3 });
  assert.deepEqual(topicStarsOutcome(2, 2, false), { gain: 0, best_stars: 2 });
  assert.deepEqual(topicStarsOutcome(1, 2, false), { gain: 0, best_stars: 2 });
  assert.deepEqual(topicStarsOutcome(2, 0, false), { gain: 2, best_stars: 2 });
});

Deno.test("a completed topic only adds 1 for a +3 attempt", () => {
  assert.deepEqual(topicStarsOutcome(3, 3, true), { gain: 1, best_stars: 3 });
  assert.deepEqual(topicStarsOutcome(2, 3, true), { gain: 0, best_stars: 3 });
  assert.deepEqual(topicStarsOutcome(1, 3, true), { gain: 0, best_stars: 3 });
  assert.deepEqual(topicStarsOutcome(0, 3, true), { gain: 0, best_stars: 3 });
});
