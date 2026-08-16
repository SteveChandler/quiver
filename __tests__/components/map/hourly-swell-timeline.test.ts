import type { HourlySwellTimeline, SwellPartition } from "@/app/api/forecasts/bulk/route";
import {
  calendarDayTimelineHours,
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

  it("reuses one formatter for repeated work in the same timezone", () => {
    const formatterSpy = jest.spyOn(Intl, "DateTimeFormat");
    try {
      formatTimelineBubble("2026-07-10T23:00:00.000Z", "Pacific/Pago_Pago");
      formatTimelineBubble("2026-07-11T00:00:00.000Z", "Pacific/Pago_Pago");
      segmentTimelineDays([
        "2026-07-10T23:00:00.000Z",
        "2026-07-11T00:00:00.000Z",
      ], "Pacific/Pago_Pago");

      expect(formatterSpy).toHaveBeenCalledTimes(1);
    } finally {
      formatterSpy.mockRestore();
    }
  });

  it("segments DST fallback instants under one local day", () => {
    expect(segmentTimelineDays([
      "2026-11-01T08:00:00.000Z",
      "2026-11-01T09:00:00.000Z",
    ], "America/Los_Angeles")).toEqual([
      { key: "2026-11-01", label: "Sun 1", startIndex: 0, endIndex: 1 },
    ]);
  });

  it("uses unique local calendar-date keys across month and year boundaries", () => {
    const segments = segmentTimelineDays([
      "2026-12-31T20:00:00.000Z",
      "2027-01-01T20:00:00.000Z",
    ], "Pacific/Honolulu");

    expect(segments.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: "2026-12-31", label: "Thu 31" },
      { key: "2027-01-01", label: "Fri 1" },
    ]);
  });

  it("covers exactly ten complete local calendar dates", () => {
    const start = "2026-08-08T12:00:00.000Z";
    const hours = calendarDayTimelineHours(start, "America/Los_Angeles", 10);
    const timestamps = Array.from({ length: hours }, (_, offsetHours) =>
      new Date(Date.parse(start) + offsetHours * 60 * 60 * 1000).toISOString());
    const firstExcludedTimestamp = new Date(
      Date.parse(start) + hours * 60 * 60 * 1000,
    ).toISOString();

    expect(hours).toBe(235);
    expect(segmentTimelineDays(timestamps, "America/Los_Angeles")).toHaveLength(10);
    expect(segmentTimelineDays(
      [...timestamps, firstExcludedTimestamp],
      "America/Los_Angeles",
    )).toHaveLength(11);
  });

  it("preserves ten calendar dates across daylight-saving transitions", () => {
    const start = "2026-10-31T12:00:00.000Z";
    const hours = calendarDayTimelineHours(start, "America/Los_Angeles", 10);
    const timestamps = Array.from({ length: hours }, (_, offsetHours) =>
      new Date(Date.parse(start) + offsetHours * 60 * 60 * 1000).toISOString());

    expect(segmentTimelineDays(timestamps, "America/Los_Angeles")).toHaveLength(10);
    expect(timestamps.at(-1)).toBe("2026-11-10T07:00:00.000Z");
  });

  it("returns no horizon for an invalid start or non-positive day count", () => {
    expect(calendarDayTimelineHours(undefined, "UTC", 10)).toBe(0);
    expect(calendarDayTimelineHours("2026-08-08T12:00:00.000Z", "UTC", 0)).toBe(0);
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

  it("keeps the furthest pagination state when chunks arrive in reverse order", () => {
    const initial = timeline({
      timestamps: ["2026-07-10T10:00:00.000Z"],
      partitionsByBeach: { a: [partition(1)] },
      hasMore: true,
      nextStart: "2026-07-10T11:00:00.000Z",
    });
    const later = timeline({
      timestamps: ["2026-07-10T12:00:00.000Z"],
      partitionsByBeach: { a: [partition(3)] },
      hasMore: false,
      nextStart: null,
    });
    const earlier = timeline({
      timestamps: ["2026-07-10T11:00:00.000Z"],
      partitionsByBeach: { a: [partition(2)] },
      hasMore: true,
      nextStart: "2026-07-10T12:00:00.000Z",
    });

    const merged = mergeHourlyTimeline(
      mergeHourlyTimeline(initial, later),
      earlier,
    );

    expect(merged.timestamps).toEqual([
      "2026-07-10T10:00:00.000Z",
      "2026-07-10T11:00:00.000Z",
      "2026-07-10T12:00:00.000Z",
    ]);
    expect(merged.partitionsByBeach.a).toEqual([
      partition(1),
      partition(2),
      partition(3),
    ]);
    expect(merged.hasMore).toBe(false);
    expect(merged.nextStart).toBeNull();
  });

  it("keeps the furthest non-exhausted cursor when an earlier chunk arrives last", () => {
    const later = timeline({
      timestamps: ["2026-07-10T12:00:00.000Z"],
      partitionsByBeach: { a: [partition(3)] },
      hasMore: true,
      nextStart: "2026-07-10T13:00:00.000Z",
    });
    const earlier = timeline({
      timestamps: ["2026-07-10T11:00:00.000Z"],
      partitionsByBeach: { a: [partition(2)] },
      hasMore: true,
      nextStart: "2026-07-10T12:00:00.000Z",
    });

    const merged = mergeHourlyTimeline(later, earlier);

    expect(merged.hasMore).toBe(true);
    expect(merged.nextStart).toBe("2026-07-10T13:00:00.000Z");
  });
});
