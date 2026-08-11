import { NextResponse, type NextRequest } from "next/server";

jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

const mockFrom = jest.fn();
const mockStorage = jest.fn();
const mockRequireOwnership = jest.fn();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth: (handler: any) => async (request: any, context: any) => {
    if (request.testRole === "none") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    return handler(request, { ...context, user: { id: request.testUserId ?? "user-1" }, supabase: { from: mockFrom, storage: { from: mockStorage } } });
  },
  withAdminAuth: (handler: any) => async (request: any) => {
    if (request.testRole !== "admin") return NextResponse.json({ error: request.testRole === "none" ? "Authentication required" : "Admin access required" }, { status: request.testRole === "none" ? 401 : 403 });
    return handler(request, { user: { id: "admin-1" }, supabase: { from: mockFrom, storage: { from: mockStorage } } });
  },
  requireOwnership: mockRequireOwnership,
}));

function request(body: unknown, role = "user"): NextRequest & { testRole: string } {
  return { testRole: role, json: async () => body } as unknown as NextRequest & { testRole: string };
}

function chain(result: unknown): Record<string, jest.Mock> {
  const value = jest.fn().mockReturnValue(undefined);
  const self: Record<string, jest.Mock> = { select: value, eq: value, is: value, order: value, update: value, insert: value, single: jest.fn(), maybeSingle: jest.fn() };
  Object.values(self).forEach((fn) => fn.mockReturnValue(self));
  self.single.mockResolvedValue(result);
  self.maybeSingle.mockResolvedValue(result);
  return self;
}

describe("session video routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOwnership.mockResolvedValue({ data: { id: "session-1" } });
  });

  it.each([
    ["too_long", { storagePath: "session-1/user-1/a.mp4", durationSec: 61, sizeBytes: 1 }],
    ["too_large", { storagePath: "session-1/user-1/a.mp4", durationSec: 1, sizeBytes: 62914561 }],
    ["bad_type", { storagePath: "session-1/user-1/a.txt", durationSec: 1, sizeBytes: 1 }],
    ["bad_path", { storagePath: "other/user-1/a.mp4", durationSec: 1, sizeBytes: 1 }],
  ])("rejects %s", async (code, body) => {
    const { POST } = await import("@/app/api/sessions/[id]/videos/route");
    const response = await POST(request(body), { params: { id: "session-1" } });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: code });
  });

  it("finalizes a video as pending", async () => {
    const insert = chain({ data: { id: "media-1" }, error: null });
    mockFrom.mockReturnValue(insert);
    const { POST } = await import("@/app/api/sessions/[id]/videos/route");
    const response = await POST(request({ storagePath: "session-1/user-1/a.mp4", durationSec: 12, sizeBytes: 10 }), { params: { id: "session-1" } });
    expect(response.status).toBe(201);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ moderation_status: "pending" }));
  });

  it("returns 403 for a non-owner and 405 for unsupported methods", async () => {
    mockRequireOwnership.mockResolvedValue({ error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const route = await import("@/app/api/sessions/[id]/videos/route");
    expect((await route.POST(request({}), { params: { id: "session-1" } })).status).toBe(403);
    expect((await route.GET()).status).toBe(405);
  });

  it("returns 401 before finalization", async () => {
    const { POST } = await import("@/app/api/sessions/[id]/videos/route");
    expect((await POST(request({}, "none"), { params: { id: "session-1" } })).status).toBe(401);
  });

  it.each([
    ["owner", "pending", false, 200], ["public approved", "approved", true, 200],
    ["private approved", "approved", false, 403], ["public pending", "pending", true, 403],
  ])("playback visibility: %s", async (_name, status, isPublic, expected) => {
    const select = chain({ data: { id: "media-1", user_id: _name === "owner" ? "user-1" : "other", storage_path: "x.mp4", moderation_status: status, sessions: { is_public: isPublic } }, error: null });
    mockFrom.mockReturnValue(select);
    mockStorage.mockReturnValue({ createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: "https://signed" }, error: null }) });
    const { GET } = await import("@/app/api/sessions/[id]/videos/[mediaId]/route");
    expect((await GET({} as NextRequest, { params: { id: "session-1", mediaId: "media-1" } })).status).toBe(expected);
  });

  it("returns 404 when playback media is absent", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    const { GET } = await import("@/app/api/sessions/[id]/videos/[mediaId]/route");
    expect((await GET({} as NextRequest, { params: { id: "s", mediaId: "m" } })).status).toBe(404);
  });
});

describe("admin session video moderation", () => {
  it("rejects non-admins", async () => {
    const { POST } = await import("@/app/api/admin/session-videos/route");
    expect((await POST(request({ mediaId: "m", action: "approve" }, "user"))).status).toBe(403);
  });

  it.each([["approve", "approved", undefined], ["reject", "rejected", "privacy"]])("persists %s transition", async (action, status, reason) => {
    const update = chain({ error: null });
    mockFrom.mockReturnValue(update);
    const { POST } = await import("@/app/api/admin/session-videos/route");
    const response = await POST(request({ mediaId: "media-1", action, ...(reason ? { reason } : {}) }, "admin"));
    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith({ moderation_status: status, moderation_reason: reason ?? null });
  });
});
