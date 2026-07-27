/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

const ADMIN_ID = "10000000-0000-4000-8000-000000000001";
const PHOTO_ID = "20000000-0000-4000-8000-000000000001";
const AUDIT_ID = "30000000-0000-4000-8000-000000000001";
const mockDownloadAdminCommunityPhoto = jest.fn();

jest.mock("@/lib/community-photos", () => {
  const actual = jest.requireActual("@/lib/community-photos");
  return {
    ...actual,
    downloadAdminCommunityPhoto: mockDownloadAdminCommunityPhoto,
  };
});

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAdminAuth:
    (handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: { params?: Record<string, string> }) =>
      handler(request, {
        params: context?.params ?? {},
        user: { id: ADMIN_ID },
        supabase: {},
      }),
}));

describe("admin hidden community photo image", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires an audit id and serves hidden bytes through the audited boundary", async () => {
    mockDownloadAdminCommunityPhoto.mockResolvedValue({
      bytes: Buffer.from("hidden-webp"),
      contentType: "image/webp",
    });
    const { GET } = await import(
      "@/app/api/admin/community-photos/[photoId]/image/route"
    );
    const response = await GET(
      new NextRequest(
        `https://example.com/api/admin/community-photos/${PHOTO_ID}/image?auditId=${AUDIT_ID}`,
      ),
      { params: { photoId: PHOTO_ID } },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mockDownloadAdminCommunityPhoto).toHaveBeenCalledWith({
      photoId: PHOTO_ID,
      actorId: ADMIN_ID,
      auditId: AUDIT_ID,
    });
  });

  it("rejects a missing audit id before touching storage", async () => {
    const { GET } = await import(
      "@/app/api/admin/community-photos/[photoId]/image/route"
    );
    const response = await GET(
      new NextRequest(
        `https://example.com/api/admin/community-photos/${PHOTO_ID}/image`,
      ),
      { params: { photoId: PHOTO_ID } },
    );

    expect(response.status).toBe(400);
    expect(mockDownloadAdminCommunityPhoto).not.toHaveBeenCalled();
  });
});
