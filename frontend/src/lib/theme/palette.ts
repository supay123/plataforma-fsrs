// Paleta central de la plataforma (estilo Chancón).
//
// Cada institución elige 4 colores por modo (claro y oscuro), `BasePalette`: primario, secundario,
// fondo base y fondo de bloques. El texto NO se elige: sobre cada fondo se calcula blanco o negro, el
// que dé más contraste, y por separado para cada fondo. Todo lo demás se deriva con `color-mix`, y
// los colores de estado son fijos para que "correcto", "error" y "advertencia" signifiquen siempre
// lo mismo.
//
// Los valores del tema oscuro por defecto también viven en `styles.css` (bloque `:root`) como
// respaldo antes de que cargue el JS; `palette.test.ts` comprueba que ambos coincidan.
//
// Uso en clases (utilidades de `styles.css`):
//   bg-base   + text-on-base   → fondo de la página y su texto
//   bg-blocks + text-on-blocks → menú, tarjetas y paneles, y su texto
//   text-muted / text-faint (y text-fg*) toman el gris del fondo en el que estén.
import type { CSSProperties } from "react";

/** Los únicos colores que elige cada institución. */
export type BasePalette = {
  /** Color de la institución: botones, barras, ítem activo, enlaces. */
  primary: string;
  /** Segundo color: rombos, xp, detalles. */
  secondary: string;
  /** Fondo de la página. */
  base: string;
  /** Fondo del menú, tarjetas y paneles. */
  blocks: string;
};

export type ThemeMode = "light" | "dark";
export const PALETTE_KEYS = ["primary", "secondary", "base", "blocks"] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];
export const PALETTE_LABELS: Record<PaletteKey, string> = { primary: "Primario", secondary: "Secundario", base: "Fondo base", blocks: "Fondo bloques" };

/** Temas por defecto de la plataforma (se usan cuando la institución no configuró colores). */
export const DEFAULT_PALETTES: Record<ThemeMode, BasePalette> = {
  dark: { primary: "#3fb97c", secondary: "#c9a961", base: "#0a0f16", blocks: "#151b23" },
  light: { primary: "#2e9e69", secondary: "#a8842f", base: "#eef2f6", blocks: "#ffffff" },
};

/** Fijos: no los edita ninguna institución. */
export const STATUS = {
  success: "#29b85a",
  danger: "#e5484d",
  warning: "#f5c518",
} as const;

const BLACK = "#000000";
const WHITE = "#ffffff";

const mix = (color: string, percent: number, other: string) => `color-mix(in oklab, ${color} ${percent}%, ${other})`;

/** Variables CSS de toda la paleta (se ponen en `<html>`). */
export function paletteVars(base: BasePalette): CSSProperties {
  const { primary, secondary, base: baseBackground, blocks: blocksBackground } = base;
  const textOnBase = blackOrWhite(baseBackground);
  const textOnBlocks = blackOrWhite(blocksBackground);
  const vars: Record<string, string> = {
    // Fondos y su texto (blanco o negro, calculado por separado)
    "--c-base": baseBackground,
    "--c-blocks": blocksBackground,
    "--c-on-base": textOnBase,
    "--c-on-blocks": textOnBlocks,
    "--c-on-base-muted": mix(textOnBase, 64, baseBackground),
    "--c-on-base-faint": mix(textOnBase, 42, baseBackground),
    "--c-on-blocks-muted": mix(textOnBlocks, 64, blocksBackground),
    "--c-on-blocks-faint": mix(textOnBlocks, 42, blocksBackground),
    "--c-scheme": textOnBase === WHITE ? "dark" : "light",
    // Bordes y hundidos: salen del fondo de bloques y su texto
    "--c-line": mix(textOnBlocks, 11, blocksBackground),
    "--c-line-strong": mix(textOnBlocks, 20, blocksBackground),
    "--c-sunken": mix(textOnBlocks, 7, blocksBackground), // pistas de barras, campos, nodos bloqueados
    "--c-base-line": mix(textOnBase, 20, baseBackground), // bordes de controles que van sobre la página
    // Primario
    "--c-primary": primary,
    "--c-primary-strong": mix(primary, 72, BLACK), // borde inferior de botones 3D
    "--c-primary-soft": mix(primary, 14, blocksBackground), // fondos suaves (ítem activo, opción elegida)
    "--c-primary-text": mix(primary, 78, textOnBlocks), // texto del color de marca, legible sobre nav
    "--c-on-primary": blackOrWhite(primary),
    // Secundario
    "--c-secondary": secondary,
    "--c-secondary-soft": mix(secondary, 16, blocksBackground),
    "--c-secondary-text": mix(secondary, 72, textOnBlocks),
  };
  // Estados fijos, con su versión suave (fondo) y de texto sobre el fondo nav
  for (const [name, color] of Object.entries(STATUS)) {
    vars[`--c-${name}`] = color;
    vars[`--c-${name}-strong`] = mix(color, 72, BLACK);
    vars[`--c-${name}-soft`] = mix(color, 15, blocksBackground);
    vars[`--c-${name}-text`] = mix(color, 70, textOnBlocks);
    vars[`--c-on-${name}`] = blackOrWhite(color);
  }
  return vars as CSSProperties;
}

/** Aplica una paleta a un elemento (normalmente `document.documentElement`). */
export function applyPalette(element: HTMLElement, base: BasePalette): void {
  for (const [name, value] of Object.entries(paletteVars(base))) element.style.setProperty(name, String(value));
}

/** Blanco o negro, el que tenga más contraste sobre `background`. */
export function blackOrWhite(background: string): string {
  return contrast(background, BLACK) >= contrast(background, WHITE) ? BLACK : WHITE;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value.slice(0, 6);
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
