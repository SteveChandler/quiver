import {
  MAX_TIMELINE_FIELD_BEACHES,
  selectTimelineFieldBeachIds,
} from "@/components/map/timeline-beach-sampler";
import type { Beach } from "@/types/database";

function beach(id: string, lat: number | null, lon: number | null): Beach {
  return { id, name: id, lat, lon } as unknown as Beach;
}

describe("selectTimelineFieldBeachIds", () => {
  it("keeps the field query bounded and spreads samples across the viewed coast", () => {
    const beaches = Array.from({ length: 20 }, (_, index) =>
      beach(`beach-${index}`, 32.7 + index * 0.02, -117.2),
    );

    const selected = selectTimelineFieldBeachIds(
      beaches,
      { lat: 32.7, lon: -117.2 },
    );

    expect(selected).toHaveLength(MAX_TIMELINE_FIELD_BEACHES);
    expect(selected[0]).toBe("beach-0");
    expect(selected).toContain("beach-19");
    expect(new Set(selected).size).toBe(selected.length);
  });

  it("preserves all unique beaches when the input is already below the cap", () => {
    expect(selectTimelineFieldBeachIds(
      [beach("a", 32.7, -117.2), beach("a", 32.7, -117.2), beach("b", null, null)],
      { lat: 32.7, lon: -117.2 },
    )).toEqual(["a", "b"]);
  });

  it("fills from beaches without coordinates only after spatial candidates", () => {
    const selected = selectTimelineFieldBeachIds(
      [
        beach("near", 32.7, -117.2),
        beach("far", 33.1, -117.2),
        beach("missing", null, null),
      ],
      { lat: 32.7, lon: -117.2 },
      3,
    );

    expect(selected).toEqual(["near", "far", "missing"]);
  });

  it("always retains the beach the user is inspecting", () => {
    const beaches = Array.from({ length: 20 }, (_, index) =>
      beach(`beach-${index}`, 32.7 + index * 0.02, -117.2),
    );

    const selected = selectTimelineFieldBeachIds(
      beaches,
      { lat: 32.7, lon: -117.2 },
      MAX_TIMELINE_FIELD_BEACHES,
      "beach-10",
    );

    expect(selected).toHaveLength(MAX_TIMELINE_FIELD_BEACHES);
    expect(selected[0]).toBe("beach-10");
  });
});
