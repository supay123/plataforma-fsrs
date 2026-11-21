import { describe, expect, it } from "vitest";
import { daysLabel, streakTrack, levelProgress, xpMissingForNextLevel } from "./achievements";

describe("achievements", () => {
  it("calcula el xp que falta y el avance del nivel", () => {
    expect(xpMissingForNextLevel({ xp: 40, xp_to_next: 100 })).toBe(60);
    expect(levelProgress({ xp: 40, xp_to_next: 100 })).toBe(0.4);
    expect(xpMissingForNextLevel({ xp: 120, xp_to_next: 100 })).toBe(0);
    expect(levelProgress({ xp: 0, xp_to_next: 0 })).toBe(0);
  });
  it("usa singular y plural en los días", () => {
    expect(daysLabel(1)).toBe("1 día");
    expect(daysLabel(0)).toBe("0 días");
  });
  it("arma el tramo de 7 días de la racha con sus hitos", () => {
    const track = streakTrack("2026-11-18", 2, true);
    expect(track.map((day) => day.label).join(" ")).toBe("mar mié jue vie sáb dom lun");
    expect(track.map((day) => day.done)).toEqual([true, true, false, false, false, false, false]);
    expect(track.map((day) => day.milestone)).toEqual([null, null, 3, null, null, null, 7]);
    expect(track[1]!.isToday).toBe(true);
  });
  it("si hoy aún no hay sesión, el tramo termina ayer; con racha 0 empieza hoy; al pasar de 7 empieza otro tramo", () => {
    expect(streakTrack("2026-11-18", 2, false).map((day) => day.date)[0]).toBe("2026-11-16");
    expect(streakTrack("2026-11-18", 0, false)[0]!.date).toBe("2026-11-18");
    expect(streakTrack("2026-11-18", 0, false).some((day) => day.done)).toBe(false);
    expect(streakTrack("2026-11-18", 8, true).filter((day) => day.done)).toHaveLength(1);
    expect(streakTrack("2026-11-18", 7, true).every((day) => day.done)).toBe(true);
  });
});
