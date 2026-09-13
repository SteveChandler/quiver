/**
 * @jest-environment node
 */

if (typeof (globalThis as any).Response?.json !== "function") {
  (globalThis as any).Response.json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
}

const mockEnqueueNotification = jest.fn();
const mockResendSend = jest.fn();
const mockThrottle = jest.fn();
const mockLogDelivery = jest.fn();
const mockLoadCohort = jest.fn();
const mockAcquireRun = jest.fn();
const mockProcessCohort = jest.fn();

jest.mock("@/lib/alerts/swell-watch/provider-run-store", () => ({
  loadSwellWatchAcquisitionScope: (...args: unknown[]) => mockLoadCohort(...args),
  acquireProviderRunReceipts: (...args: unknown[]) => mockAcquireRun(...args),
}));
jest.mock("@/lib/alerts/swell-watch/enqueue-candidates", () => ({ enqueueAttestedSwellWatchCohort: (...args: unknown[]) => mockProcessCohort(...args) }));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: (_route: string, handler: any) => handler,
}));

jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: (...args: any[]) => mockEnqueueNotification(...args),
}));

jest.mock("@/lib/mailer/client", () => ({
  MAIL_FROM: "Quiver <alerts@example.com>",
  MAIL_REPLY_TO: "reply@example.com",
  getBaseUrl: () => "https://www.quiversurf.app",
  resend: {
    emails: {
      send: (...args: any[]) => mockResendSend(...args),
    },
  },
}));

jest.mock("@/lib/utils/email-rate-limiter", () => ({
  createResendRateLimiter: () => ({ throttle: mockThrottle }),
}));

jest.mock("@/lib/services/email-logging-service", () => ({
  createEmailLogger: () => ({ logDelivery: mockLogDelivery }),
}));

type Store = {
  profiles: any[];
  beaches: any[];
  forecastsByBeachId: Record<string, any[]>;
  officialRisks: any[];
  claimResult: boolean;
};

const store: Store = {
  profiles: [],
  beaches: [],
  forecastsByBeachId: {},
  officialRisks: [],
  claimResult: true,
};

const BEACH_ID = "11111111-1111-4111-8111-111111111111";

function makeChain(rowsResolver: (chain: any) => any[]) {
  const chain: any = {
    filters: {} as Record<string, any>,
    select: jest.fn(() => chain),
    not: jest.fn(() => chain),
    is: jest.fn(() => chain),
    order: jest.fn(() => chain),
    eq: jest.fn((column: string, value: any) => {
      chain.filters[column] = value;
      return chain;
    }),
    in: jest.fn((column: string, values: any[]) => {
      chain.filters[column] = values;
      return chain;
    }),
    gte: jest.fn((column: string, value: any) => {
      chain.filters[`${column}__gte`] = value;
      return chain;
    }),
    lt: jest.fn((column: string, value: any) => {
      chain.filters[`${column}__lt`] = value;
      return chain;
    }),
    then: (resolve: any) => resolve({ data: rowsResolver(chain), error: null }),
  };
  return chain;
}

const mockSupabase = {
  rpc: jest.fn((_name: string, _args: Record<string, unknown>) =>
    Promise.resolve({ data: store.claimResult, error: null })
  ),
  from: jest.fn((table: string) => {
    if (table === "profiles") return makeChain(() => store.profiles);
    if (table === "beaches") {
      return makeChain((chain) => {
        const ids = chain.filters.id as string[] | undefined;
        if (!ids) return store.beaches;
        return store.beaches.filter((beach) => ids.includes(beach.id));
      });
    }
    if (table === "enhanced_forecasts") {
      return makeChain((chain) => {
        const beachId = chain.filters.beach_id as string | undefined;
        return beachId ? store.forecastsByBeachId[beachId] ?? [] : [];
      });
    }
    if (table === "rip_current_risks") {
      return makeChain((chain) => {
        const beachId = chain.filters.beach_id as string | undefined;
        return store.officialRisks.filter((row) => (
          (!beachId || row.beach_id === beachId)
          && row.risk_level === "high"
        ));
      });
    }
    return makeChain(() => []);
  }),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => mockSupabase,
}));

