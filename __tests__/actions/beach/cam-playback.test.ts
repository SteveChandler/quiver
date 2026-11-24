/**
 * @jest-environment node
 */

import { createThenableQuery } from "@/__tests__/setup/admin-action-test-utils";

jest.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

jest.mock("@/lib/community-photos", () => ({
  getResolvedSpotPhotoMap: jest.fn(async () => new Map()),
  communityPhotoTargetKey: (target: { type: string; id: string }) =>
    `${target.type}:${target.id}`,
}));

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(),
}));

jest.mock("@/lib/media/cam-embed-preflight", () => ({
  resolveCamPlayback: jest.fn(async (url: string) =>
    url.includes("cbccstaff.net")
      ? { kind: "none" }
      : url.includes("sigward.com")
        ? { kind: "external", provider: "Muir Beach Webcam", pageUrl: url }
        : { kind: "inline" },
  ),
}));

function sourceRow(id: string, name: string, state: string, cameraUrl: string) {
  return {
    camera_url: cameraUrl,
    thumbnail_url: null,
    youtube_stream_title_hint: null,
    beaches: { id, name, slug: id, city: name, state, lat: null, lon: null },
  };
}

describe("camera directory playback state", () => {
  it("keeps each playback state on its own beach after the directory sort", async () => {
    const { createPublicReadClient } = await import("@/lib/supabase/server");
    // OR sorts after CA, so the sort moves these rows.
    const sourcesQuery = createThenableQuery({
      data: [
        sourceRow("cannon", "Cannon Beach", "OR", "https://cbccstaff.net/whats-new/webcam/"),
        sourceRow("scripps", "La Jolla", "CA", "https://hls.cdn-surfline.com/socal/scripps/playlist.m3u8"),
        sourceRow("f73cea3d-d7c7-57cf-b2d1-9a4370f75123", "Muir Beach", "CA", "https://www.sigward.com/"),
        sourceRow("34e148b8-08cc-50cb-908f-012464b7fa74", "Virginia Beach Oceanfront", "VA", "https://vbbound.com/webcams/courtyard-virginia-beach-boardwalk-webcam/"),
      ],
      error: null,
    });
    (sourcesQuery as any).neq = jest.fn(() => sourcesQuery);
    const photosQuery = createThenableQuery({ data: [], error: null });
    (photosQuery as any).in = jest.fn(() => photosQuery);
    (createPublicReadClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) =>
        table === "beach_sources" ? sourcesQuery : photosQuery,
      ),
    });

    const { getBeachesWithCameras } = await import("@/actions/beach/cam-actions");
    const result = await getBeachesWithCameras();

    expect(result.map((beach) => [beach.id, beach.playback.kind])).toEqual([
      ["scripps", "inline"],
      ["f73cea3d-d7c7-57cf-b2d1-9a4370f75123", "external"],
      ["cannon", "none"],
      ["34e148b8-08cc-50cb-908f-012464b7fa74", "inline"],
    ]);
    expect(result[1]?.photo_url).toBe("/images/cams/muir-beach.jpg");
    expect(result[3]?.photo_url).toBe("/images/cams/virginia-beach-oceanfront.jpg");
  });
});
