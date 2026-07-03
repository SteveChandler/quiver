import { buildAmenityPopupContent } from "@/components/map/amenities-layer";

describe("buildAmenityPopupContent", () => {
  it("renders a zine-style amenity popup without provenance metadata", () => {
    const popup = buildAmenityPopupContent({
      id: "amenity-1",
      type: "restrooms",
      lat: 32.75,
      lon: -117.25,
      source: "seed",
      source_ref: null,
      confidence: 45,
      label: "Ocean Beach public restrooms area",
      imported_at: "2026-07-03T00:00:00.000Z",
    });

    expect(popup).toHaveAttribute("data-testid", "amenity-popup");
    expect(popup).toHaveTextContent("Map note");
    expect(popup).toHaveTextContent("Ocean Beach public restrooms area");
    expect(popup).toHaveTextContent("restrooms");
    expect(popup).not.toHaveTextContent("SEED");
    expect(popup).not.toHaveTextContent("45% confidence");
    expect(popup).not.toHaveTextContent("2026-07-03");
  });
});
