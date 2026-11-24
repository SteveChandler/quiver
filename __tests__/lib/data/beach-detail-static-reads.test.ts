/**
 * @jest-environment node
 */
jest.mock("server-only", () => ({}));

const cacheCalls: Array<{ keyParts: string[]; options: { revalidate: number; tags: string[] } }> = [];
jest.mock("next/cache", () => ({
  unstable_cache: jest.fn(
    (fn: (...args: unknown[]) => unknown, keyParts: string[], options: { revalidate: number; tags: string[] }) => {
      cacheCalls.push({ keyParts, options });
      return fn;
    },
  ),
}));

const maybeSingle = jest.fn();
type QueryChain = Record<"from" | "select" | "eq" | "not" | "neq" | "limit" | "maybeSingle", jest.Mock>;
const queryChain: QueryChain = {
  from: jest.fn((): QueryChain => queryChain),
  select: jest.fn((): QueryChain => queryChain),
  eq: jest.fn((): QueryChain => queryChain),
  not: jest.fn((): QueryChain => queryChain),
  neq: jest.fn((): QueryChain => queryChain),
  limit: jest.fn((): QueryChain => queryChain),
  maybeSingle,
};
jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => queryChain),
  createSupabaseServiceRoleClient: jest.fn(() => queryChain),
}));

const getResolvedSpotPhotoMap = jest.fn();
jest.mock("@/lib/community-photos", () => ({
  getResolvedSpotPhotoMap: (...args: unknown[]) => getResolvedSpotPhotoMap(...args),
}));

import {
  BEACH_DETAIL_STATIC_TAG,
  getCachedBeachAmenities,
  getCachedBeachCameraUrl,
  getCachedBeachFeaturedPhoto,
} from "@/lib/data/server/beach-detail-static-reads";

describe("beach detail static reads", () => {
  beforeEach(() => {
    cacheCalls.length = 0;
    jest.clearAllMocks();
  });

  it("caches the camera URL for an hour under per-beach tags", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { camera_url: "https://cam.example/1" }, error: null });

    await expect(getCachedBeachCameraUrl("beach-1")).resolves.toBe("https://cam.example/1");
    expect(cacheCalls[0]).toEqual({
      keyParts: [BEACH_DETAIL_STATIC_TAG, "camera-url-v2"],
      options: { revalidate: 3600, tags: [BEACH_DETAIL_STATIC_TAG, `${BEACH_DETAIL_STATIC_TAG}:beach-1`] },
    });
    expect(queryChain.from).toHaveBeenCalledWith("beach_sources");
  });

  it("throws on a query error so the failure is not cached", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    await expect(getCachedBeachAmenities("beach-2")).rejects.toEqual({ message: "boom" });
    expect(queryChain.from).toHaveBeenCalledWith("mv_beach_amenities");
    expect(cacheCalls[0].options.revalidate).toBe(3600);
  });

  it("keeps the featured photo no staler than the 15-minute CDN window", async () => {
    const photo = { id: "p1", imageUrl: "https://img.example/1.jpg" };
    getResolvedSpotPhotoMap.mockResolvedValueOnce(new Map([["beach:beach-3", [photo]]]));

    await expect(getCachedBeachFeaturedPhoto("beach-3")).resolves.toBe(photo);
    expect(getResolvedSpotPhotoMap).toHaveBeenCalledWith({
      targets: [{ type: "beach", id: "beach-3" }],
      limitPerTarget: 1,
    });
    expect(cacheCalls[0].options.revalidate).toBe(900);
  });

  it("returns null when the beach has no photo", async () => {
    getResolvedSpotPhotoMap.mockResolvedValueOnce(new Map([["beach:beach-4", []]]));

    await expect(getCachedBeachFeaturedPhoto("beach-4")).resolves.toBeNull();
  });
});
