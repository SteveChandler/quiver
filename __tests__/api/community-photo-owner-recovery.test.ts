/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const PHOTO_ID = "20000000-0000-4000-8000-000000000001";
const TARGET_ID = "30000000-0000-4000-8000-000000000001";
const IDEMPOTENCY_KEY = "40000000-0000-4000-8000-000000000001";

const mockListOwnedRemovedCommunityPhotos = jest.fn();
const mockRecoverOwnedCommunityPhoto = jest.fn();

jest.mock("@/lib/community-photos", () => {
  const actual = jest.requireActual("@/lib/community-photos");
  return {
    ...actual,
    listOwnedRemovedCommunityPhotos: mockListOwnedRemovedCommunityPhotos,
    recoverOwnedCommunityPhoto: mockRecoverOwnedCommunityPhoto,
  };
});

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth:
    (handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: { params?: Record<string, string> }) =>
      handler(request, {
        params: context?.params ?? {},
        user: { id: USER_ID },
        supabase: {},
      }),
  withRateLimit: (handler: (...args: unknown[]) => unknown) => handler,
}));

describe("community photo owner recovery API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COMMUNITY_PHOTOS_READ_ENABLED = "true";
    process.env.COMMUNITY_PHOTOS_WRITE_ENABLED = "true";
  });

  it("lists only the authenticated owner's recoverable rows", async () => {
    const photo = {
      id: PHOTO_ID,
      targetType: "beach",
      targetId: TARGET_ID,
      imageUrl: `/api/community-photos/${PHOTO_ID}/image`,
      thumbUrl: `/api/community-photos/${PHOTO_ID}/image`,
      recoverableUntil: "2026-08-25T12:00:00.000Z",
      moderationStatus: "hidden",
      hasActiveHold: true,
    };
    mockListOwnedRemovedCommunityPhotos.mockResolvedValue([photo]);
    const { GET } = await import("@/app/api/community-photos/mine/route");
    const response = await GET(
      new NextRequest(
        "https://example.com/api/community-photos/mine?status=removed",
      ),
      { params: {} },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ photos: [photo] });
    expect(mockListOwnedRemovedCommunityPhotos).toHaveBeenCalledWith({
      uploaderId: USER_ID,
    });
  });

  it("recovers an owned visible row through the owner-only RPC", async () => {
    mockRecoverOwnedCommunityPhoto.mockResolvedValue({
      photoId: PHOTO_ID,
      status: "active",
    });
    const { POST } = await import(
      "@/app/api/community-photos/[photoId]/recover/route"
    );
    const response = await POST(
      new NextRequest(
        `https://example.com/api/community-photos/${PHOTO_ID}/recover`,
        {
          method: "POST",
          body: JSON.stringify({ idempotencyKey: IDEMPOTENCY_KEY }),
        },
      ),
      { params: { photoId: PHOTO_ID } },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      photoId: PHOTO_ID,
      status: "active",
    });
    expect(mockRecoverOwnedCommunityPhoto).toHaveBeenCalledWith({
      photoId: PHOTO_ID,
      uploaderId: USER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
  });
});
