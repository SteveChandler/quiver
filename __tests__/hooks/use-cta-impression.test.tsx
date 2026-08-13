import { renderHook, act } from "@testing-library/react";
import { useCtaImpression } from "@/hooks/use-cta-impression";

const mockTrack = jest.fn();
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

type ObserverCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver,
) => void;

let observerCallback: ObserverCallback | null;
let disconnectSpy: jest.Mock;
let observeSpy: jest.Mock;
let unobserveSpy: jest.Mock;
let observerConstructorSpy: jest.Mock;
let originalIntersectionObserver: typeof IntersectionObserver | undefined;

function installMockIntersectionObserver(): void {
  disconnectSpy = jest.fn();
  observeSpy = jest.fn();
  unobserveSpy = jest.fn();
  observerCallback = null;

  observerConstructorSpy = jest.fn((cb: ObserverCallback) => {
    observerCallback = cb;
    return {
      observe: observeSpy,
      disconnect: disconnectSpy,
      unobserve: unobserveSpy,
      takeRecords: jest.fn(() => []),
      root: null,
      rootMargin: "",
      thresholds: [],
    };
  });

  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: observerConstructorSpy,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: observerConstructorSpy,
  });
}

/**
 * Renders the hook, attaches its ref to a real DOM element, and re-runs the
 * effect so the mock IntersectionObserver begins observing that element.
 */
function renderWithAttachedRef(
  options: Parameters<typeof useCtaImpression>[0],
) {
  const element = document.createElement("div");
  const { result, rerender, unmount } = renderHook(
    (props: Parameters<typeof useCtaImpression>[0]) => {
      const ref = useCtaImpression<HTMLDivElement>(props);
      // Assign the DOM element on every render so the effect sees it.
      (ref as { current: HTMLDivElement | null }).current = element;
      return ref;
    },
    { initialProps: options },
  );

  // Force the effect to re-run now that the ref points at a real element.
  act(() => {
    rerender({ ...options });
  });

  return { result, rerender, unmount, element };
}

function fireIntersection(ratio: number, isIntersecting = true): void {
  if (!observerCallback) {
    throw new Error("IntersectionObserver callback was never registered");
  }
  const entry = {
    isIntersecting,
    intersectionRatio: ratio,
    target: document.createElement("div"),
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRect: {} as DOMRectReadOnly,
    rootBounds: null,
    time: 0,
  } as IntersectionObserverEntry;

  act(() => {
    observerCallback!([entry], {} as IntersectionObserver);
  });
}

describe("useCtaImpression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    originalIntersectionObserver = (
      globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver }
    ).IntersectionObserver;
    installMockIntersectionObserver();
  });

  afterEach(() => {
    if (originalIntersectionObserver) {
      Object.defineProperty(window, "IntersectionObserver", {
        configurable: true,
        writable: true,
        value: originalIntersectionObserver,
      });
      Object.defineProperty(globalThis, "IntersectionObserver", {
        configurable: true,
        writable: true,
        value: originalIntersectionObserver,
      });
    }
  });

  it("fires exactly once when the element crosses the default threshold", () => {
    renderWithAttachedRef({
      ctaId: "inline_signup_beach_detail",
      surface: "beach_detail",
    });

    fireIntersection(0.5);

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("cta_impression", {
      metadata: {
        cta_id: "inline_signup_beach_detail",
        surface: "beach_detail",
        viewport_pct: 50,
      },
    });
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it("does not fire below threshold, then fires once when it crosses", () => {
    renderWithAttachedRef({
      ctaId: "inline_signup_beach_detail",
      surface: "beach_detail",
    });

    fireIntersection(0.3);
    expect(mockTrack).not.toHaveBeenCalled();

    fireIntersection(0.7);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("cta_impression", {
      metadata: {
        cta_id: "inline_signup_beach_detail",
        surface: "beach_detail",
        viewport_pct: 70,
      },
    });
  });

  it("fires exactly once even when multiple above-threshold callbacks arrive", () => {
    renderWithAttachedRef({
      ctaId: "inline_signup_beach_detail",
      surface: "beach_detail",
    });

    fireIntersection(0.6);
    fireIntersection(0.8);
    fireIntersection(0.95);

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("cta_impression", {
      metadata: {
        cta_id: "inline_signup_beach_detail",
        surface: "beach_detail",
        viewport_pct: 60,
      },
    });
    // Observer disconnected immediately after first fire.
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it("respects enabled: false and fires once when re-enabled", () => {
    const { unmount } = renderWithAttachedRef({
      ctaId: "inline_signup_beach_detail",
      surface: "beach_detail",
      enabled: false,
    });

    // When disabled, the hook should not even construct an observer.
    expect(observerConstructorSpy).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();

    unmount();

    // Re-mount with enabled: true to confirm tracking works when allowed.
    renderWithAttachedRef({
      ctaId: "inline_signup_beach_detail",
      surface: "beach_detail",
      enabled: true,
    });

    fireIntersection(0.6);
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it("cleans up the observer on unmount before firing", () => {
    const { unmount } = renderWithAttachedRef({
      ctaId: "inline_signup_beach_detail",
      surface: "beach_detail",
    });

    expect(disconnectSpy).not.toHaveBeenCalled();

    unmount();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("is SSR-safe when IntersectionObserver is undefined", () => {
    // Remove the mock so the hook hits the SSR guard.
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(() => {
      renderWithAttachedRef({
        ctaId: "inline_signup_beach_detail",
        surface: "beach_detail",
      });
    }).not.toThrow();

    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("respects a custom threshold", () => {
    renderWithAttachedRef({
      ctaId: "inline_signup_beach_detail",
      surface: "beach_detail",
      threshold: 0.8,
    });

    fireIntersection(0.7);
    expect(mockTrack).not.toHaveBeenCalled();

    fireIntersection(0.9);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("cta_impression", {
      metadata: {
        cta_id: "inline_signup_beach_detail",
        surface: "beach_detail",
        viewport_pct: 90,
      },
    });
  });

  it("merges extra metadata into the event payload", () => {
    renderWithAttachedRef({
      ctaId: "inline_signup_beach_detail",
      surface: "beach_detail",
      extra: { variant: "control", position: "above_fold" },
    });

    fireIntersection(0.5);

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("cta_impression", {
      metadata: {
        cta_id: "inline_signup_beach_detail",
        surface: "beach_detail",
        viewport_pct: 50,
        variant: "control",
        position: "above_fold",
      },
    });
  });

  it("runs the impression callback exactly once with the first qualifying entry", () => {
    const onImpression = jest.fn();

    renderWithAttachedRef({
      ctaId: "app_handoff_beach_detail",
      surface: "beach_detail",
      onImpression,
    });

    fireIntersection(0.7);
    fireIntersection(0.9);

    expect(onImpression).toHaveBeenCalledTimes(1);
    expect(onImpression).toHaveBeenCalledWith(
      expect.objectContaining({
        isIntersecting: true,
        intersectionRatio: 0.7,
      }),
    );
  });
});
