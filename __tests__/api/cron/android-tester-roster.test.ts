import { readFileSync } from "node:fs";
import { join } from "node:path";

const mockValidateCronRequest = jest.fn();
const mockRpc = jest.fn();
const mockCreateServiceClient = jest.fn();
const mockSyncRoster = jest.fn();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: (request: Request) =>
    mockValidateCronRequest(request),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => mockCreateServiceClient(),
}));

jest.mock("@/lib/android-tester-roster/canonical-sync", () => ({
  syncCanonicalAndroidTesterRoster: (input: unknown) =>
    mockSyncRoster(input),
}));

function request(): Request {
  return new Request(
    "http://localhost:3000/api/cron/android-tester-roster",
  );
}

describe("GET /api/cron/android-tester-roster", () => {
  const originalCronEnabled =
    process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED;
  const originalGoogleSyncEnabled =
    process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED;
    delete process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED;
    mockValidateCronRequest.mockReturnValue(true);
    mockCreateServiceClient.mockReturnValue({ rpc: mockRpc });
    mockRpc.mockResolvedValue({ data: 0, error: null });
    mockSyncRoster.mockResolvedValue({
      complete: true,
      addedCount: 0,
      rejoinedCount: 0,
      refreshedCount: 0,
      leftCount: 0,
      purgedCount: 0,
      canonicalSourceCount: 0,
    });
  });

  afterAll(() => {
    if (originalCronEnabled === undefined) {
      delete process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED;
    } else {
      process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED =
        originalCronEnabled;
    }
    if (originalGoogleSyncEnabled === undefined) {
      delete process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED;
    } else {
      process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED =
        originalGoogleSyncEnabled;
    }
  });

  it("rejects invalid cron auth before reading flags or creating a client", async () => {
    mockValidateCronRequest.mockReturnValue(false);
    process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED = "true";
    process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED = "true";
    const { GET } = await import(
      "@/app/api/cron/android-tester-roster/route"
    );

    const response = await GET(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      outcome: "unauthorized",
    });
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSyncRoster).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "false", "TRUE", "1"])(
    "defaults the scheduler off for %p without Google, claim, purge, or mutation",
    async (value) => {
      if (value === undefined) {
        delete process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED;
      } else {
        process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED = value;
      }
      process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED = "true";
      const { GET } = await import(
        "@/app/api/cron/android-tester-roster/route"
      );

      const response = await GET(request());

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        outcome: "disabled",
      });
      expect(mockCreateServiceClient).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockSyncRoster).not.toHaveBeenCalled();
    },
  );

  it("runs due purge independently while Google sync is disabled", async () => {
    process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED = "true";
    process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED = "false";
    mockRpc.mockResolvedValue({ data: 2, error: null });
    const { GET } = await import(
      "@/app/api/cron/android-tester-roster/route"
    );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "purge_android_tester_roster_identities",
      {
        p_actor_user_id: null,
        p_now: expect.any(String),
      },
    );
    expect(mockSyncRoster).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: true,
      outcome: "completed",
      purge: { outcome: "completed", purgedCount: 2 },
      sync: { outcome: "disabled" },
    });
  });

  it.each([undefined, "", "false", "TRUE", "1"])(
    "keeps Google sync off for %p while still running due purge",
    async (value) => {
      process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED = "true";
      if (value === undefined) {
        delete process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED;
      } else {
        process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED = value;
      }
      const { GET } = await import(
        "@/app/api/cron/android-tester-roster/route"
      );

      const response = await GET(request());

      expect(response.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockSyncRoster).not.toHaveBeenCalled();
    },
  );

  it("reports a concurrent claim as busy after independent purge", async () => {
    process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED = "true";
    process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED = "true";
    mockSyncRoster.mockResolvedValue({ complete: false, busy: true });
    const { GET } = await import(
      "@/app/api/cron/android-tester-roster/route"
    );

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      outcome: "completed",
      purge: { outcome: "completed", purgedCount: 0 },
      sync: { outcome: "busy" },
    });
    expect(mockSyncRoster).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: null,
        supabase: { rpc: mockRpc },
      }),
    );
  });

  it("reports an incomplete snapshot without exposing provider details", async () => {
    process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED = "true";
    process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED = "true";
    mockSyncRoster.mockResolvedValue({ complete: false });
    const { GET } = await import(
      "@/app/api/cron/android-tester-roster/route"
    );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sync).toEqual({ outcome: "incomplete" });
    expect(JSON.stringify(body)).not.toMatch(
      /email|member.?id|token|ciphertext|secret|google/i,
    );
  });

  it("runs sync even when purge fails and returns privacy-safe failure classes", async () => {
    process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED = "true";
    process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED = "true";
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "raw database failure with surfer@example.com" },
    });
    const { GET } = await import(
      "@/app/api/cron/android-tester-roster/route"
    );

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(mockSyncRoster).toHaveBeenCalled();
    expect(body).toEqual({
      ok: false,
      outcome: "partial_failure",
      purge: { outcome: "failed" },
      sync: {
        outcome: "complete",
        addedCount: 0,
        rejoinedCount: 0,
        refreshedCount: 0,
        leftCount: 0,
        purgedCount: 0,
        canonicalSourceCount: 0,
      },
    });
    expect(JSON.stringify(body)).not.toContain("surfer@example.com");
  });

  it("keeps purge success when sync throws and exposes no exception details", async () => {
    process.env.ANDROID_TESTER_ROSTER_CRON_ENABLED = "true";
    process.env.ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED = "true";
    mockSyncRoster.mockRejectedValue(
      new Error("private key and member surfer@example.com"),
    );
    const { GET } = await import(
      "@/app/api/cron/android-tester-roster/route"
    );

    const response = await GET(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      outcome: "partial_failure",
      purge: { outcome: "completed", purgedCount: 0 },
      sync: { outcome: "failed" },
    });
  });

  it("declares one six-hour production schedule", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
    ) as {
      crons: Array<{ path: string; schedule: string }>;
    };

    expect(
      config.crons.filter(
        (cron) => cron.path === "/api/cron/android-tester-roster",
      ),
    ).toEqual([
      {
        path: "/api/cron/android-tester-roster",
        schedule: "15 */6 * * *",
      },
    ]);
  });

  it("documents the fail-closed rollout and independent scheduler flags", () => {
    const runbook = readFileSync(
      join(process.cwd(), "docs/android-tester-roster-runbook.md"),
      "utf8",
    );

    expect(runbook).toContain(
      "ANDROID_TESTER_ROSTER_CRON_ENABLED=false",
    );
    expect(runbook).toContain(
      "ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED=false",
    );
    expect(runbook).toContain("15 */6 * * *");
    expect(runbook).toContain(
      "a purge failure does not\nprevent sync",
    );
    expect(runbook).toContain(
      "a sync failure does not undo a successful purge",
    );
  });
});
