import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInactivity } from "./use-inactivity";

describe("useInactivity", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("pasa a inactivo tras el tiempo indicado y despierta con un toque", () => {
    const { result } = renderHook(() => useInactivity(1000));
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(true);
    act(() => { window.dispatchEvent(new Event("pointerdown")); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(true);
  });

  it("no se activa si está deshabilitado", () => {
    const { result } = renderHook(() => useInactivity(1000, false));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBe(false);
  });
});
