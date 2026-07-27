/**
 * @jest-environment node
 */

import { createThenableQuery } from "@/__tests__/setup/admin-action-test-utils";

const getResolvedSpotPhotoMap = jest.fn();

jest.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

jest.mock("@/lib/community-photos", () => ({
  getResolvedSpotPhotoMap: (...args: unknown[]) =>
    getResolvedSpotPhotoMap(...args),
  communityPhotoTargetKey: (target: { type: string; id: string }) =>
    `${target.type}:${target.id}`,
}));

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(),
}));

describe("camera directory community photo parity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("uses one batch resolver call and prefers its eligible featured photo", async () => {
    const { createPublicReadClient } = await import("@/lib/supabase/server");
    const sourcesQuery = createThenableQuery({
      data: [
        {
          camera_url: "https://cam.example.com/live",
          thumbnail_url: null,
          youtube_stream_title_hint: null,
          beaches: {
            id: "beach-1",
            name: "Test Beach",
            slug: "test-beach",
            city: "San Diego",
            state: "CA",
            lat: 32.75,
            lon: -117.25,
          },
        },
      ],
      error: null,
    });
    (sourcesQuery as any).neq = jest.fn(() => sourcesQuery);
    const curatedQuery = createThenableQuery({
      data: [
        {
          beach_id: "beach-1",
          image_url: "https://cdn.example.com/curated.jpg",
          thumb_url: null,
        },
      ],
      error: null,
    });
    (curatedQuery as any).in = jest.fn(() => curatedQuery);
    (createPublicReadClient as jest.Mock).mockReturnValue({
      from: jest.fn((table: string) =>
        table === "beach_sources" ? sourcesQuery : curatedQuery,
      ),
    });
    getResolvedSpotPhotoMap.mockResolvedValue(
      new Map([
        [
          "beach:beach-1",
          [
            {
              id: "community-1",
              imageUrl: "/api/community-photos/community-1/image",
              thumbUrl: null,
            },
          ],
        ],
      ]),
    );

    const { getBeachesWithCameras } = await import(
      "@/actions/beach/cam-actions"
    );
    const result = await getBeachesWithCameras();

    expect(getResolvedSpotPhotoMap).toHaveBeenCalledWith({
      targets: [{ type: "beach", id: "beach-1" }],
      limitPerTarget: 1,
    });
    expect(result[0]?.photo_url).toBe(
      "/api/community-photos/community-1/image",
    );
  });
});