import { GET, POST } from "@/app/api/cron/swell-watch/route";
import { GET as ACQUIRE } from "@/app/api/cron/swell-watch-acquire/route";
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { calculateSwellWatchPolicyHash, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

describe("GET /api/cron/swell-watch-acquire", () => {
  const originalEnv = process.env;
  const cohort = [{ sourcePointId: BEACH_ID, regionKey: "fixture-region" }];
  const request = (authenticated = true, search = ""): Request => new Request(
    `https://www.quiversurf.app/api/cron/swell-watch-acquire${search}`,
    { headers: authenticated ? { authorization: "Bearer test-cron-secret" } : {} },
  );
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "test-cron-secret", SWELL_WATCH_ENABLED: "false",
      SWELL_WATCH_ACQUISITION_ENABLED: "true", SWELL_WATCH_PRODUCER_CONFIG: JSON.stringify({ cohort }) };
    mockLoadCohort.mockResolvedValue(cohort);
    mockAcquireRun.mockResolvedValue({ issuanceId: BEACH_ID, runBatchId: BEACH_ID, revisionSetId: BEACH_ID });
  });
  afterEach(() => { process.env = originalEnv; });

  it("authenticates and defaults off before acquisition", async () => {
    expect((await ACQUIRE(request(false))).status).toBe(401);
    delete process.env.SWELL_WATCH_ACQUISITION_ENABLED;
    expect(await (await ACQUIRE(request())).json()).toMatchObject({ data: { skipped: true, reason: "disabled", enqueued: 0 } });
    expect(mockLoadCohort).not.toHaveBeenCalled();
    expect(mockAcquireRun).not.toHaveBeenCalled();
  });

  it("collects only the configured cohort while legacy and completed processing stay disabled", async () => {
    const response = await ACQUIRE(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, no-cache, must-revalidate");
    expect(await response.json()).toMatchObject({ data: { runBatchId: BEACH_ID, qualification: "prototype_unqualified", enqueued: 0 } });
    expect(mockLoadCohort).toHaveBeenCalledWith(cohort, mockSupabase);
    expect(mockAcquireRun).toHaveBeenCalledTimes(1);
    expect(await (await GET(request())).json()).toMatchObject({ data: { skipped: true } });
    expect(await (await POST(new Request(request(), { method: "POST", body: JSON.stringify({ provider_batch_id: BEACH_ID }) }))).json())
      .toMatchObject({ data: { skipped: true, enqueued: 0 } });
    expect(mockProcessCohort).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockSupabase.rpc.mock.calls.map(([name]) => name)).toEqual([
      "try_acquire_swell_watch_collection_lease", "release_swell_watch_collection_lease",
    ]);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("rejects caller overrides and malformed configuration before I/O", async () => {
    expect((await ACQUIRE(request(true, "?provider_batch_id=" + BEACH_ID))).status).toBe(400);
    const oversized = Array.from({ length: 11 }, (_, index) => ({
      sourcePointId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, regionKey: "fixture",
    }));
    for (const config of ["null", "{", JSON.stringify({ cohort: [] }), JSON.stringify({ cohort: [cohort[0], cohort[0]] }),
      JSON.stringify({ cohort: oversized })]) {
      process.env.SWELL_WATCH_PRODUCER_CONFIG = config;
      expect((await ACQUIRE(request())).status).toBe(503);
    }
    expect(mockLoadCohort).not.toHaveBeenCalled();
    expect(mockAcquireRun).not.toHaveBeenCalled();
  });

  it("reports upstream failure without processing or leaking details", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mockAcquireRun.mockRejectedValueOnce(new Error("private-provider-detail"));
      const response = await ACQUIRE(request());
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("private-provider-detail");
      expect(JSON.stringify(log.mock.calls)).not.toContain("private-provider-detail");
      expect(mockProcessCohort).not.toHaveBeenCalled();
      expect(mockEnqueueNotification).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});

describe("POST /api/cron/swell-watch completed-run callback", () => {
  const originalEnv = process.env;
  const policy: SwellWatchPolicy = { ...fixturePolicy as SwellWatchPolicy, provenance: "production_approved",
    schema_version: "swell-watch-policy.v2", policy_values: { ...fixturePolicy.policy_values,
      volume_caps: { ...fixturePolicy.policy_values.volume_caps, projected_send_window_hours: 24 } },
    approval_evidence: { approval_id: "fixture", evidence_hash: "a".repeat(64), reviewer: "fixture", reviewed_at: "2026-09-05T00:00:00Z" } };
  policy.value_hash = calculateSwellWatchPolicyHash(policy);
  const cohort = [{ sourcePointId: BEACH_ID, regionKey: "fixture-region" }];
  const scopes = [{ ...cohort[0], latitude: 32.8, longitude: -117.3,
    beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30 } }];
  const post = (body: unknown = { provider_batch_id: BEACH_ID }, authenticated = true): Request =>
    new Request("https://www.quiversurf.app/api/cron/swell-watch", { method: "POST",
      headers: authenticated ? { authorization: "Bearer test-cron-secret" } : {}, body: JSON.stringify(body) });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "test-cron-secret", SWELL_WATCH_ENABLED: "true",
      SWELL_WATCH_PRODUCER_CONFIG: JSON.stringify({ policy, cohort }) };
    mockLoadCohort.mockResolvedValue(scopes);
    mockProcessCohort.mockResolvedValue({ enqueued: 1, duplicates: 0, stoppedReason: null });
  });
  afterEach(() => { process.env = originalEnv; });

  it("authenticates and honors the master switch before database access", async () => {
    expect((await POST(post({}, false))).status).toBe(401);
    expect((await POST(post({ action: "acquire" }, false))).status).toBe(401);
    process.env.SWELL_WATCH_ENABLED = "false";
    expect(await (await POST(post({ action: "acquire" }))).json()).toMatchObject({ data: { skipped: true } });
    expect(await (await POST(post())).json()).toMatchObject({ data: { skipped: true, reason: "disabled", enqueued: 0 } });
    expect(mockLoadCohort).not.toHaveBeenCalled();
    expect(mockProcessCohort).not.toHaveBeenCalled();
    expect(mockAcquireRun).not.toHaveBeenCalled();
  });

  it("rejects caller-selected policy/scope and unavailable server configuration", async () => {
    for (const body of [{}, { provider_batch_id: "not-a-uuid" }, { provider_batch_id: BEACH_ID, cohort },
      { action: "acquire", cohort }, { action: "acquire", provider_batch_id: BEACH_ID }]) {
      expect((await POST(post(body))).status).toBe(400);
    }
    for (const config of ["invalid-json", "null", JSON.stringify({ policy: fixturePolicy, cohort }),
      JSON.stringify({ policy: { ...policy, approval_evidence: null }, cohort }),
      JSON.stringify({ policy, cohort: [cohort[0], cohort[0]] })]) {
      process.env.SWELL_WATCH_PRODUCER_CONFIG = config;
      expect((await POST(post())).status).toBe(503);
    }
    expect(mockLoadCohort).not.toHaveBeenCalled();
    expect(mockProcessCohort).not.toHaveBeenCalled();
  });

  it("passes server-owned membership and the explicit completed ID to the guarded producer", async () => {
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, no-cache, must-revalidate");
    expect(await response.json()).toMatchObject({ data: { enqueued: 1, duplicates: 0, diagnostics: { correlations: [] } } });
    expect(mockLoadCohort).toHaveBeenCalledWith(cohort, mockSupabase);
    expect(mockProcessCohort).toHaveBeenCalledWith({ providerBatchId: BEACH_ID, forecastDays: 7,
      now: expect.any(String), policy, scopes }, mockSupabase, expect.objectContaining({ record: expect.any(Function) }));
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("acquires only the server cohort and returns unqualified receipts without processing", async () => {
    const stored = { issuanceId: BEACH_ID, runBatchId: BEACH_ID, revisionSetId: BEACH_ID };
    mockAcquireRun.mockResolvedValueOnce(stored);
    const response = await POST(post({ action: "acquire" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { ...stored, qualification: "prototype_unqualified", enqueued: 0 } });
    expect(mockLoadCohort).toHaveBeenCalledWith(cohort, mockSupabase);
    expect(mockAcquireRun).toHaveBeenCalledWith({ scopes, forecastDays: 7, latestAvailableAt: expect.any(Date) },
      expect.any(Function), { rpc: expect.any(Function) });
    expect(mockProcessCohort).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockSupabase.rpc.mock.calls.map(([name]) => name)).toEqual([
      "try_acquire_swell_watch_collection_lease", "release_swell_watch_collection_lease",
    ]);
  });

  it.each([undefined, fixturePolicy, null])("collects without release approval (%p), but rejects completion before I/O", async (unapprovedPolicy) => {
    process.env.SWELL_WATCH_PRODUCER_CONFIG = JSON.stringify({ cohort, policy: unapprovedPolicy });
    expect((await POST(post())).status).toBe(503);
    expect(mockLoadCohort).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(mockAcquireRun).not.toHaveBeenCalled();

    const stored = { issuanceId: BEACH_ID, runBatchId: BEACH_ID, revisionSetId: BEACH_ID };
    mockAcquireRun.mockResolvedValueOnce(stored);
    const response = await POST(post({ action: "acquire" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { ...stored, qualification: "prototype_unqualified", enqueued: 0 } });
    expect(mockLoadCohort).toHaveBeenCalledWith(cohort, mockSupabase);
    expect(mockAcquireRun).toHaveBeenCalledTimes(1);
    expect(mockProcessCohort).not.toHaveBeenCalled();
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockSupabase.rpc.mock.calls.map(([name]) => name)).toEqual([
      "try_acquire_swell_watch_collection_lease", "release_swell_watch_collection_lease",
    ]);
  });

  it.each([
    { invalidCohort: [] },
    { invalidCohort: [cohort[0], cohort[0]] },
    { invalidCohort: [{ sourcePointId: "invalid", regionKey: "region" }] },
  ])(
    "rejects invalid acquisition membership before I/O ($invalidCohort)", async ({ invalidCohort }) => {
      process.env.SWELL_WATCH_PRODUCER_CONFIG = JSON.stringify({ cohort: invalidCohort });
      expect((await POST(post({ action: "acquire" }))).status).toBe(503);
      expect(mockLoadCohort).not.toHaveBeenCalled();
      expect(mockAcquireRun).not.toHaveBeenCalled();
      expect(mockProcessCohort).not.toHaveBeenCalled();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    },
  );

  it("uses an uncached deadline-bound provider transport", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(new Response("{}"));
    try {
      mockAcquireRun.mockImplementationOnce(async (_input, fetcher) => {
        await fetcher("https://marine-api.open-meteo.com/data/ncep_gfswave016/static/meta.json", { method: "GET", redirect: "error" });
        return { issuanceId: BEACH_ID, runBatchId: BEACH_ID, revisionSetId: BEACH_ID };
      });
      expect((await POST(post({ action: "acquire" }))).status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledWith("https://marine-api.open-meteo.com/data/ncep_gfswave016/static/meta.json", {
        method: "GET", redirect: "error", cache: "no-store", signal: expect.any(AbortSignal),
      });
    } finally { fetchSpy.mockRestore(); }
  });

  it("surfaces acquisition failures without processing a completed batch", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mockAcquireRun.mockRejectedValueOnce(new Error("private-provider-error"));
      const response = await POST(post({ action: "acquire" }));
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("private-provider-error");
      expect(mockProcessCohort).not.toHaveBeenCalled();
      expect(mockEnqueueNotification).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it("surfaces failures as 500 without reflecting raw upstream errors", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      mockProcessCohort.mockRejectedValueOnce(new Error("person@example.com sensitive upstream data"));
      const response = await POST(post());
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("person@example.com");
      expect(log).toHaveBeenCalledWith("[swell-watch] completed-run processing failed", expect.objectContaining({
        stageCounts: expect.objectContaining({ error: 1 }) }));
      expect(JSON.stringify(log.mock.calls)).not.toContain("person@example.com");
    } finally { log.mockRestore(); }
  });
});

