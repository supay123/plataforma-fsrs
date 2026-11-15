import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PALETTES } from "./palette";
import { applyDocumentTheme, bootstrapTheme, readCachedTheme, readInstId, readMode, resolvePalette, saveCachedTheme, saveInstId, saveMode, toInstTheme } from "./theme-store";

const custom = { primary: "#ff0000", secondary: "#00ff00", base: "#101010", blocks: "#202020" };

// Con algunas versiones de Node el localStorage de jsdom no existe: se usa uno en memoria.
function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), removeItem: (key: string) => void data.delete(key), clear: () => data.clear() };
}

describe("theme-store", () => {
  beforeEach(() => { vi.stubGlobal("localStorage", memoryStorage()); document.documentElement.removeAttribute("style"); window.history.replaceState(null, "", "/"); });
  afterEach(() => vi.unstubAllGlobals());

  it("recuerda el instId y el modo elegido", () => {
    expect(readInstId()).toBeNull();
    saveInstId("COL-1");
    saveMode("light");
    expect(readInstId()).toBe("COL-1");
    expect(readMode()).toBe("light");
  });

  it("sin modo guardado y sin preferencia del navegador usa el oscuro", () => {
    expect(readMode()).toBe("dark");
  });

  it("solo acepta paletas válidas: lo demás es 'sin colores'", () => {
    expect(toInstTheme(null)).toBeNull();
    expect(toInstTheme({ light: null, dark: null })).toBeNull();
    expect(toInstTheme({ light: { ...custom, primary: "rojo" }, dark: null })).toBeNull();
    expect(toInstTheme({ light: null, dark: { ...custom, primary: "#FF0000" } })).toEqual({ light: null, dark: { ...custom } });
  });

  it("los colores guardados solo valen para su institución", () => {
    saveCachedTheme("COL-1", { light: null, dark: custom });
    expect(readCachedTheme("COL-1")?.dark).toEqual(custom);
    expect(readCachedTheme("OTRO")).toBeNull();
    expect(readCachedTheme(null)).toBeNull();
  });

  it("sin colores (null) o sin ese modo usa los de por defecto", () => {
    expect(resolvePalette("dark", null)).toEqual(DEFAULT_PALETTES.dark);
    expect(resolvePalette("light", { light: null, dark: custom })).toEqual(DEFAULT_PALETTES.light);
    expect(resolvePalette("dark", { light: null, dark: custom })).toEqual(custom);
  });

  it("aplica los colores en <html>", () => {
    applyDocumentTheme("dark", { light: null, dark: custom });
    expect(document.documentElement.style.getPropertyValue("--c-primary")).toBe("#ff0000");
  });

  it("toma el instId de la URL al arrancar", () => {
    window.history.replaceState(null, "", "/estudiante/invitacion?code=abc&instId=COL-9");
    saveCachedTheme("COL-9", { light: null, dark: custom });
    bootstrapTheme();
    expect(readInstId()).toBe("COL-9");
    expect(document.documentElement.style.getPropertyValue("--c-base")).toBe("#101010");
  });
});
