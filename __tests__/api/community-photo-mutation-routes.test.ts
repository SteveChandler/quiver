/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const PHOTO_ID = "20000000-0000-4000-8000-000000000001";
const IDEMPOTENCY_KEY = "30000000-0000-4000-8000-000000000001";

const mockDownloadCommunityPhoto = jest.fn();
const mockVoteCommunityPhoto = jest.fn();
const mockReportCommunityPhoto = jest.fn();

jest.mock("@/lib/community-photos", () => {
  const actual = jest.requireActual("@/lib/community-photos");
  return {
    ...actual,
    downloadCommunityPhoto: mockDownloadCommunityPhoto,
    voteCommunityPhoto: mockVoteCommunityPhoto,
    reportCommunityPhoto: mockReportCommunityPhoto,
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

describe("community photo viewer and mutation runtime gates", () => {
  const originalRead = process.env.COMMUNITY_PHOTOS_READ_ENABLED;
  const originalWrite = process.env.COMMUNITY_PHOTOS_WRITE_ENABLED;
  const originalCanary = process.env.COMMUNITY_PHOTOS_CANARY_USER_IDS;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.COMMUNITY_PHOTOS_READ_ENABLED;
    delete process.env.COMMUNITY_PHOTOS_WRITE_ENABLED;
    delete process.env.COMMUNITY_PHOTOS_CANARY_USER_IDS;
  });

  afterAll(() => {
    process.env.COMMUNITY_PHOTOS_READ_ENABLED = originalRead;
    process.env.COMMUNITY_PHOTOS_WRITE_ENABLED = originalWrite;
    process.env.COMMUNITY_PHOTOS_CANARY_USER_IDS = originalCanary;
  });

  it("fails closed before downloading an image when this viewer cannot read", async () => {
    const { GET } = await import(
      "@/app/api/community-photos/[photoId]/image/route"
    );
    const response = await GET(
      new NextRequest(`https://example.com/api/community-photos/${PHOTO_ID}/image`),
      { params: { photoId: PHOTO_ID } },
    );

    expect(response.status).toBe(403);
    expect(mockDownloadCommunityPhoto).not.toHaveBeenCalled();
  });

  it("allows an exact canary viewer through the image gate", async () => {
    process.env.COMMUNITY_PHOTOS_CANARY_USER_IDS = USER_ID;
    mockDownloadCommunityPhoto.mockResolvedValue({
      bytes: Buffer.from("webp"),
      contentType: "image/webp",
    });
    const { GET } = await import(
      "@/app/api/community-photos/[photoId]/image/route"
    );
    const response = await GET(
      new NextRequest(`https://example.com/api/community-photos/${PHOTO_ID}/image`),
      { params: { photoId: PHOTO_ID } },
    );

    expect(response.status).toBe(200);
    expect(mockDownloadCommunityPhoto).toHaveBeenCalledWith({
      photoId: PHOTO_ID,
      viewerId: USER_ID,
    });
  });

  it.each([
    {
      method: "vote",
      load: async () =>
        (await import("@/app/api/community-photos/[photoId]/vote/route")).PUT,
      request: () =>
        new NextRequest(
          `https://example.com/api/community-photos/${PHOTO_ID}/vote`,
          {
            method: "PUT",
            body: JSON.stringify({ vote: "up", idempotencyKey: IDEMPOTENCY_KEY }),
          },
        ),
      mutation: mockVoteCommunityPhoto,
    },
    {
      method: "report",
      load: async () =>
        (await import("@/app/api/community-photos/[photoId]/report/route")).POST,
      request: () =>
        new NextRequest(
          `https://example.com/api/community-photos/${PHOTO_ID}/report`,
          {
            method: "POST",
            body: JSON.stringify({
              reason: "wrong_spot",
              idempotencyKey: IDEMPOTENCY_KEY,
            }),
          },
        ),
      mutation: mockReportCommunityPhoto,
    },
  ])("blocks $method before its write RPC when runtime writes are off", async ({
    load,
    request,
    mutation,
  }) => {
    process.env.COMMUNITY_PHOTOS_READ_ENABLED = "true";
    const handler = await load();
    const response = await handler(request(), { params: { photoId: PHOTO_ID } });

    expect(response.status).toBe(403);
    expect(mutation).not.toHaveBeenCalled();
  });
});
