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

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: (_route: string, handler: any) => handler,
}));

jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: (...args: any[]) => mockEnqueueNotification(...args),
}));

type Store = {
  profiles: any[];
  beaches: any[];
  forecastsByBeachId: Record<string, any[]>;
};

const store: Store = {
  profiles: [],
  beaches: [],
  forecastsByBeachId: {},
};

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
    beach_id: "beach-1",
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
        home_beach_id: "beach-1",
        timezone: "America/Los_Angeles",
        notif_push_enabled: null,
        notif_reminders: null,
      },
    ];
    store.beaches = [
      {
        id: "beach-1",
        name: "Lower Trestles",
        slug: "lower-trestles",
        timezone: "America/Los_Angeles",
        deleted_at: null,
      },
    ];
    store.forecastsByBeachId = {
      "beach-1": [
        forecast(0, "2 ft", "8s"),
        forecast(1, "2 ft", "8s"),
        forecast(2, "2 ft", "8s"),
        forecast(3, "2 ft", "8s"),
        forecast(4, "5 ft", "15s"),
        forecast(5, "6 ft", "14s"),
      ],
    };
    mockEnqueueNotification.mockResolvedValue({
      enqueued: true,
      eventId: "notification-event-1",
    });
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
  });

  it("skips users when no swell event is detected", async () => {
    store.forecastsByBeachId["beach-1"] = [
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
  });

  it("enqueues one swell_watch event with the pinned payload shape", async () => {
    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.sent).toBe(1);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "swell_watch",
        recipientUserId: "user-1",
        dedupeKey: `swell_watch:user-1:beach-1:${dateKey(4)}`,
        payload: {
          beach_id: "beach-1",
          beach_slug: "lower-trestles",
          beach_name: "Lower Trestles",
          event_start_date: dateKey(4),
          peak_date: dateKey(5),
          peak_height_ft: 6,
          peak_period_s: 14,
          forecast_at: forecastAt(5),
          title: "Swell incoming — Lower Trestles",
          body: "Sunday: building to 6 ft @ 14s. Peak Monday.",
        },
      }),
      mockSupabase
    );
  });

  it("treats duplicate dedupe results as success", async () => {
    mockEnqueueNotification.mockResolvedValue({
      enqueued: false,
      reason: "duplicate",
    });

    const response = await GET(request());
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.sent).toBe(0);
    expect(body.data.duplicates).toBe(1);
    expect(body.data.errors).toBe(0);
  });
});