function dateKey(offset: number): string {
  const date = new Date("2026-07-01T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function forecastAt(offset: number): string {
  return `${dateKey(offset)}T19:00:00.000Z`;
}

function forecast(offset: number, waveHeight: string, period: string): any {
  return {
    id: `forecast-${offset}`,
    beach_id: BEACH_ID,
    forecast_at: forecastAt(offset),
    forecast_date: dateKey(offset),
    forecast_time: "12:00",
    wave_height: waveHeight,
    wave_period: period,
    swell_1_period: period,
    confidence_score: 80,
    data_source: "NOAA_NWS",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

function request(): Request {
  return new Request("https://www.quiversurf.app/api/cron/swell-watch", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

async function json(response: Response): Promise<any> {
  return response.json();
}

describe("GET /api/cron/swell-watch", () => {
  const originalEnv = process.env;
  const OriginalDate = Date;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      CRON_SECRET: "test-cron-secret",
      SWELL_WATCH_ENABLED: "true",
    };
    jest.useFakeTimers().setSystemTime(new OriginalDate("2026-07-01T15:00:00.000Z"));
    store.profiles = [
      {
        id: "user-1",
        home_beach_id: BEACH_ID,
        timezone: "America/Los_Angeles",
        notif_push_enabled: null,
        notif_reminders: null,
      },
    ];
    store.beaches = [
      {
        id: BEACH_ID,
        name: "Lower Trestles",
        slug: "lower-trestles",
        timezone: "America/Los_Angeles",
        deleted_at: null,
      },
    ];
    store.forecastsByBeachId = {
      [BEACH_ID]: [
        forecast(0, "2 ft", "8s"),
        forecast(1, "2 ft", "8s"),
        forecast(2, "2 ft", "8s"),
        forecast(3, "2 ft", "8s"),
        forecast(4, "5 ft", "15s"),
        forecast(5, "6 ft", "14s"),
      ],
    };
    store.officialRisks = [];
    mockEnqueueNotification.mockResolvedValue({
      enqueued: true,
      eventId: "notification-event-1",
    });
    mockResendSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
    mockThrottle.mockResolvedValue(undefined);
    mockLogDelivery.mockResolvedValue({ success: true });
    store.claimResult = true;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it("returns a skipped summary while disabled", async () => {
    delete process.env.SWELL_WATCH_ENABLED;

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      skipped: true,
      reason: "disabled",
      evaluated: 0,
      sent: 0,
    });
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("fails closed before forecast reads when a push path lacks completed-batch lineage", async () => {
    process.env.SWELL_WATCH_PUSH_ENABLED = "true";

    const response = await GET(request());
    const body = await json(response);

    expect(body.data).toMatchObject({
      skipped: true,
      reason: "missing_immutable_issuance",
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("skips users when no swell event is detected", async () => {
    store.forecastsByBeachId[BEACH_ID] = [
      forecast(0, "2 ft", "8s"),
      forecast(1, "2 ft", "8s"),
      forecast(2, "2 ft", "8s"),
      forecast(3, "2 ft", "8s"),
    ];

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.sent).toBe(0);
    expect(body.data.skippedCounts.no_event).toBe(1);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("records one non-delivering shadow evaluation with the pinned payload shape", async () => {
    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.sent).toBe(0);
    expect(body.data.shadowMatches).toBe(1);
    expect(body.data.automationEnabled).toBe(false);
    expect(body.data.shadowEvaluations[0]).toMatchObject({
      schema_version: "major-swell-notification.v1",
      awareness_mode: "shadow",
      automation_enabled: false,
      enforcement: null,
    });
    expect(body.data.shadowEvaluations).toEqual([
      {
          beach_id: BEACH_ID,
          beach_slug: "lower-trestles",
          beach_name: "Lower Trestles",
          event_start_date: dateKey(4),
          peak_date: dateKey(5),
          peak_height_ft: 6,
          peak_period_s: 14,
          forecast_at: forecastAt(5),
          schema_version: "major-swell-notification.v1",
          awareness_mode: "shadow",
          automation_enabled: false,
          awareness_signal: "forecast_trend",
          awareness_severity: "major",
          official_evidence_refs: [],
          would_suppress_cohorts: ["beginner", "intermediate", "unknown"],
          enforcement: null,
          title: "Swell incoming — Lower Trestles",
          body: "Sunday: building to 6 ft @ 14s. Peak Monday.",
      },
    ]);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("evaluates every active beach without requiring an eligible home-beach profile", async () => {
    store.profiles = [];

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.evaluated).toBe(1);
    expect(body.data.shadowMatches).toBe(1);
    expect(body.data.shadowEvaluations[0]).toMatchObject({
      beach_id: BEACH_ID,
      awareness_signal: "forecast_trend",
    });
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("does not consult notification dedupe while running in shadow", async () => {
    mockEnqueueNotification.mockResolvedValue({
      enqueued: false,
      reason: "duplicate",
    });

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.sent).toBe(0);
    expect(body.data.shadowMatches).toBe(1);
    expect(body.data.duplicates).toBe(0);
    expect(body.data.errors).toBe(0);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("never sends push or email even when every delivery preference is enabled", async () => {
    store.profiles[0] = {
      ...store.profiles[0],
      email: "surfer@example.com",
      notif_email_enabled: true,
      notif_forecast_alerts: true,
    };

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      sent: 0,
      shadowMatches: 1,
      automationEnabled: false,
      shadowEvaluations: [
        {
          awareness_mode: "shadow",
          automation_enabled: false,
          enforcement: null,
        },
      ],
    });
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
    expect(mockLogDelivery).not.toHaveBeenCalled();
  });

  it("corroborates the forecast trend with fresh official advisory evidence", async () => {
    store.officialRisks = [{
      id: "11111111-1111-4111-8111-111111111111",
      beach_id: BEACH_ID,
      valid_date: dateKey(4),
      risk_level: "high",
      source: "alert",
      fetched_at: "2026-07-01T14:30:00.000Z",
    }];
    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.shadowEvaluations[0]).toMatchObject({
      schema_version: "major-swell-notification.v1",
      awareness_mode: "shadow",
      awareness_signal: "corroborated",
      automation_enabled: false,
      enforcement: null,
      official_evidence_refs: [
        "official:rip_current_risks:11111111-1111-4111-8111-111111111111",
      ],
    });
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("detects an official-only signal without inventing forecast peak values", async () => {
    store.forecastsByBeachId[BEACH_ID] = [
      forecast(0, "2 ft", "8s"),
      forecast(1, "2 ft", "8s"),
    ];
    store.officialRisks = [{
      id: "22222222-2222-4222-8222-222222222222",
      beach_id: BEACH_ID,
      valid_date: dateKey(1),
      risk_level: "high",
      source: "srf",
      fetched_at: "2026-07-01T14:30:00.000Z",
    }];
    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.shadowEvaluations[0]).toMatchObject({
      schema_version: "major-swell-notification.v1",
      awareness_mode: "shadow",
      automation_enabled: false,
      awareness_signal: "official_advisory",
      event_start_date: null,
      peak_date: null,
      peak_height_ft: null,
      peak_period_s: null,
      forecast_at: null,
      enforcement: null,
    });
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("still evaluates official advisories when forecast rows are unavailable", async () => {
    store.profiles = [];
    store.forecastsByBeachId[BEACH_ID] = [];
    store.officialRisks = [{
      id: "33333333-3333-4333-8333-333333333333",
      beach_id: BEACH_ID,
      valid_date: dateKey(1),
      risk_level: "high",
      source: "alert",
      fetched_at: "2026-07-01T14:30:00.000Z",
    }];

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.evaluated).toBe(1);
    expect(body.data.shadowMatches).toBe(1);
    expect(body.data.shadowEvaluations[0]).toMatchObject({
      beach_id: BEACH_ID,
      awareness_signal: "official_advisory",
      peak_height_ft: null,
      forecast_at: null,
    });
  });

  it("records a parser failure without retaining an invalid shadow evaluation", async () => {
    const invalidBeachId = "invalid-beach-id";
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    store.beaches = [
      {
        ...store.beaches[0],
        id: invalidBeachId,
      },
    ];
    store.forecastsByBeachId = {
      [invalidBeachId]: store.forecastsByBeachId[BEACH_ID],
    };

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.errors).toBe(1);
    expect(body.data.shadowMatches).toBe(0);
    expect(body.data.shadowEvaluations).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Error evaluating beach ${invalidBeachId}`),
      expect.anything(),
    );
  });
});
