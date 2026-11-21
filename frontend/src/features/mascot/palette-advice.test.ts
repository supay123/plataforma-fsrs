import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTES } from "../../lib/theme/palette";
import { contrastRatio, paletteAdvice } from "./palette-advice";

describe("contrastRatio", () => {
  it("da 21 entre negro y blanco y 1 entre iguales", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#3fb97c", "#3fb97c")).toBeCloseTo(1, 5);
  });

  it("no opina sobre un color inválido", () => {
    expect(contrastRatio("rojo", "#ffffff")).toBeNull();
  });
});

describe("paletteAdvice", () => {
  it("aprueba los colores por defecto", () => {
    expect(paletteAdvice(DEFAULT_PALETTES).tone).toBe("success");
  });

  it("advierte si el primario se pierde sobre el fondo, sin impedir guardar", () => {
    const dark = { ...DEFAULT_PALETTES.dark, primary: DEFAULT_PALETTES.dark.blocks };
    const advice = paletteAdvice({ light: DEFAULT_PALETTES.light, dark });
    expect(advice.tone).toBe("warning");
    expect(advice.text).toContain("modo oscuro");
    expect(advice.text).toContain("Puedes guardarlos igual");
  });
});
