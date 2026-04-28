import React from "react";
import { act, render, screen } from "@testing-library/react";
import { OracleHero } from "@/components/oracle/oracle-hero";

// Mock framer-motion to avoid animation complexity in tests.
// Follows the established pattern from hero-section.test.tsx.
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: {
      div: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
          const {
            variants: _variants,
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            whileInView: _whileInView,
            viewport: _viewport,
            ...rest
          } = props;
          return <div ref={ref} {...rest} />;
        }
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

const DEFAULT_PROPS = {
  beachName: "Blacks Beach",
  heroPhotoUrl: "https://example.com/blacks.jpg",
  waveHeight: "4-5ft",
  score: 9.2,
  swellDirection: "WNW",
  swellPeriod: 14,
  tideHeight: 3.2,
  tideDirection: "rising" as const,
  waterTemp: 58,
  windSpeed: 8,
  windDirection: "NW",
  bestWindowTitle: "Dawn patrol is your move",
  bestWindowSubtitle: "Wind shifts onshore by 10am",
  bestWindowTime: "5:45a",
  shouldAnimate: false,
};

// Pin time to 9am so greeting tests are deterministic
beforeAll(() => {
  jest.useFakeTimers({
    doNotFake: [
      "nextTick",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
      "queueMicrotask",
    ],
  });
  jest.setSystemTime(new Date("2026-03-10T09:00:00.000Z"));
});

afterAll(() => {
  jest.useRealTimers();
});

describe("OracleHero", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders beach name", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(screen.getByText("Blacks Beach")).toBeInTheDocument();
  });

  it("renders wave height", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    // When shouldAnimate is false, the wave height is shown immediately.
    expect(
      screen.getByRole("heading", { level: 1 })
    ).toHaveTextContent("4-5ft");
  });

  it("renders wave height with correct aria-label", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(
      screen.getByLabelText("Wave height 4-5ft")
    ).toBeInTheDocument();
  });

  it("renders score badge", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(screen.getByLabelText("Surf score 9.2 out of 10")).toBeInTheDocument();
    expect(screen.getByText("9.2/10")).toBeInTheDocument();
  });

  it("renders best window callout", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(screen.getByText("Dawn patrol is your move")).toBeInTheDocument();
    expect(screen.getByText("Wind shifts onshore by 10am")).toBeInTheDocument();
    expect(screen.getByText("5:45a")).toBeInTheDocument();
  });

  it("renders swell details — direction and period", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(screen.getByText("WNW 14s")).toBeInTheDocument();
  });

  it("renders swell details — tide", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(screen.getByText("3.2ft Rising")).toBeInTheDocument();
  });

  it("renders swell details — water temperature", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(screen.getByText("58°F")).toBeInTheDocument();
  });

  it("renders wind indicator label", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(screen.getByText("NW 8mph")).toBeInTheDocument();
  });

  it("renders with role banner", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders banner with descriptive aria-label", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(
      screen.getByRole("banner", { name: "Blacks Beach surf conditions" })
    ).toBeInTheDocument();
  });

  it("renders falling tide direction correctly", () => {
    render(<OracleHero {...DEFAULT_PROPS} tideDirection="falling" />);
    expect(screen.getByText("3.2ft Falling")).toBeInTheDocument();
  });

  it("renders optional greeting when userName provided", () => {
    // System time is 9am UTC = 1am PST (hour < 7) and score=9.2 > 7 → dawn patrol greeting.
    render(<OracleHero {...DEFAULT_PROPS} userName="Alex" />);
    expect(screen.getByText("It's going off. Dawn patrol, Alex.")).toBeInTheDocument();
  });

  it("renders level title badge when levelTitle provided", () => {
    render(
      <OracleHero
        {...DEFAULT_PROPS}
        userName="Alex"
        levelTitle="Local Legend"
      />
    );
    expect(screen.getByText("Local Legend")).toBeInTheDocument();
  });

  it("renders XP total when xpTotal provided", () => {
    render(
      <OracleHero
        {...DEFAULT_PROPS}
        userName="Alex"
        xpTotal={1250}
      />
    );
    expect(screen.getByText(/1,250 XP/)).toBeInTheDocument();
  });

  it("does not render greeting section when no user info provided", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(screen.queryByText(/Good morning/)).not.toBeInTheDocument();
  });

  it("calls onAnimationComplete after animation delay when shouldAnimate is true", () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();

    render(
      <OracleHero
        {...DEFAULT_PROPS}
        shouldAnimate={true}
        onAnimationComplete={onComplete}
      />
    );

    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it("does not call onAnimationComplete when shouldAnimate is false", () => {
    jest.useFakeTimers();
    const onComplete = jest.fn();

    render(
      <OracleHero
        {...DEFAULT_PROPS}
        shouldAnimate={false}
        onAnimationComplete={onComplete}
      />
    );

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(onComplete).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it("renders score formatted to one decimal place", () => {
    render(<OracleHero {...DEFAULT_PROPS} score={8} />);
    expect(screen.getByText("8.0/10")).toBeInTheDocument();
  });

  it("renders a different beach name correctly", () => {
    render(<OracleHero {...DEFAULT_PROPS} beachName="Ocean Beach" />);
    expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
    expect(
      screen.getByRole("banner", { name: "Ocean Beach surf conditions" })
    ).toBeInTheDocument();
  });

  it("renders whySentence as a distinct prose line under the best-window card", () => {
    render(
      <OracleHero
        {...DEFAULT_PROPS}
        whySentence="Solid window with offshore winds before the tide drops."
      />
    );
    const sentence = screen.getByTestId("hero-why-sentence");
    expect(sentence).toBeInTheDocument();
    expect(sentence).toHaveTextContent(
      "Solid window with offshore winds before the tide drops."
    );
  });

  it("does not render the why-sentence node when whySentence is absent", () => {
    render(<OracleHero {...DEFAULT_PROPS} />);
    expect(screen.queryByTestId("hero-why-sentence")).not.toBeInTheDocument();
    // Subtitle inside the best-window card still renders.
    expect(screen.getByText("Wind shifts onshore by 10am")).toBeInTheDocument();
  });

  it("does not duplicate the same sentence when subtitle and whySentence differ", () => {
    render(
      <OracleHero
        {...DEFAULT_PROPS}
        bestWindowSubtitle="Clean WNW swell"
        whySentence="Solid window with offshore winds before the tide drops."
      />
    );
    // Both copies appear exactly once in the hero — the subtitle inside the
    // card and the why-sentence below it must be distinct strings.
    expect(screen.getAllByText("Clean WNW swell")).toHaveLength(1);
    expect(
      screen.getAllByText(
        "Solid window with offshore winds before the tide drops."
      )
    ).toHaveLength(1);
  });
});
