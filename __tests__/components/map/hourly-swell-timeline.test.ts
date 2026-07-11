import type { HourlySwellTimeline, SwellPartition } from "@/app/api/forecasts/bulk/route";
import {
  formatTimelineBubble,
  mergeHourlyTimeline,
  segmentTimelineDays,
} from "@/components/map/hourly-swell-timeline";

const partition = (s1HeightFt: number): SwellPartition => ({
  s1Dir: 270,
  s1PeriodS: 12,
  s1HeightFt,
  s2Dir: null,
  s2PeriodS: null,
  s2HeightFt: null,
  windDir: null,
  windMph: null,
});

function timeline(overrides: Partial<HourlySwellTimeline>): HourlySwellTimeline {
  return {
    timestamps: [],
    partitionsByBeach: {},
    hasMore: false,
    nextStart: null,
    ...overrides,
  };
}

describe("hourly swell timeline utilities", () => {
  it("formats the bubble in the viewed location timezone", () => {
    expect(formatTimelineBubble("2026-07-10T23:00:00.000Z", "Pacific/Honolulu"))
      .toBe("Fri 10 — 1 PM HST");
  });

  it("segments DST fallback instants under one local day", () => {
    expect(segmentTimelineDays([
      "2026-11-01T08:00:00.000Z",
      "2026-11-01T09:00:00.000Z",
    ], "America/Los_Angeles")).toEqual([
      { key: "Sun-1", label: "Sun 1", startIndex: 0, endIndex: 1 },
    ]);
  });

  it("sorts real timestamps and realigns each beach without fabricating gaps", () => {
    const current = timeline({
      timestamps: ["2026-07-10T10:00:00.000Z", "2026-07-10T12:00:00.000Z"],
      partitionsByBeach: { a: [partition(2), null] },
      hasMore: true,
      nextStart: "2026-07-10T13:00:00.000Z",
    });
    const incoming = timeline({
      timestamps: [
        "2026-07-10T13:00:00.000Z",
        "2026-07-10T11:00:00.000Z",
        "2026-07-10T12:00:00.000Z",
      ],
      partitionsByBeach: {
        a: [null, partition(3), partition(4)],
        b: [partition(7), null, partition(8)],
      },
      hasMore: false,
      nextStart: null,
    });

    expect(mergeHourlyTimeline(current, incoming)).toEqual(timeline({
      timestamps: [
        "2026-07-10T10:00:00.000Z",
        "2026-07-10T11:00:00.000Z",
        "2026-07-10T12:00:00.000Z",
        "2026-07-10T13:00:00.000Z",
      ],
      partitionsByBeach: {
        a: [partition(2), partition(3), partition(4), null],
        b: [null, null, partition(8), partition(7)],
      },
      hasMore: false,
      nextStart: null,
    }));
  });

  it("lets incoming real frames replace null but never lets incoming null erase data", () => {
    const current = timeline({
      timestamps: ["2026-07-10T10:00:00.000Z", "2026-07-10T11:00:00.000Z"],
      partitionsByBeach: { a: [partition(2), null] },
      hasMore: true,
      nextStart: "2026-07-10T12:00:00.000Z",
    });
    const incoming = timeline({
      timestamps: ["2026-07-10T10:00:00.000Z", "2026-07-10T11:00:00.000Z"],
      partitionsByBeach: { a: [null, partition(5)] },
      hasMore: true,
      nextStart: "2026-07-10T13:00:00.000Z",
    });

    expect(mergeHourlyTimeline(current, incoming).partitionsByBeach.a)
      .toEqual([partition(2), partition(5)]);
  });

  it("retains real timestamps from an all-null incoming chunk", () => {
    const current = timeline({
      timestamps: ["2026-07-10T10:00:00.000Z"],
      partitionsByBeach: { a: [null] },
      hasMore: true,
      nextStart: "2026-07-10T11:00:00.000Z",
    });
    const incoming = timeline({
      timestamps: ["2026-07-10T11:00:00.000Z"],
      partitionsByBeach: {},
      hasMore: false,
      nextStart: null,
    });

    expect(mergeHourlyTimeline(current, incoming)).toEqual(timeline({
      timestamps: ["2026-07-10T10:00:00.000Z", "2026-07-10T11:00:00.000Z"],
      partitionsByBeach: { a: [null, null] },
      hasMore: false,
      nextStart: null,
    }));
  });
});
