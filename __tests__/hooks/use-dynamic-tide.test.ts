import { renderHook } from "@testing-library/react";
import { useDynamicTide } from "@/hooks/use-dynamic-tide";
import type { EnhancedForecastEntity } from "@/types/forecast";

describe("useDynamicTide", () => {
  it("returns null values when forecasts array is empty", () => {
    const { result } = renderHook(() => useDynamicTide([]));

    expect(result.current.nextTide).toBeNull();
    expect(result.current.nextHigh).toBeNull();
    expect(result.current.nextLow).toBeNull();
    expect(result.current.minutesUntil).toBeNull();
    expect(result.current.usingFallback).toBe(true);
  });
});
