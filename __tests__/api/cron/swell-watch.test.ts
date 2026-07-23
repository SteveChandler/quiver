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

import { GET } from "@/app/api/cron/swell-watch/route";

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
    expect(body.data.shadowMatches).toBe(1);
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
});
