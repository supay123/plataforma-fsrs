import { describe, expect, it } from "vitest";
import { clipForEvent, type MascotEvent } from "./use-mascot-animation";

describe("clipForEvent", () => {
  it("traduce cada evento de la app a su clip", () => {
    const expected: Record<MascotEvent, string> = {
      rest: "idle", loading: "think", correct: "correct", wrong: "wrong", streak: "celebrate",
      levelUp: "levelUp", finish: "finish", sleep: "sleep", appear: "appear", disappear: "disappear", tip: "correct",
    };
    for (const [event, clip] of Object.entries(expected)) expect(clipForEvent(event as MascotEvent).clip).toBe(clip);
  });

  it("solo repiten sin fin reposo, carga y sueño", () => {
    const looping = (["rest", "loading", "sleep", "correct", "wrong", "streak", "levelUp", "finish", "tip", "appear", "disappear"] as const)
      .filter((event) => clipForEvent(event).loop);
    expect(looping).toEqual(["rest", "loading", "sleep"]);
  });
});
