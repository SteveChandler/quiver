/**
 * Tests for SessionCelebration Component
 *
 * Covers: session count message, condition-reactive subtitle,
 * auto-dismiss timer, onDismiss callback, and reduced-motion behaviour.
 */

import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import {
  SessionCelebration,
  buildSubtitle,
} from "@/components/session/session-celebration";

// ---------------------------------------------------------------------------
// Framer-motion stub — strips all animation machinery so tests run fast
// ---------------------------------------------------------------------------
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: {
      div: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
          const {
            variants: _v,
            initial: _i,
            animate: _a,
            exit: _e,
            transition: _t,
            whileInView: _w,
            ...rest
          } = props;
          return <div ref={ref} {...rest} />;
        }
      ),
    },
    // useReducedMotion returns false by default; individual tests override via matchMedia
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// ---------------------------------------------------------------------------
// canvas-confetti stub — prevents real canvas operations in jsdom
// ---------------------------------------------------------------------------
jest.mock("canvas-confetti", () => jest.fn());

// ---------------------------------------------------------------------------
// matchMedia default stub (no reduced-motion)
// ---------------------------------------------------------------------------
function mockMatchMedia(prefersReduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: prefersReduced && query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------
const defaultProps = {
  sessionNumber: 14,
  beachName: "Ocean Beach",
  onDismiss: jest.fn(),
};

describe("SessionCelebration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockMatchMedia(false);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  describe("Rendering", () => {
    it("renders the session count headline", () => {
      render(<SessionCelebration {...defaultProps} />);
      expect(
        screen.getByText("Session #14 in the books.")
      ).toBeInTheDocument();
    });

    it("renders a different session number correctly", () => {
      render(<SessionCelebration {...defaultProps} sessionNumber={1} />);
      expect(screen.getByText("Session #1 in the books.")).toBeInTheDocument();
    });

    it("renders the XP badge when xpEarned > 0", () => {
      render(<SessionCelebration {...defaultProps} xpEarned={50} />);
      expect(screen.getByTestId("xp-badge")).toHaveTextContent("+50 XP");
    });

    it("does not render the XP badge when xpEarned is 0", () => {
      render(<SessionCelebration {...defaultProps} xpEarned={0} />);
      expect(screen.queryByTestId("xp-badge")).not.toBeInTheDocument();
    });

    it("does not render the XP badge when xpEarned is omitted", () => {
      render(<SessionCelebration {...defaultProps} />);
      expect(screen.queryByTestId("xp-badge")).not.toBeInTheDocument();
    });

    it("has the correct dialog role and aria attributes", () => {
      render(<SessionCelebration {...defaultProps} />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-label", "Session #14 logged");
    });
  });

  // -------------------------------------------------------------------------
  // Condition-reactive subtitle
  // -------------------------------------------------------------------------
  describe("Condition-reactive subtitle", () => {
    it("shows good-conditions subtitle when offshore + rating >= 4", () => {
      render(
        <SessionCelebration
          {...defaultProps}
          waveHeight={4}
          windCondition="offshore"
          rating={5}
        />
      );
      expect(
        screen.getByText("4ft at Ocean Beach with offshore winds. Nice one.")
      ).toBeInTheDocument();
    });

    it("shows good-conditions subtitle at the boundary (rating exactly 4)", () => {
      render(
        <SessionCelebration
          {...defaultProps}
          waveHeight={3}
          windCondition="offshore"
          rating={4}
        />
      );
      expect(
        screen.getByText("3ft at Ocean Beach with offshore winds. Nice one.")
      ).toBeInTheDocument();
    });

    it("shows tough-conditions subtitle when onshore wind", () => {
      render(
        <SessionCelebration
          {...defaultProps}
          waveHeight={2}
          windCondition="onshore"
          rating={3}
        />
      );
      expect(
        screen.getByText(
          "Tough conditions at Ocean Beach. Respect for paddling out."
        )
      ).toBeInTheDocument();
    });

    it("shows tough-conditions subtitle when rating <= 2 (regardless of wind)", () => {
      render(
        <SessionCelebration
          {...defaultProps}
          waveHeight={5}
          windCondition="cross-shore"
          rating={2}
        />
      );
      expect(
        screen.getByText(
          "Tough conditions at Ocean Beach. Respect for paddling out."
        )
      ).toBeInTheDocument();
    });

    it("shows neutral subtitle when offshore but rating < 4", () => {
      render(
        <SessionCelebration
          {...defaultProps}
          waveHeight={3}
          windCondition="offshore"
          rating={3}
        />
      );
      expect(
        screen.getByText("3ft at Ocean Beach. Logged.")
      ).toBeInTheDocument();
    });

    it("shows neutral subtitle when no conditions provided", () => {
      render(
        <SessionCelebration {...defaultProps} beachName="Rincon" />
      );
      expect(screen.getByText("Rincon. Logged.")).toBeInTheDocument();
    });

    it("includes wave height in neutral subtitle when provided", () => {
      render(
        <SessionCelebration
          {...defaultProps}
          waveHeight={6}
          beachName="Mavericks"
        />
      );
      expect(screen.getByText("6ft at Mavericks. Logged.")).toBeInTheDocument();
    });

    it("omits wave height prefix when waveHeight is not provided", () => {
      render(
        <SessionCelebration
          {...defaultProps}
          windCondition="offshore"
          rating={5}
          beachName="Trestles"
        />
      );
      // With no waveHeight, heightPrefix is just beachName
      expect(
        screen.getByText("Trestles with offshore winds. Nice one.")
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Auto-dismiss after 3 seconds
  // -------------------------------------------------------------------------
  describe("Auto-dismiss behaviour", () => {
    it("does not call onDismiss before 3 seconds", () => {
      const onDismiss = jest.fn();
      render(<SessionCelebration {...defaultProps} onDismiss={onDismiss} />);

      act(() => {
        jest.advanceTimersByTime(2999);
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("calls onDismiss after 3 seconds", () => {
      const onDismiss = jest.fn();
      render(<SessionCelebration {...defaultProps} onDismiss={onDismiss} />);

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("clears the auto-dismiss timer on unmount", () => {
      const onDismiss = jest.fn();
      const { unmount } = render(
        <SessionCelebration {...defaultProps} onDismiss={onDismiss} />
      );

      unmount();

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // onDismiss callback — user interactions
  // -------------------------------------------------------------------------
  describe("onDismiss callback", () => {
    it("calls onDismiss when the overlay is clicked", () => {
      const onDismiss = jest.fn();
      render(<SessionCelebration {...defaultProps} onDismiss={onDismiss} />);

      act(() => {
        fireEvent.click(screen.getByTestId("session-celebration"));
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("calls onDismiss when Escape is pressed", () => {
      const onDismiss = jest.fn();
      render(<SessionCelebration {...defaultProps} onDismiss={onDismiss} />);

      act(() => {
        fireEvent.keyDown(document, { key: "Escape" });
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("does not call onDismiss when a non-Escape key is pressed", () => {
      const onDismiss = jest.fn();
      render(<SessionCelebration {...defaultProps} onDismiss={onDismiss} />);

      act(() => {
        fireEvent.keyDown(document, { key: "Enter" });
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Reduced motion
  // -------------------------------------------------------------------------
  describe("Reduced motion", () => {
    it("still renders content when prefers-reduced-motion is set", () => {
      // Re-mock framer-motion's useReducedMotion to return true for this test
      jest.doMock("framer-motion", () => {
        const React = require("react");
        return {
          motion: {
            div: React.forwardRef(
              (
                props: Record<string, unknown>,
                ref: React.Ref<HTMLDivElement>
              ) => {
                const {
                  variants: _v,
                  initial: _i,
                  animate: _a,
                  exit: _e,
                  transition: _t,
                  ...rest
                } = props;
                return <div ref={ref} {...rest} />;
              }
            ),
          },
          useReducedMotion: () => true,
          AnimatePresence: ({ children }: { children: React.ReactNode }) => (
            <>{children}</>
          ),
        };
      });

      mockMatchMedia(true);

      // Component is already imported with the module-level mock; the content
      // should still appear regardless of motion preference.
      render(<SessionCelebration {...defaultProps} sessionNumber={7} />);

      expect(
        screen.getByText("Session #7 in the books.")
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Unit tests for the pure buildSubtitle helper
// ---------------------------------------------------------------------------
describe("buildSubtitle (pure helper)", () => {
  it("returns good subtitle for offshore + high rating", () => {
    expect(buildSubtitle("Ocean Beach", 4, "offshore", 5)).toBe(
      "4ft at Ocean Beach with offshore winds. Nice one."
    );
  });

  it("returns good subtitle at minimum threshold (rating 4)", () => {
    expect(buildSubtitle("Rincon", 3, "offshore", 4)).toBe(
      "3ft at Rincon with offshore winds. Nice one."
    );
  });

  it("returns tough subtitle for onshore wind", () => {
    expect(buildSubtitle("Huntington", 2, "onshore", 3)).toBe(
      "Tough conditions at Huntington. Respect for paddling out."
    );
  });

  it("returns tough subtitle for rating <= 2", () => {
    expect(buildSubtitle("Trestles", 5, "cross-shore", 2)).toBe(
      "Tough conditions at Trestles. Respect for paddling out."
    );
  });

  it("returns neutral subtitle when no wind or rating", () => {
    expect(buildSubtitle("Mavericks", 10)).toBe("10ft at Mavericks. Logged.");
  });

  it("returns neutral subtitle with only beach name when nothing provided", () => {
    expect(buildSubtitle("Steamer Lane")).toBe("Steamer Lane. Logged.");
  });

  it("does not include wave height prefix when waveHeight is undefined", () => {
    expect(buildSubtitle("Blacks Beach", undefined, "offshore", 5)).toBe(
      "Blacks Beach with offshore winds. Nice one."
    );
  });
});
