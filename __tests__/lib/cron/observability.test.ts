// __tests__/lib/cron/observability.test.ts
import { readFileSync } from "fs";
import { join } from "path";
import { withCronObservability, withObservedCron } from "@/lib/cron/observability";
import { completeCronCheckIn, startCronCheckIn } from "@/lib/monitoring/sentry-cron";

type MockChain = ReturnType<typeof mockChain>;

// Plain Response builders. The wrapper only reads .clone()/.text()/.ok/.status,
// all standard Web API — avoid NextResponse.json which isn't implemented in jsdom.
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function errorEnvelope(error: string, details: unknown, status: number): Response {
  return jsonResponse({ success: false, error, details, timestamp: new Date().toISOString() }, status);
}
function successEnvelope(data: unknown, status = 200): Response {
  return jsonResponse({ success: true, data, timestamp: new Date().toISOString() }, status);
}

function mockChain() {
  const insertMock = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: { id: "run-1" }, error: null }),
    }),
  });
  // .update(...).eq(col, val) → thenable that also supports .lt(col, val) for the sweeper
  const lastEqArgs: Array<[string, unknown]> = [];
  const lastLtArgs: Array<[string, unknown]> = [];
  const updateMock = jest.fn().mockImplementation(() => ({
    eq: jest.fn().mockImplementation((col: string, val: unknown) => {
      lastEqArgs.push([col, val]);
      const eqResult: Promise<{ error: null }> & { lt?: jest.Mock } = Promise.resolve({
        error: null,
      }) as Promise<{ error: null }> & { lt?: jest.Mock };
      eqResult.lt = jest.fn().mockImplementation((ltCol: string, ltVal: unknown) => {
        lastLtArgs.push([ltCol, ltVal]);
        return Promise.resolve({ error: null });
      });
      return eqResult;
    }),
  }));
  return {
    from: jest.fn(() => ({ insert: insertMock, update: updateMock })),
    _insertMock: insertMock,
    _updateMock: updateMock,
    _lastEqArgs: lastEqArgs,
    _lastLtArgs: lastLtArgs,
  };
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/monitoring/sentry-cron", () => ({
  startCronCheckIn: jest.fn(() => "check-in-1"),
  completeCronCheckIn: jest.fn(),
}));

describe("cron observability source guard", () => {
  it("uses the API wrapper barrel for cron request validation", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/cron/observability.ts"),
      "utf8"
    );

    expect(source).not.toContain("@/lib/api-utils");
    expect(source).toContain("@/lib/middleware/api-wrappers");
  });
});

function makeAuthorizedRequest(): Request {
  return new Request("http://test/api/cron/test", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

describe("withCronObservability", () => {
  it("records start + ok with summary on success", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const result = await withCronObservability("/api/cron/test", async () => ({ queued: 3 }));

    expect(result).toEqual({ queued: 3 });
    expect(client._insertMock).toHaveBeenCalledWith({ route: "/api/cron/test", status: "started" });
    expect(client._updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ok", summary: { queued: 3 } })
    );
  });

  it("records an error status while retaining a degraded result summary", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);
    const summary = { status: "degraded" as const, matched: 4, queued: 0 };

    const result = await withCronObservability(
      "/api/cron/test",
      async () => summary,
      {
        statusForResult: (value) => value.status === "degraded" ? "error" : "ok",
        errorMessageForResult: () => "Matched alert windows but queued none",
      },
    );

    expect(result).toEqual(summary);
    expect(client._updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        summary,
        error_message: "Matched alert windows but queued none",
      }),
    );
  });

  it("records error and rethrows", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    await expect(
      withCronObservability("/api/cron/test", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(client._updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", error_message: "boom" })
    );
  });

  it("does not block handler when cron_runs insert fails", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    client._insertMock.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: { message: "rls" } }),
      }),
    });
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const result = await withCronObservability("/api/cron/test", async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  it("sweeps stale 'started' rows on every invocation", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    await withCronObservability("/api/cron/test", async () => ({ ok: true }));

    expect(client._updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "timeout",
        error_message: expect.stringContaining("Vercel function killed"),
      })
    );
    expect(client._lastEqArgs).toEqual(expect.arrayContaining([["status", "started"]]));
    expect(client._lastLtArgs[0][0]).toBe("started_at");
    // duration_ms intentionally not asserted on swept rows — implementation leaves it null.
  });
});

