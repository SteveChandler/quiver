import { renderHook, act } from "@testing-library/react";
import { useScrollToElement } from "@/hooks/use-scroll-to-element";

describe("useScrollToElement", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns a ref", () => {
    const { result } = renderHook(() =>
      useScrollToElement({ shouldScroll: false })
    );
    expect(result.current).toHaveProperty("current");
    expect(result.current.current).toBeNull();
  });

  it("does not scroll when shouldScroll is false", () => {
    const mockScrollIntoView = jest.fn();
    const { result } = renderHook(() =>
      useScrollToElement({ shouldScroll: false, delay: 0 })
    );

    // Simulate attaching ref to element
    const mockElement = { scrollIntoView: mockScrollIntoView };
    Object.defineProperty(result.current, "current", {
      value: mockElement,
      writable: true,
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockScrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls when shouldScroll is true and element exists", () => {
    const mockScrollIntoView = jest.fn();
    const { result, rerender } = renderHook(
      ({ shouldScroll }) => useScrollToElement({ shouldScroll, delay: 50 }),
      { initialProps: { shouldScroll: false } }
    );

    // Simulate attaching ref to element
    const mockElement = { scrollIntoView: mockScrollIntoView };
    Object.defineProperty(result.current, "current", {
      value: mockElement,
      writable: true,
      configurable: true,
    });

    // Trigger scroll
    rerender({ shouldScroll: true });

    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("uses custom scroll options", () => {
    const mockScrollIntoView = jest.fn();
    const { result, rerender } = renderHook(
      ({ shouldScroll }) =>
        useScrollToElement({
          shouldScroll,
          delay: 0,
          behavior: "auto",
          block: "center",
        }),
      { initialProps: { shouldScroll: false } }
    );

    // Simulate attaching ref to element
    const mockElement = { scrollIntoView: mockScrollIntoView };
    Object.defineProperty(result.current, "current", {
      value: mockElement,
      writable: true,
      configurable: true,
    });

    // Trigger scroll
    rerender({ shouldScroll: true });

    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    });
  });

  it("cleans up timeout on unmount", () => {
    const mockScrollIntoView = jest.fn();
    const { result, unmount, rerender } = renderHook(
      ({ shouldScroll }) => useScrollToElement({ shouldScroll, delay: 100 }),
      { initialProps: { shouldScroll: false } }
    );

    // Simulate attaching ref to element
    const mockElement = { scrollIntoView: mockScrollIntoView };
    Object.defineProperty(result.current, "current", {
      value: mockElement,
      writable: true,
      configurable: true,
    });

    // Trigger scroll
    rerender({ shouldScroll: true });

    // Unmount before timer fires
    unmount();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Should not scroll after unmount
    expect(mockScrollIntoView).not.toHaveBeenCalled();
  });

  it("respects custom delay", () => {
    const mockScrollIntoView = jest.fn();
    const { result, rerender } = renderHook(
      ({ shouldScroll }) => useScrollToElement({ shouldScroll, delay: 200 }),
      { initialProps: { shouldScroll: false } }
    );

    // Simulate attaching ref to element
    const mockElement = { scrollIntoView: mockScrollIntoView };
    Object.defineProperty(result.current, "current", {
      value: mockElement,
      writable: true,
      configurable: true,
    });

    // Trigger scroll
    rerender({ shouldScroll: true });

    // Advance less than delay
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockScrollIntoView).not.toHaveBeenCalled();

    // Advance past delay
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockScrollIntoView).toHaveBeenCalled();
  });
});
