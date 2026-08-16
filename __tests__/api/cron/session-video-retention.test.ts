/**
 * @jest-environment node
 */

export {};

const mockList = jest.fn();
const mockSessionVideoRemove = jest.fn();
const mockSessionMediaLookup = jest.fn();
const mockSessionVideoValidateCronRequest = jest.fn(() => true);

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron:
    (_route: string, handler: (request: Request) => Promise<Response>) =>
    (request: Request) =>
      handler(request),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: mockSessionVideoValidateCronRequest,
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ limit: mockSessionMediaLookup }),
      }),
    }),
    storage: {
      from: () => ({ list: mockList, remove: mockSessionVideoRemove }),
    },
  }),
}));

const NOW = Date.parse("2026-08-13T20:00:00.000Z");
const OLD_OBJECT_DATE = new Date(NOW - 25 * 60 * 60 * 1000).toISOString();
const RECENT_OBJECT_DATE = new Date(NOW - 60 * 60 * 1000).toISOString();

function storageObject(
  createdAt: string,
  name = "video.mp4",
): { id: string; name: string; created_at: string } {
  return {
    id: "object-id",
    name,
    created_at: createdAt,
  };
}

function configureListing(
  createdAt: string,
  additionalObjects: Array<{ id: string; name: string; created_at: string }> = [],
): void {
  mockList.mockImplementation(async (path: string) => {
    if (path === "") {
      return { data: [{ id: null, name: "session-id" }], error: null };
    }
    if (path === "session-id") {
      return { data: [{ id: null, name: "user-id" }], error: null };
    }
    if (path === "session-id/user-id") {
      return {
        data: [storageObject(createdAt), ...additionalObjects],
        error: null,
      };
    }
    throw new Error(`unexpected storage prefix: ${path}`);
  });
}

describe("session video retention cron", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    mockSessionVideoValidateCronRequest.mockReturnValue(true);
    mockSessionVideoRemove.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("deletes an orphan older than the safety window", async () => {
    configureListing(OLD_OBJECT_DATE);
    mockSessionMediaLookup.mockResolvedValue({ data: [], error: null });

    const { GET } = await import("@/app/api/cron/session-video-retention/route");
    const response = await GET(
      new Request("https://example.com/api/cron/session-video-retention"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      scanned: 1,
      orphaned: 1,
      deleted: 1,
      failed: 0,
    });
    expect(mockSessionMediaLookup).toHaveBeenCalledWith(1);
    expect(mockSessionVideoRemove).toHaveBeenCalledWith([
      "session-id/user-id/video.mp4",
    ]);
  });

  it("keeps an orphan inside the safety window", async () => {
    configureListing(RECENT_OBJECT_DATE);
    mockSessionMediaLookup.mockResolvedValue({ data: [], error: null });

    const { GET } = await import("@/app/api/cron/session-video-retention/route");
    const response = await GET(
      new Request("https://example.com/api/cron/session-video-retention"),
    );

    expect(await response.json()).toEqual({
      ok: true,
      scanned: 1,
      orphaned: 1,
      deleted: 0,
      failed: 0,
    });
    expect(mockSessionVideoRemove).not.toHaveBeenCalled();
  });

  it("keeps an object with a session_media row regardless of age", async () => {
    configureListing(OLD_OBJECT_DATE);
    mockSessionMediaLookup.mockResolvedValue({
      data: [{ id: "media-id" }],
      error: null,
    });

    const { GET } = await import("@/app/api/cron/session-video-retention/route");
    const response = await GET(
      new Request("https://example.com/api/cron/session-video-retention"),
    );

    expect(await response.json()).toEqual({
      ok: true,
      scanned: 1,
      orphaned: 0,
      deleted: 0,
      failed: 0,
    });
    expect(mockSessionVideoRemove).not.toHaveBeenCalled();
  });

  it("skips an object when the session_media query errors", async () => {
    configureListing(OLD_OBJECT_DATE, [storageObject(OLD_OBJECT_DATE, "second.mp4")]);
    mockSessionMediaLookup
      .mockResolvedValueOnce({
        data: null,
        error: { message: "database unavailable" },
      })
      .mockResolvedValueOnce({ data: [], error: null });

    const { GET } = await import("@/app/api/cron/session-video-retention/route");
    const response = await GET(
      new Request("https://example.com/api/cron/session-video-retention"),
    );

    expect(await response.json()).toEqual({
      ok: false,
      scanned: 2,
      orphaned: 1,
      deleted: 1,
      failed: 1,
    });
    expect(mockSessionVideoRemove).toHaveBeenCalledWith([
      "session-id/user-id/second.mp4",
    ]);
  });
});