describe("withObservedCron", () => {
  let consoleSpy: jest.SpyInstance;
  const originalCronSecret = process.env.CRON_SECRET;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const sentryMonitor = {
    slug: "test-monitor",
    schedule: "* * * * *",
    maxRuntimeMinutes: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.VERCEL_ENV = "production";
    (startCronCheckIn as jest.Mock).mockReturnValue("check-in-1");
    consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  function findUpdate(client: MockChain, predicate: (row: Record<string, unknown>) => boolean) {
    return client._updateMock.mock.calls.find((call) => predicate(call[0] as Record<string, unknown>));
  }

  it("records ok with null error_message when handler returns 200", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron("/api/cron/test", async (_req: Request) =>
      successEnvelope({ count: 1 })
    );
    const response = await handler(makeAuthorizedRequest());

    expect(response.status).toBe(200);
    const okUpdate = findUpdate(client, (row) => row.status === "ok");
    expect(okUpdate?.[0]).toMatchObject({ status: "ok", error_message: null });
  });

  it("records Sentry monitor success check-ins for authorized 2xx responses", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron(
      "/api/cron/test",
      async (_req: Request) => successEnvelope({ count: 1 }),
      sentryMonitor
    );
    await handler(makeAuthorizedRequest());

    expect(startCronCheckIn).toHaveBeenCalledWith(sentryMonitor);
    expect(completeCronCheckIn).toHaveBeenCalledWith(
      "check-in-1",
      "test-monitor",
      "ok",
      expect.any(Number),
    );
  });

  it("records Sentry monitor error check-ins for authorized non-2xx responses", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron(
      "/api/cron/test",
      async (_req: Request) => errorEnvelope("Quota exceeded", { error: "youtube quota 403" }, 500),
      sentryMonitor
    );
    await handler(makeAuthorizedRequest());

    expect(startCronCheckIn).toHaveBeenCalledWith(sentryMonitor);
    expect(completeCronCheckIn).toHaveBeenCalledWith(
      "check-in-1",
      "test-monitor",
      "error",
      expect.any(Number),
    );
  });

  it("records Sentry monitor error check-ins before rethrowing handler errors", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron(
      "/api/cron/test",
      async (_req: Request) => {
        throw new Error("kaboom");
      },
      sentryMonitor
    );

    await expect(handler(makeAuthorizedRequest())).rejects.toThrow("kaboom");
    expect(startCronCheckIn).toHaveBeenCalledWith(sentryMonitor);
    expect(completeCronCheckIn).toHaveBeenCalledWith(
      "check-in-1",
      "test-monitor",
      "error",
      expect.any(Number),
    );
  });

  it("does not change the response when Sentry completion fails", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);
    (completeCronCheckIn as jest.Mock).mockRejectedValueOnce(new Error("flush failed"));

    const handler = withObservedCron(
      "/api/cron/test",
      async (_req: Request) => successEnvelope({ count: 1 }),
      sentryMonitor,
    );

    await expect(handler(makeAuthorizedRequest())).resolves.toMatchObject({ status: 200 });
  });

  it("waits for Sentry completion before resolving the response", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);
    let releaseCompletion!: () => void;
    let signalCompletionStarted!: () => void;
    const completion = new Promise<void>((resolve) => {
      releaseCompletion = resolve;
    });
    const completionStarted = new Promise<void>((resolve) => {
      signalCompletionStarted = resolve;
    });
    (completeCronCheckIn as jest.Mock).mockImplementationOnce(async () => {
      signalCompletionStarted();
      await completion;
    });

    const handler = withObservedCron(
      "/api/cron/test",
      async (_req: Request) => successEnvelope({ count: 1 }),
      sentryMonitor,
    );
    let responseSettled = false;
    const responsePromise = handler(makeAuthorizedRequest()).then((response) => {
      responseSettled = true;
      return response;
    });

    await completionStarted;
    await Promise.resolve();
    expect(responseSettled).toBe(false);

    releaseCompletion();
    await expect(responsePromise).resolves.toMatchObject({ status: 200 });
  });

  it("preserves a thrown handler error when Sentry completion fails", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);
    (completeCronCheckIn as jest.Mock).mockRejectedValueOnce(new Error("flush failed"));

    const handler = withObservedCron(
      "/api/cron/test",
      async (_req: Request) => {
        throw new Error("handler failed");
      },
      sentryMonitor,
    );

    await expect(handler(makeAuthorizedRequest())).rejects.toThrow("handler failed");
  });

  it("extracts 'error: details.error' from createErrorResponse with object details", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron("/api/cron/test", async (_req: Request) =>
      errorEnvelope("Quota exceeded", { error: "youtube quota 403" }, 500)
    );
    await handler(makeAuthorizedRequest());

    const errUpdate = findUpdate(client, (row) => row.status === "error");
    expect(errUpdate?.[0]).toMatchObject({
      status: "error",
      error_message: "Quota exceeded: youtube quota 403",
    });
  });

  it("extracts 'error: details' when details is a bare string", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron("/api/cron/test", async (_req: Request) =>
      errorEnvelope("Configuration error", "YOUTUBE_API_KEY not set", 500)
    );
    await handler(makeAuthorizedRequest());

    const errUpdate = findUpdate(client, (row) => row.status === "error");
    expect(errUpdate![0]).toMatchObject({
      error_message: "Configuration error: YOUTUBE_API_KEY not set",
    });
  });

  it("falls back to 'HTTP <status>' for non-JSON error responses", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron(
      "/api/cron/test",
      async (_req: Request) => new Response("oops", { status: 500 })
    );
    await handler(makeAuthorizedRequest());

    const errUpdate = findUpdate(client, (row) => row.status === "error");
    expect(errUpdate![0]).toMatchObject({ error_message: "HTTP 500" });
  });

  it("populates error_message from thrown errors (regression)", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron("/api/cron/test", async (_req: Request) => {
      throw new Error("kaboom");
    });

    await expect(handler(makeAuthorizedRequest())).rejects.toThrow("kaboom");

    const errUpdate = findUpdate(
      client,
      (row) => row.status === "error" && row.error_message === "kaboom"
    );
    expect(errUpdate?.[0]).toMatchObject({ status: "error", error_message: "kaboom" });
  });

  it("sweeps stale 'started' rows before inserting the new run", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron("/api/cron/test", async (_req: Request) =>
      successEnvelope({ ok: true })
    );
    await handler(makeAuthorizedRequest());

    const sweepUpdate = findUpdate(client, (row) => row.status === "timeout");
    expect(sweepUpdate?.[0]).toMatchObject({
      status: "timeout",
      error_message: expect.stringContaining("Vercel function killed"),
    });
    expect(client._lastEqArgs).toEqual(expect.arrayContaining([["status", "started"]]));
    expect(client._lastLtArgs[0][0]).toBe("started_at");
  });

  it("skips observability entirely on unauthorized requests", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron("/api/cron/test", async (_req: Request) =>
      errorEnvelope("Unauthorized", null, 401)
    );
    const unauthorizedRequest = new Request("http://test/api/cron/test");
    const response = await handler(unauthorizedRequest);

    expect(response.status).toBe(401);
    expect(client._insertMock).not.toHaveBeenCalled();
    expect(client._updateMock).not.toHaveBeenCalled();
  });

  it("skips Sentry monitor check-ins on unauthorized requests", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron(
      "/api/cron/test",
      async (_req: Request) => errorEnvelope("Unauthorized", null, 401),
      sentryMonitor
    );
    const unauthorizedRequest = new Request("http://test/api/cron/test");
    await handler(unauthorizedRequest);

    expect(startCronCheckIn).not.toHaveBeenCalled();
    expect(completeCronCheckIn).not.toHaveBeenCalled();
  });

  it("skips Sentry monitor check-ins for authorized non-production requests", async () => {
    process.env.VERCEL_ENV = "preview";
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const handler = withObservedCron(
      "/api/cron/test",
      async (_req: Request) => successEnvelope({ count: 1 }),
      sentryMonitor
    );
    const response = await handler(makeAuthorizedRequest());

    expect(response.status).toBe(200);
    expect(client._insertMock).toHaveBeenCalledWith({
      route: "/api/cron/test",
      status: "started",
    });
    expect(startCronCheckIn).not.toHaveBeenCalled();
    expect(completeCronCheckIn).not.toHaveBeenCalled();
  });
});
