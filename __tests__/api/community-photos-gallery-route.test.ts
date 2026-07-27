/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const mockGetCanonicalSpotPhotos = jest.fn();

jest.mock("@/lib/community-photos", () => {
  const actual = jest.requireActual("@/lib/community-photos");
  return {
    ...actual,
    getCanonicalSpotPhotos: mockGetCanonicalSpotPhotos,
    getCommunityPhotoFeatureFlags: () => ({
      readEnabled: true,
      writeEnabled: false,
      termsVersion: "2026-07-25",
    }),
  };
});

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth:
    (handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: unknown) =>
      handler(request, {
        params: context ?? {},
        user: null,
        supabase: {},
      }),
}));

describe("GET /api/community-photos", () => {
  it("locks the canonical gallery envelope and private no-store contract", async () => {
    const photo = {
      id: "20000000-0000-4000-8000-000000000001",
      source: "curated",
      visibility: "public",
      imageUrl: "https://images.example/curated.webp",
      thumbUrl: null,
      width: null,
      height: null,
      title: "Curated",
      creatorName: "Photographer",
      attributionHtml: "Licensed source",
      attribution: null,
      community: null,
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    mockGetCanonicalSpotPhotos.mockResolvedValue([photo]);
    const { GET } = await import("@/app/api/community-photos/route");
    const response = await GET(
      new NextRequest(
        "https://example.com/api/community-photos?targetType=beach&targetId=10000000-0000-4000-8000-000000000001",
      ),
      { params: {} },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, no-cache, must-revalidate",
    );
    expect(await response.json()).toEqual({
      photos: [photo],
      feature: {
        readEnabled: true,
        writeEnabled: false,
        termsVersion: "2026-07-25",
      },
    });
  });

  it("rejects unbounded targets without calling the resolver", async () => {
    const { GET } = await import("@/app/api/community-photos/route");
    const response = await GET(
      new NextRequest(
        "https://example.com/api/community-photos?targetType=secret&targetId=not-a-uuid",
      ),
      { params: {} },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid request",
      code: "invalid_request",
      retryable: false,
    });
  });
});
