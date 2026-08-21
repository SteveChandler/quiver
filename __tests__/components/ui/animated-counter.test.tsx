import { act, render, screen, waitFor } from "@testing-library/react";

import { AnimatedCounter } from "@/components/ui/animated-counter";

/**
 * Installs an IntersectionObserver stub whose callbacks can be fired on demand,
 * so a test can distinguish "scrolled into view" from "never intersected".
 * jest.setup.js installs a stub that never fires; this narrows that to one test.
 */
function captureObservers() {
  const callbacks: IntersectionObserverCallback[] = [];
  const disconnect = jest.fn();

  (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    jest.fn((callback: IntersectionObserverCallback) => {
      callbacks.push(callback);
      return { observe: jest.fn(), unobserve: jest.fn(), disconnect };
    });

  return {
    callbacks,
    disconnect,
    enterView() {
      for (const callback of callbacks) {
        act(() => {
          callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver
          );
        });
      }
    },
  };
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
    onchange: null,
  }));
}

describe("AnimatedCounter", () => {
  const originalMatchMedia = window.matchMedia;
  const originalObserver = global.IntersectionObserver;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    global.IntersectionObserver = originalObserver;
    jest.restoreAllMocks();
  });

  it("shows the true value when the scroll observer never fires", () => {
    // The regression: the counter used to reset itself to 0 on hydration and
    // only recover once IntersectionObserver fired, so every below-the-fold
    // counter held 0 for anything reading the DOM without scrolling —
    // print, screenshots, Cmd+F, OG renderers and search crawlers included.
    setReducedMotion(false);
    render(<AnimatedCounter value={35} />);

    expect(screen.getByText("35")).toBeInTheDocument();
  });

  it("keeps decimals and affixes intact while unintersected", () => {
    setReducedMotion(false);
    render(<AnimatedCounter value={2.4} decimals={1} suffix="ft" />);

    expect(screen.getByText("2.4ft")).toBeInTheDocument();
  });

  it("still counts up from zero once scrolled into view", () => {
    setReducedMotion(false);
    const observers = captureObservers();

    // Drive rAF by hand so the count-up is observed frame by frame rather than
    // raced against a real clock.
    const frames: FrameRequestCallback[] = [];
    jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
    jest.spyOn(performance, "now").mockReturnValue(1000);

    render(<AnimatedCounter value={50} duration={100} />);
    expect(screen.getByText("50")).toBeInTheDocument();

    observers.enterView();

    // The reset to 0 belongs to the animation, so it lands the moment the
    // count-up starts — never before.
    expect(screen.getByText("0")).toBeInTheDocument();

    act(() => {
      (performance.now as jest.Mock).mockReturnValue(1050);
      frames.shift()?.(1050);
    });
    // The aria-label always carries the true value, so it is a stable handle
    // on the element while its visible text is mid-animation.
    const midpoint = Number(screen.getByLabelText("50").textContent);
    expect(midpoint).toBeGreaterThan(0);
    expect(midpoint).toBeLessThan(50);

    act(() => {
      (performance.now as jest.Mock).mockReturnValue(1100);
      frames.shift()?.(1100);
    });
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("stops observing, and never counts up, under reduced motion", () => {
    setReducedMotion(true);
    const observers = captureObservers();
    render(<AnimatedCounter value={35} />);

    // useReducedMotion reports false on the first render and flips in its own
    // effect, so one observer is created before the preference is known; what
    // matters is that it is torn down and the true value is never disturbed.
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(observers.disconnect).toHaveBeenCalled();
  });

  it("exposes the true value to assistive tech at all times", () => {
    setReducedMotion(false);
    render(<AnimatedCounter value={106} suffix=" beaches" />);

    expect(
      screen.getByLabelText("106 beaches")
    ).toBeInTheDocument();
  });
});
