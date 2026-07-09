import {
  HOURLY_EMBED_TIMELINE_STEPS,
  formatEmbedMapTimelineLabel,
} from "@/components/map/embed-map-timeline";

describe("embed map hourly timeline", () => {
  const now = new Date(2026, 6, 9, 15, 30);

  it("exposes every hour from now through +42h", () => {
    expect(HOURLY_EMBED_TIMELINE_STEPS).toHaveLength(43);
    expect(HOURLY_EMBED_TIMELINE_STEPS[0]).toBe(0);
    expect(HOURLY_EMBED_TIMELINE_STEPS[42]).toBe(42);
  });

  it("formats same-day and next-day labels for the standalone embed", () => {
    expect(formatEmbedMapTimelineLabel(0, now)).toBe("Now");
    expect(formatEmbedMapTimelineLabel(2, now)).toBe("5 PM");
    expect(formatEmbedMapTimelineLabel(10, now)).toBe("Fri 1 AM");
  });
});
