import type { BasePalette } from "../../lib/theme/palette";
import type { Advice } from "./advice";

const MIN_BASE_TO_BLOCKS_RATIO = 1.05;
const MIN_PRIMARY_TO_BLOCKS_RATIO = 3;

function luminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const [red, green, blue] = [0, 2, 4].map((start) => {
    const channel = parseInt(match[1]!.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

export function contrastRatio(first: string, second: string): number | null {
  const a = luminance(first);
  const b = luminance(second);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function issuesOf(palette: BasePalette): string[] {
  const issues: string[] = [];
  const baseToBlocks = contrastRatio(palette.base, palette.blocks);
  const primaryToBlocks = contrastRatio(palette.primary, palette.blocks);
  if (baseToBlocks !== null && baseToBlocks < MIN_BASE_TO_BLOCKS_RATIO) issues.push("el fondo base y el de bloques son casi iguales, así que las tarjetas se perderán");
  if (primaryToBlocks !== null && primaryToBlocks < MIN_PRIMARY_TO_BLOCKS_RATIO) issues.push("el primario casi no se distingue sobre el fondo de bloques y los botones podrían leerse mal");
  return issues;
}

/** Orientación sobre los colores elegidos; nunca bloquea: el admin puede guardar cualquier color. */
export function paletteAdvice(palettes: { light: BasePalette; dark: BasePalette }): Advice {
  const found = [["claro", issuesOf(palettes.light)], ["oscuro", issuesOf(palettes.dark)]] as const;
  const withIssues = found.filter(([, issues]) => issues.length > 0);
  if (withIssues.length === 0) return { event: "correct", tone: "success", text: "Los colores se distinguen bien. Recuerda que el cambio lo verá toda la institución." };
  const text = withIssues.map(([mode, issues]) => `En el modo ${mode}, ${issues.join(" y ")}.`).join(" ");
  return { event: "rest", tone: "warning", text: `${text} Puedes guardarlos igual, pero conviene revisarlos.` };
}
