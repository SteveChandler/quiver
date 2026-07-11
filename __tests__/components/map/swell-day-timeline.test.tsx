import { fireEvent, render, screen } from "@testing-library/react";
import type { TimelineDaySegment } from "@/components/map/hourly-swell-timeline";
import {
  SwellDayTimeline,
  type SwellDayTimelineProps,
} from "@/components/map/swell-field/swell-day-timeline";

const timestamps = Array.from({ length: 48 }, (_, index) =>
  new Date(Date.UTC(2026, 6, 10, index)).toISOString(),
);

const daySegments: TimelineDaySegment[] = [
  { key: "2026-07-10", label: "Fri 10", startIndex: 0, endIndex: 23 },
  { key: "2026-07-11", label: "Sat 11", startIndex: 24, endIndex: 47 },
];

function createProps(
  overrides: Partial<SwellDayTimelineProps> = {},
): SwellDayTimelineProps {
  return {
    timestamps,
    index: 0,
    timezone: "Pacific/Honolulu",
    bubbleLabel: "Fri 10 — 2 PM HST",
    daySegments,
    isPlaying: false,
    isLoadingMore: false,
    isExhausted: false,
    error: null,
    onIndexChange: jest.fn(),
    onPlayingChange: jest.fn(),
    onRetry: jest.fn(),
    ...overrides,
  };
}

describe("SwellDayTimeline", () => {
  it("exposes the active local forecast time through the native slider", () => {
    render(<SwellDayTimeline {...createProps()} />);

    expect(screen.getByRole("slider", { name: "Forecast time" }))
      .toHaveAttribute("aria-valuetext", "Fri 10 — 2 PM HST");
    expect(screen.getByTestId("timeline-day-Fri-10")).toHaveTextContent("Fri 10");
    expect(screen.queryByText("Pacific/Honolulu")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("uses the controlled playing value and names the next playback action", () => {
    const onPlayingChange = jest.fn();
    const { rerender } = render(
      <SwellDayTimeline {...createProps({ onPlayingChange })} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play forecast timeline" }));
    expect(onPlayingChange).toHaveBeenCalledWith(true);

    rerender(<SwellDayTimeline {...createProps({ isPlaying: true, onPlayingChange })} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause forecast timeline" }));
    expect(onPlayingChange).toHaveBeenLastCalledWith(false);
  });

  it("moves the controlled index with keyboard steps and clamps endpoints", () => {
    const onIndexChange = jest.fn();
    const { rerender } = render(<SwellDayTimeline {...createProps({ onIndexChange })} />);

    const slider = screen.getByRole("slider", { name: "Forecast time" });
    const arrowEvent = fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(arrowEvent).toBe(false);
    expect(onIndexChange).toHaveBeenCalledWith(1);

    fireEvent.keyDown(slider, { key: "PageDown" });
    expect(onIndexChange).toHaveBeenCalledWith(24);

    fireEvent.keyDown(slider, { key: "Home" });
    expect(onIndexChange).toHaveBeenLastCalledWith(0);

    fireEvent.keyDown(slider, { key: "End" });
    expect(onIndexChange).toHaveBeenLastCalledWith(47);

    rerender(<SwellDayTimeline {...createProps({ index: 25, onIndexChange })} />);
    fireEvent.keyDown(slider, { key: "ArrowUp" });
    expect(onIndexChange).toHaveBeenLastCalledWith(26);
    fireEvent.keyDown(slider, { key: "ArrowDown" });
    expect(onIndexChange).toHaveBeenLastCalledWith(24);
    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(slider, { key: "PageDown" });
    expect(onIndexChange).toHaveBeenLastCalledWith(47);

    rerender(<SwellDayTimeline {...createProps({ index: 0, onIndexChange })} />);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
  });

  it("keeps the bubble inside the track and makes inclusive day bands visual only", () => {
    const { rerender } = render(
      <SwellDayTimeline {...createProps({ index: 0 })} />,
    );

    expect(screen.getByTestId("timeline-bubble")).toHaveStyle({ left: "4%" });
    expect(screen.getByTestId("timeline-track")).toHaveClass("relative");
    const dayLayer = screen.getByTestId("timeline-day-layer");
    expect(dayLayer).toHaveClass("pointer-events-none");
    expect(dayLayer).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("timeline-day-Fri-10")).toHaveStyle({ width: "50%" });
    expect(screen.getByTestId("timeline-day-Sat-11")).toHaveStyle({ width: "50%" });

    rerender(<SwellDayTimeline {...createProps({ index: 47 })} />);
    expect(screen.getByTestId("timeline-bubble")).toHaveStyle({ left: "96%" });
  });

  it("uses inclusive boundaries to position short day segments", () => {
    render(
      <SwellDayTimeline
        {...createProps({
          timestamps: timestamps.slice(0, 3),
          daySegments: [
            { key: "2026-07-10", label: "Fri 10", startIndex: 0, endIndex: 1 },
            { key: "2026-07-11", label: "Sat 11", startIndex: 2, endIndex: 2 },
          ],
        })}
      />,
    );

    expect(screen.getByTestId("timeline-day-Fri-10")).toHaveStyle({
      left: "0%",
      width: "66.66666666666666%",
    });
    expect(screen.getByTestId("timeline-day-Sat-11")).toHaveStyle({
      left: "66.66666666666666%",
      width: "33.33333333333333%",
    });
  });

  it("reports extension states in error, loading, then exhausted precedence", () => {
    const onRetry = jest.fn();
    const { rerender } = render(
      <SwellDayTimeline
        {...createProps({
          error: "Extension unavailable",
          isLoadingMore: true,
          isExhausted: true,
          onRetry,
        })}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Extension unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry loading forecast hours" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<SwellDayTimeline {...createProps({ isLoadingMore: true, isExhausted: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading more forecast hours");

    rerender(<SwellDayTimeline {...createProps({ isExhausted: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Forecast ends Fri 10 — 2 PM HST",
    );
  });

  it("keeps a 44px safe-area-contained control and disables it without a second frame", () => {
    render(
      <SwellDayTimeline
        {...createProps({
          timestamps: [timestamps[0]],
          daySegments: [{ key: "2026-07-10", label: "Fri 10", startIndex: 0, endIndex: 0 }],
        })}
      />,
    );

    const timeline = screen.getByTestId("swell-day-timeline");
    expect(timeline).toHaveClass("fixed", "pb-[max(0.75rem,env(safe-area-inset-bottom))]");
    const playButton = screen.getByRole("button", { name: "Play forecast timeline" });
    expect(playButton).toHaveClass("h-11", "w-11", "rounded-full");
    expect(playButton).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Forecast time" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Forecast time" })).toHaveClass(
      "focus-visible:ring-[#FDB84B]",
    );
  });

  it("returns no timeline for an empty, settled forecast but retains feedback shells", () => {
    const { rerender } = render(
      <SwellDayTimeline
        {...createProps({ timestamps: [], daySegments: [], bubbleLabel: "" })}
      />,
    );

    expect(screen.queryByTestId("swell-day-timeline")).not.toBeInTheDocument();

    rerender(
      <SwellDayTimeline
        {...createProps({
          timestamps: [],
          daySegments: [],
          bubbleLabel: "",
          isLoadingMore: true,
        })}
      />,
    );
    expect(screen.getByTestId("swell-day-timeline")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading more forecast hours");
  });
});
