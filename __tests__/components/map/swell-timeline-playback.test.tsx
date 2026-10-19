import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import type { HourlySwellTimeline, SwellPartition } from "@/lib/domains/conditions/map-forecast";
import { formatTimelineBubble, PLAYBACK_TARGET_DURATION_MS } from "@/components/map/hourly-swell-timeline";
import { SwellDayTimeline } from "@/components/map/swell-field/swell-day-timeline";
import { useExpandableSwellTimeline } from "@/hooks/use-expandable-swell-timeline";

const HOUR_MS = 60 * 60 * 1000;
const TIMEZONE = "America/Los_Angeles";
// Tue 13 Oct 2026, 8 PM PDT through Thu 22, 11 PM PDT: the public map's 10-day track.
const FIRST_FRAME_MS = Date.parse("2026-10-14T03:00:00.000Z");
const FRAME_COUNT = 220;
// The first local day starts at 8 PM, so the track reserves 20 elapsed hours before frame 0.
const ELAPSED_TODAY_HOURS = 20;

const partition = (s1Dir: number): SwellPartition => ({
  s1Dir,
  s1PeriodS: 14,
  s1HeightFt: 3,
  s2Dir: null,
  s2PeriodS: null,
  s2HeightFt: null,
  windDir: null,
  windMph: null,
});

function tenDayTimeline(): HourlySwellTimeline {
  return {
    timestamps: Array.from({ length: FRAME_COUNT }, (_, index) =>
      new Date(FIRST_FRAME_MS + index * HOUR_MS).toISOString(),
    ),
    partitionsByBeach: {
      "la-jolla-shores": Array.from({ length: FRAME_COUNT }, (_, index) =>
        partition(index < 150 ? 285 : 195),
      ),
    },
    hasMore: false,
    nextStart: null,
  };
}

function PlaybackHarness({
  initial,
  onPlaybackPositionChange,
}: {
  initial: HourlySwellTimeline;
  onPlaybackPositionChange: (position: number) => void;
}): ReactElement | null {
  const timeline = useExpandableSwellTimeline({
    scopeKey: "la-jolla",
    initial,
    timezone: TIMEZONE,
    loadChunk: jest.fn(),
    reducedMotion: false,
  });

  return (
    <SwellDayTimeline
      timestamps={timeline.timestamps}
      index={timeline.index}
      timezone={timeline.timezone}
      bubbleLabel={timeline.bubbleLabel}
      daySegments={timeline.daySegments}
      isPlaying={timeline.isPlaying}
      isLoadingMore={timeline.isLoadingMore}
      isExhausted={timeline.isExhausted}
      error={timeline.error}
      onIndexChange={timeline.setIndex}
      onPlayingChange={timeline.setPlaying}
      onRetry={timeline.retry}
      onPlaybackPositionChange={onPlaybackPositionChange}
    />
  );
}

// Advance one display frame at a time so React renders between controller commits,
// as a browser does.
function playFor(durationMs: number): void {
  for (let elapsedMs = 0; elapsedMs < durationMs; elapsedMs += 16) {
    act(() => {
      jest.advanceTimersByTime(16);
    });
  }
}

function visibleThumbIndex(): number {
  const width = Number.parseFloat(screen.getByTestId("timeline-progress").style.width);
  return (width / 100) * (ELAPSED_TODAY_HOURS + FRAME_COUNT) - ELAPSED_TODAY_HOURS;
}

describe("map forecast timeline playback", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps the time label on the visible thumb and plays through the final hour", () => {
    const initial = tenDayTimeline();
    const onPlaybackPositionChange = jest.fn();
    render(
      <PlaybackHarness
        initial={initial}
        onPlaybackPositionChange={onPlaybackPositionChange}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Forecast time" });
    const bubble = screen.getByTestId("timeline-bubble");
    expect(bubble).toHaveTextContent("Tue 13 — 8 PM PDT");

    fireEvent.click(screen.getByRole("button", { name: "Play forecast timeline" }));

    for (let elapsedMs = 0; elapsedMs < PLAYBACK_TARGET_DURATION_MS; elapsedMs += 3_000) {
      playFor(3_000);
      const committedIndex = Number((slider as HTMLInputElement).value);
      expect(committedIndex).toBeGreaterThan(0);
      expect(Math.abs(visibleThumbIndex() - committedIndex)).toBeLessThanOrEqual(1 + 1e-9);
      expect(bubble).toHaveTextContent(
        formatTimelineBubble(initial.timestamps[committedIndex], TIMEZONE),
      );
    }

    playFor(1_000);

    expect(slider).toHaveValue(String(FRAME_COUNT - 1));
    expect(bubble).toHaveTextContent("Thu 22 — 11 PM PDT");
    expect(visibleThumbIndex()).toBeCloseTo(FRAME_COUNT - 1, 6);
    expect(onPlaybackPositionChange).toHaveBeenLastCalledWith(FRAME_COUNT - 1);
    expect(screen.getByRole("button", { name: "Play forecast timeline" })).toBeInTheDocument();
  });
});
