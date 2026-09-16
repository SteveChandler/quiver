import {
  HOURLY_EMBED_TIMELINE_STEPS,
  embedTimelineStart,
  embedTimelineArrayPositionForHourOffset,
  forecastAtForEmbedTimelineIndex,
  formatEmbedMapTimelineLabel,
  hourlyEmbedTimelineLabels,
  hourlyEmbedTimelineTimestamps,
} from "@/components/map/embed-map-timeline";

describe("embed map hourly timeline", () => {
  const now = new Date(2026, 6, 9, 15, 30);

  it("exposes every hour across the full 14-day API range", () => {
    expect(HOURLY_EMBED_TIMELINE_STEPS).toHaveLength(14 * 24);
    expect(HOURLY_EMBED_TIMELINE_STEPS[0]).toBe(0);
    expect(HOURLY_EMBED_TIMELINE_STEPS.at(-1)).toBe(14 * 24 - 1);
  });

  it("formats same-day and next-day labels for the standalone embed", () => {
    expect(formatEmbedMapTimelineLabel(0, now)).toBe("Now");
    expect(formatEmbedMapTimelineLabel(2, now)).toBe("5 PM");
    expect(formatEmbedMapTimelineLabel(10, now)).toBe("Fri 1 AM");
  });

  it("formats absolute hourly labels in an explicit IANA timezone across DST", () => {
    const timestamps = [
      "2026-11-01T05:00:00.000Z",
      "2026-11-01T06:00:00.000Z",
      "2026-11-01T07:00:00.000Z",
    ];

    expect(hourlyEmbedTimelineLabels(now, timestamps, "America/New_York").slice(0, 3)).toEqual([
      "Sun 1 AM",
      "Sun 1 AM",
      "Sun 2 AM",
    ]);
  });

  it("keeps sparse or malformed absolute timestamps index-aligned without throwing", () => {
    const timestamps: string[] = [];
    timestamps[0] = "2026-07-10T20:00:00.000Z";
    timestamps[2] = "2026-07-10T22:00:00.000Z";
    timestamps[3] = "not-a-timestamp";

    const labels = hourlyEmbedTimelineLabels(now, timestamps, "Invalid/Timezone");

    expect(labels).toHaveLength(14 * 24);
    expect(labels[0]).toBe("Fri 8 PM");
    expect(labels[1]).toBe("Fri 9 PM");
    expect(labels[2]).toBe("Fri 10 PM");
    expect(labels[3]).toBe("6 PM");
  });

  it("drops absolute timestamps when their partition arrays are length-mismatched", () => {
    expect(hourlyEmbedTimelineTimestamps({
      timestamps: ["2026-07-10T20:00:00.000Z", "2026-07-10T21:00:00.000Z"],
      partitionsByBeach: { "beach-1": [null] },
    })).toEqual([]);
  });

  it("does not emit non-hourly timestamp values as native forecast instants", () => {
    expect(
      forecastAtForEmbedTimelineIndex(["2026-07-10T20:30:00.000Z"], 0),
    ).toBeUndefined();
  });

  it("resolves hour offsets from 3-hourly timestamps instead of array indexes", () => {
    const timestamps = [
      "2026-07-10T00:00:00.000Z",
      "2026-07-10T03:00:00.000Z",
      "2026-07-10T06:00:00.000Z",
    ];

    expect(forecastAtForEmbedTimelineIndex(timestamps, 3)).toBe(
      "2026-07-10T03:00:00.000Z",
    );
    expect(embedTimelineArrayPositionForHourOffset(timestamps, 1)).toBeCloseTo(1 / 3);
    expect(embedTimelineArrayPositionForHourOffset(timestamps, 3)).toBe(1);
  });

  it("resolves hourly timestamps without applying a cadence divisor", () => {
    const timestamps = [
      "2026-07-10T00:00:00.000Z",
      "2026-07-10T01:00:00.000Z",
      "2026-07-10T02:00:00.000Z",
    ];

    expect(forecastAtForEmbedTimelineIndex(timestamps, 2)).toBe(
      "2026-07-10T02:00:00.000Z",
    );
    expect(embedTimelineArrayPositionForHourOffset(timestamps, 2)).toBe(2);
  });
});

it('validates a detail forecast start without dropping earlier hours', () => {
  expect(embedTimelineStart('2026-09-10T11:00:00-10:00')).toBe('2026-09-10T21:00:00.000Z');
  for (const value of [null, 'bad', '2026-09-10T11:00:00', '2026-09-10T11:30:00Z']) {
    expect(embedTimelineStart(value)).toBeUndefined();
  }
});
