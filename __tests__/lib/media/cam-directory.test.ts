import {
  dedupeCameraBeachesForDirectory,
  type CamDirectoryBeach,
} from "@/lib/media/cam-directory";

function makeBeach(
  overrides: Partial<CamDirectoryBeach> & Pick<CamDirectoryBeach, "slug">,
): CamDirectoryBeach {
  return {
    id: overrides.slug,
    name: overrides.slug,
    city: "Huntington Beach",
    state: "CA",
    camera_url: "https://www.youtube.com/watch?v=mhQjsLBfOoY",
    thumbnail_url: "https://img.youtube.com/vi/mhQjsLBfOoY/hqdefault.jpg",
    ...overrides,
  };
}

describe("dedupeCameraBeachesForDirectory", () => {
  it("keeps only the best matching beach for duplicated Huntington pier feeds", () => {
    const result = dedupeCameraBeachesForDirectory([
      makeBeach({
        slug: "goldenwest",
        name: "Goldenwest",
        lat: 33.6805,
        lon: -118.0113,
        cameraTitleHint: "View from Huntington Beach Pier",
      }),
      makeBeach({
        slug: "huntington-beach-pier",
        name: "Huntington Beach Pier",
        lat: 33.657168,
        lon: -118.002005,
        cameraTitleHint: "View from Huntington Beach Pier",
      }),
      makeBeach({
        slug: "huntington-beach-pier-northside",
        name: "Huntington Beach Pier Northside",
        lat: 33.6552,
        lon: -118.0022,
        cameraTitleHint: "View from Huntington Beach Pier",
      }),
      makeBeach({
        slug: "huntington-beach-pier-southside",
        name: "Huntington Beach Pier Southside",
        lat: 33.6542,
        lon: -118.0022,
        cameraTitleHint: "View from Huntington Beach Pier",
      }),
      makeBeach({
        slug: "huntington-state-beach",
        name: "Huntington State Beach",
        lat: 33.6418,
        lon: -117.9739,
        cameraTitleHint: "View from Huntington Beach Pier",
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("huntington-beach-pier");
  });

  it("uses provider URL text to choose the named location when no title hint exists", () => {
    const result = dedupeCameraBeachesForDirectory([
      makeBeach({
        slug: "ponto",
        name: "Ponto",
        city: "Carlsbad",
        lat: 33.0862,
        lon: -117.3074,
        camera_url:
          "https://hdontap.com/stream/177276/terramar-point-surf-live-webcam/",
        thumbnail_url:
          "https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_hosb3_hdontap_carlsbad_terra-mar-pt.stream.jpg",
      }),
      makeBeach({
        slug: "terramar-point",
        name: "Terramar Point",
        city: "Carlsbad",
        lat: 33.1411,
        lon: -117.343,
        camera_url:
          "https://hdontap.com/stream/177276/terramar-point-surf-live-webcam/",
        thumbnail_url:
          "https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_hosb3_hdontap_carlsbad_terra-mar-pt.stream.jpg",
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("terramar-point");
  });

  it("preserves beaches that use different camera URLs", () => {
    const result = dedupeCameraBeachesForDirectory([
      makeBeach({
        slug: "huntington-beach-pier",
        name: "Huntington Beach Pier",
        cameraTitleHint: "View from Huntington Beach Pier",
      }),
      makeBeach({
        slug: "imperial-beach",
        name: "Imperial Beach",
        city: "Imperial Beach",
        camera_url: "https://example.com/imperial-beach-cam",
        thumbnail_url: null,
      }),
    ]);

    expect(result.map((beach) => beach.slug).sort()).toEqual([
      "huntington-beach-pier",
      "imperial-beach",
    ]);
  });
});
