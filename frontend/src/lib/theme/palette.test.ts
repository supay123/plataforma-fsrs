/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyPalette, blackOrWhite, DEFAULT_PALETTES, paletteVars } from "./palette";

describe("blackOrWhite", () => {
  it("elige el texto con más contraste sobre cada fondo", () => {
    expect(blackOrWhite("#0a0f16")).toBe("#ffffff");
    expect(blackOrWhite("#e9edf2")).toBe("#000000");
    expect(blackOrWhite("#3fb97c")).toBe("#000000");
    expect(blackOrWhite("#1e3a8a")).toBe("#ffffff");
  });

  it("calcula el texto de cada fondo por separado", () => {
    const vars = paletteVars({ ...DEFAULT_PALETTES.dark, base: "#0a0f16", blocks: "#e9edf2" }) as Record<string, string>;
    expect(vars["--c-on-base"]).toBe("#ffffff");
    expect(vars["--c-on-blocks"]).toBe("#000000");
  });
});

describe("tema por defecto", () => {
  it("coincide con el respaldo de styles.css (bloque :root)", () => {
    const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    const block = [...styles.matchAll(/:root\s*\{([^}]*)\}/g)].map((match) => match[1]!).find((text) => text.includes("--c-base")) ?? "";
    const declared = Object.fromEntries([...block.matchAll(/(--c-[a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]!.trim()]));
    const expected = paletteVars(DEFAULT_PALETTES.dark) as Record<string, string>;
    for (const [name, value] of Object.entries(expected)) expect(declared[name], name).toBe(value);
  });
});

describe("applyPalette", () => {
  it("pone las variables en el elemento", () => {
    const element = document.createElement("div");
    applyPalette(element, { ...DEFAULT_PALETTES.dark, primary: "#ff0000" });
    expect(element.style.getPropertyValue("--c-primary")).toBe("#ff0000");
    expect(element.style.getPropertyValue("--c-on-primary")).toBe("#000000");
  });
});
