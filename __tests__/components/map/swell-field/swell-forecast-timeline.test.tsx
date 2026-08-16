import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { SwellForecastTimeline } from "@/components/map/swell-field/swell-forecast-timeline";

function TimelineHarness({
  initialIndex = 0,
}: {
  initialIndex?: number;
}): ReactElement {
  const [index, setIndex] = useState(initialIndex);

  return (
    <>
      <SwellForecastTimeline
        steps={["Now", "+3h", "+6h"]}
        index={index}
        onIndexChange={setIndex}
      />
      <output data-testid="timeline-index">{index}</output>
    </>
  );
}

describe("SwellForecastTimeline", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("plays the forecast timeline forward and can pause playback", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<TimelineHarness />);

    await user.click(
      screen.getByRole("button", { name: "Play forecast timeline" }),
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });

    const range = screen.getByTestId("swell-timeline-range") as HTMLInputElement;
    expect(Number(range.value)).toBeGreaterThan(0);
    expect(Number(range.value)).toBeLessThan(1);

    act(() => {
      jest.advanceTimersByTime(900);
    });

    expect(screen.getByText("+3h")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Pause forecast timeline" }),
    );

    act(() => {
      jest.advanceTimersByTime(1800);
    });

    expect(screen.getByText("+3h")).toBeInTheDocument();
  });

  it("keeps playback discrete for reduced-motion users", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<TimelineHarness />);

    await user.click(
      screen.getByRole("button", { name: "Play forecast timeline" }),
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(screen.getByTestId("timeline-index")).toHaveTextContent("0");

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    expect(screen.getByText("+3h")).toBeInTheDocument();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("plays the final reduced-motion step before wrapping", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<TimelineHarness initialIndex={1} />);

    await user.click(
      screen.getByRole("button", { name: "Play forecast timeline" }),
    );

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    expect(screen.getByText("+6h")).toBeInTheDocument();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("can render inline inside the map legend", () => {
    render(
      <SwellForecastTimeline
        steps={["Now", "+3h", "+6h"]}
        index={0}
        onIndexChange={jest.fn()}
        placement="legend"
      />,
    );

    const timeline = screen.getByTestId("swell-forecast-timeline");
    const range = screen.getByTestId("swell-timeline-range");

    expect(timeline.className).toContain("w-full");
    expect(timeline.className).not.toContain("absolute");
    expect(range.className).toContain("flex-1");
    expect(range).toHaveClass("h-11");
    expect(
      screen.getByRole("button", { name: "Play forecast timeline" }),
    ).toHaveClass("h-11", "w-11");
    expect(
      screen.getByRole("button", { name: "Previous forecast step" }),
    ).toHaveClass("min-h-11", "min-w-11");
  });
});
