import { fireEvent, render, screen } from "@testing-library/react";
import type { TimelineDaySegment } from "@/components/map/hourly-swell-timeline";
import {
  advancePlaybackPosition,
  compactTimelineDayLabel,
  findAdjacentLocalDayIndex,
  getPlaybackVisualFrameMs,
  PLAYBACK_TARGET_DURATION_MS,
  timelineDayLabelClasses,
  timelineDayLabelWidthPercent,
  SwellDayTimeline,
  type SwellDayTimelineProps,
} from "@/components/map/swell-field/swell-day-timeline";
import {
  SWELL_LAYER_COLOR,
  SWELL_MAP_LEGEND_SURFACE,
  SWELL_MAP_STICKER_SHADOW,
  SWELL_MAP_TIMELINE,
} from "@/components/map/swell-map-theme";

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
  it("advances the visual playhead continuously between forecast frames", () => {
    expect(advancePlaybackPosition(2, 125, 10)).toBe(2.25);
    expect(advancePlaybackPosition(2.25, 125, 10)).toBe(2.5);
    expect(advancePlaybackPosition(9.9, 100, 10)).toBe(10);
  });

  it("adapts playback duration to short and full forecast horizons", () => {
    const shortHorizonFrameMs = getPlaybackVisualFrameMs(24 + 1);
    const threeDayHorizonFrameMs = getPlaybackVisualFrameMs(72 + 1);
    const fullHorizonFrameMs = getPlaybackVisualFrameMs(240 + 1);

    expect(shortHorizonFrameMs * 24).toBe(PLAYBACK_TARGET_DURATION_MS);
    expect(threeDayHorizonFrameMs * 72).toBe(PLAYBACK_TARGET_DURATION_MS);
    expect(fullHorizonFrameMs * 240).toBe(PLAYBACK_TARGET_DURATION_MS);
    expect(advancePlaybackPosition(0, PLAYBACK_TARGET_DURATION_MS, 240, fullHorizonFrameMs))
      .toBe(240);
  });

  it("falls back to the viewport breakpoint for day labels before the track is measured", () => {
    expect(compactTimelineDayLabel("Sat 8")).toBe("8");
    expect(compactTimelineDayLabel("Mon 17")).toBe("17");
    expect(timelineDayLabelWidthPercent(0, 1, 12)).toBeCloseTo(16.67, 1);
    expect(timelineDayLabelClasses(null)).toEqual({
      full: "hidden truncate sm:inline",
      compact: "tabular-nums sm:hidden",
    });

    render(<SwellDayTimeline {...createProps()} />);

    expect(screen.getByTestId("timeline-day-Fri-10")).toHaveClass("text-xs");
    expect(screen.getByTestId("timeline-day-Fri-10-compact")).toHaveClass(
      "tabular-nums",
      "sm:hidden",
    );
  });

  it("picks the full or short day label from the measured band width, not the viewport", () => {
    expect(timelineDayLabelClasses(63)).toEqual({ full: "hidden", compact: "inline tabular-nums" });
    expect(timelineDayLabelClasses(64)).toEqual({ full: "inline truncate", compact: "hidden tabular-nums" });

    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function measure(this: HTMLElement) {
      const rect = originalRect.call(this);
      if (this.dataset.testid === "timeline-track") {
        return { ...rect, width: 600, toJSON: () => ({}) } as DOMRect;
      }
      return rect;
    };
    try {
      const hourly = Array.from({ length: 12 }, (_, index) =>
        new Date(Date.UTC(2026, 6, 10, index)).toISOString(),
      );
      render(
        <SwellDayTimeline
          {...createProps({
            timestamps: hourly,
            timezone: "UTC",
            daySegments: [
              // 2/12 of 600px = 100px: wide enough for "Fri 10".
              { key: "2026-07-10", label: "Fri 10", startIndex: 0, endIndex: 1 },
              // 1/12 of 600px = 50px: date number only.
              { key: "2026-07-11", label: "Sat 11", startIndex: 2, endIndex: 2 },
              { key: "2026-07-12", label: "Sun 12", startIndex: 3, endIndex: 11 },
            ],
          })}
        />,
      );

      expect(screen.getByTestId("timeline-day-Fri-10-compact")).toHaveClass("hidden");
      expect(screen.getByTestId("timeline-day-Sat-11-compact")).toHaveClass("inline");
      expect(screen.getByTestId("timeline-day-Sat-11-compact")).toHaveTextContent("11");
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });

  it("labels a midday current-day segment Today without changing its proportional width", () => {
    const middayTimestamps = Array.from({ length: 24 }, (_, index) =>
      new Date(Date.UTC(2026, 6, 10, 12 + index)).toISOString(),
    );

    render(
      <SwellDayTimeline
        {...createProps({
          timestamps: middayTimestamps,
          timezone: "UTC",
          daySegments: [
            { key: "2026-07-10", label: "Fri 10", startIndex: 0, endIndex: 11 },
            { key: "2026-07-11", label: "Sat 11", startIndex: 12, endIndex: 23 },
          ],
        })}
      />,
    );

    const today = screen.getByTestId("timeline-day-Fri-10");
    expect(today).toHaveStyle({ width: "50%" });
    expect(today).toHaveTextContent("Today · 12h left");
    expect(today).toHaveAttribute("title", "Today · 12h left");
  });

  it("exposes the active local forecast time through the native slider", () => {
    render(<SwellDayTimeline {...createProps()} />);

    expect(screen.getByRole("slider", { name: "Forecast time" }))
      .toHaveAttribute("aria-valuetext", "Fri 10 — 2 PM HST");
    expect(screen.getByTestId("timeline-day-Fri-10")).toHaveTextContent("Today");
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

  it("keeps playback progress above the day labels", () => {
    render(<SwellDayTimeline {...createProps({ index: 12, isPlaying: true })} />);

    expect(screen.getByTestId("timeline-progress")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-visual-track")).toHaveClass("bottom-8");
    expect(screen.getByRole("slider", { name: "Forecast time" })).toHaveClass("opacity-0");
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

  it("moves PageUp and PageDown by local calendar date across DST and missing frames", () => {
    const spring = [
      "2026-03-07T10:00:00.000Z", // 2 AM PST
      "2026-03-08T09:00:00.000Z", // 1 AM PST; 2 AM does not exist
      "2026-03-08T10:00:00.000Z", // 3 AM PDT
      "2026-03-09T09:00:00.000Z", // 2 AM PDT
    ];
    expect(findAdjacentLocalDayIndex(spring, 0, "America/Los_Angeles", 1)).toBe(1);
    expect(findAdjacentLocalDayIndex(spring, 3, "America/Los_Angeles", -1)).toBe(2);

    const fall = [
      "2026-10-31T08:00:00.000Z", // 1 AM PDT
      "2026-11-01T08:00:00.000Z", // first 1 AM PDT
      "2026-11-01T09:00:00.000Z", // second 1 AM PST
      "2026-11-02T09:00:00.000Z", // 1 AM PST
    ];
    expect(findAdjacentLocalDayIndex(fall, 0, "America/Los_Angeles", 1)).toBe(1);
    expect(findAdjacentLocalDayIndex(fall, 3, "America/Los_Angeles", -1)).toBe(2);

    const gap = [
      "2026-07-10T15:00:00.000Z", // 8 AM
      "2026-07-11T14:00:00.000Z", // 7 AM, 8 AM missing
      "2026-07-11T16:00:00.000Z", // 9 AM
      "2026-07-12T15:00:00.000Z", // 8 AM
    ];
    expect(findAdjacentLocalDayIndex(gap, 0, "America/Los_Angeles", 1)).toBe(1);
    expect(findAdjacentLocalDayIndex(gap, 3, "America/Los_Angeles", -1)).toBe(2);
  });

  it("keeps the bubble inside the track and makes inclusive day bands visual only", () => {
    const { rerender } = render(
      <SwellDayTimeline {...createProps({ index: 0 })} />,
    );

    expect(screen.getByTestId("timeline-bubble")).toHaveStyle({
      left: "0%",
      transform: "translateX(0)",
    });
    expect(screen.getByTestId("timeline-bubble")).toHaveClass("whitespace-nowrap");
    expect(screen.getByTestId("timeline-track")).toHaveClass("relative");
    const dayLayer = screen.getByTestId("timeline-day-layer");
    expect(dayLayer).toHaveClass("pointer-events-none");
    expect(dayLayer).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("timeline-day-Fri-10")).toHaveStyle({ width: "50%" });
    expect(screen.getByTestId("timeline-day-Sat-11")).toHaveStyle({ width: "50%" });

    rerender(<SwellDayTimeline {...createProps({ index: 47 })} />);
    expect(screen.getByTestId("timeline-bubble")).toHaveStyle({
      left: "100%",
      transform: "translateX(-100%)",
    });
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
    const retryButton = screen.getByRole("button", { name: "Retry loading forecast hours" });
    expect(retryButton).toHaveClass(
      "h-11",
      "min-h-11",
      "focus-visible:ring-[var(--swell-timeline-focus)]",
    );
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<SwellDayTimeline {...createProps({ isLoadingMore: true, isExhausted: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading more forecast hours");

    rerender(<SwellDayTimeline {...createProps({ isExhausted: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "2-day forecast · ends Sat 11 — 1 PM HST",
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
    expect(timeline).toHaveClass("absolute", "pb-[max(0.75rem,env(safe-area-inset-bottom))]");
    expect(timeline).not.toHaveClass("fixed");
    const playButton = screen.getByRole("button", { name: "Play forecast timeline" });
    expect(playButton).toHaveClass("h-11", "w-11", "rounded-full");
    expect(playButton).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Forecast time" })).toBeDisabled();
  });

  it("passes pointer events through the map-owned shell outside the visible panel", () => {
    render(<SwellDayTimeline {...createProps()} />);

    expect(screen.getByTestId("swell-day-timeline")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("timeline-panel")).toHaveClass("pointer-events-auto");
  });

  it("sources repeated timeline brand values from shared theme tokens", () => {
    render(<SwellDayTimeline {...createProps()} />);

    expect(SWELL_MAP_TIMELINE).toEqual(expect.objectContaining({
      active: SWELL_LAYER_COLOR.s1,
      focus: SWELL_MAP_LEGEND_SURFACE.ink,
      ink: SWELL_MAP_LEGEND_SURFACE.ink,
      stickerShadow: SWELL_MAP_STICKER_SHADOW,
    }));

    const panel = screen.getByTestId("timeline-panel");
    expect(panel.style.getPropertyValue("--swell-timeline-ink"))
      .toBe(SWELL_MAP_LEGEND_SURFACE.ink);
    expect(panel.style.getPropertyValue("--swell-timeline-focus"))
      .toBe(SWELL_MAP_LEGEND_SURFACE.ink);
    expect(panel.style.getPropertyValue("--swell-timeline-active"))
      .toBe(SWELL_LAYER_COLOR.s1);
    expect(panel.style.getPropertyValue("--swell-timeline-sticker-shadow"))
      .toBe(SWELL_MAP_STICKER_SHADOW);

    expect(screen.getByRole("button", { name: "Play forecast timeline" })).toHaveClass(
      "border-[var(--swell-timeline-ink)]",
      "shadow-[var(--swell-timeline-sticker-shadow)]",
      "focus-visible:ring-[var(--swell-timeline-focus)]",
    );
    expect(screen.getByRole("slider", { name: "Forecast time" })).toHaveClass(
      "accent-[var(--swell-timeline-active)]",
      "focus-visible:ring-[var(--swell-timeline-focus)]",
    );
    expect(screen.getByTestId("timeline-visual-track")).toHaveClass(
      "peer-focus-visible:ring-2",
      "peer-focus-visible:ring-[var(--swell-timeline-focus)]",
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

    rerender(
      <SwellDayTimeline
        {...createProps({
          timestamps: [],
          daySegments: [],
          bubbleLabel: "",
          isExhausted: true,
        })}
      />,
    );
    expect(screen.getByTestId("swell-day-timeline")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No forecast hours available",
    );
  });
});
