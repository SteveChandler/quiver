/**
 * Trial-lifecycle email cron.
 *
 * The value at risk here is selection, not rendering: every stage is derived
 * from `trial_ends_at`, so a window off by a day silently emails the wrong
 * cohort — or emails a converter about a charge that is not coming.
 */

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: async (_options: unknown, handler: () => Promise<unknown>) =>
    handler(),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: (_slug: string, handler: unknown) => handler,
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data) => ({
    json: () => Promise.resolve({ success: true, data }),
    status: 200,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: () => Promise.resolve({ success: false, error, details }),
    status,
  })),
  handleApiError: jest.fn((error) => ({
    json: () =>
      Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

const mockSendEmail = jest.fn(async (_options: { subject: string }) => ({
  data: { id: "resend-1" },
  error: null,
}));

jest.mock("@/lib/mailer/client", () => ({
  sendEmail: (options: { subject: string }) => mockSendEmail(options),
  MAIL_FROM: "Quiver <test@quiversurf.app>",
  MAIL_REPLY_TO: "Quiver <test@quiversurf.app>",
  getBaseUrl: () => "https://www.quiversurf.app",
}));

const mockLogDelivery = jest.fn(async () => ({ success: true }));
jest.mock("@/lib/services/email-logging-service", () => ({
  createEmailLogger: () => ({ logDelivery: mockLogDelivery }),
}));

jest.mock("@/lib/utils/email-rate-limiter", () => ({
  createResendRateLimiter: () => ({ throttle: async () => undefined }),
}));

jest.mock("@/lib/email/suppression", () => ({
  filterSuppressedRecipients: async (
    _client: unknown,
    recipients: unknown[]
  ) => recipients,
}));

jest.mock("@/lib/alerts/email-token", () => ({
  generateEmailUnsubscribeToken: () => "unsub-token",
}));

// ---------------------------------------------------------------------------
// Supabase stub: records the filters each table query applied so the tests can
// assert on the selection windows rather than on hand-computed timestamps.
// ---------------------------------------------------------------------------

interface QueryRecord {
  table: string;
  filters: { op: string; column: string; value: unknown }[];
}

let queries: QueryRecord[] = [];
let entitlementRows: Record<string, unknown>[] = [];
let sentLogRows: { user_id: string }[] = [];
let recentEmailRows: { user_id: string }[] = [];
let profileRows: Record<string, unknown>[] = [];
let beachRow: Record<string, unknown> | null = null;

function makeChain(table: string) {
  const record: QueryRecord = { table, filters: [] };
  queries.push(record);

  const resolveRows = (): Record<string, unknown>[] => {
    if (table === "user_entitlements") return entitlementRows;
    if (table === "email_send_log") {
      // The quiet-hours read is the one that filters on sent_at.
      const isQuietHoursRead = record.filters.some(
        (f) => f.column === "sent_at"
      );
      return isQuietHoursRead ? recentEmailRows : sentLogRows;
    }
    if (table === "profiles") return profileRows;
    return [];
  };

  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: resolveRows(), error: null }).then(resolve),
    maybeSingle: async () => ({ data: beachRow, error: null }),
  };

  for (const op of ["select", "eq", "gte", "lte", "in", "not"]) {
    chain[op] = (column: string, value: unknown) => {
      record.filters.push({ op, column, value });
      return chain;
    };
  }

  return chain;
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: async () => ({
    from: (table: string) => makeChain(table),
  }),
}));

import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import { GET } from "@/app/api/cron/trial-lifecycle-email/route";

const DAY_MS = 24 * 60 * 60 * 1000;

function filterFor(table: string, op: string, column: string, nth = 0) {
  const matches = queries.filter((q) => q.table === table);
  const record = matches[nth];
  return record?.filters.find((f) => f.op === op && f.column === column);
}

async function run() {
  const response = await (GET as unknown as (r: Request) => Promise<Response>)(
    new Request("https://www.quiversurf.app/api/cron/trial-lifecycle-email")
  );
  return (await response.json()) as {
    success: boolean;
    data: { summary: Record<string, never> };
  };
}

beforeEach(() => {
  queries = [];
  entitlementRows = [];
  sentLogRows = [];
  recentEmailRows = [];
  profileRows = [];
  beachRow = { name: "Blacks Beach", slug: "blacks-beach" };
  mockSendEmail.mockClear();
  mockLogDelivery.mockClear();
});

describe("stage selection windows", () => {
  it("targets day 1 of a 14-day trial as 13 days before trial_ends_at", async () => {
    const now = Date.now();
    await run();

    const gte = filterFor("user_entitlements", "gte", "trial_ends_at", 0);
    const lte = filterFor("user_entitlements", "lte", "trial_ends_at", 0);
    const start = new Date(gte!.value as string).getTime();
    const end = new Date(lte!.value as string).getTime();

    // Centre is now + 13 days, with a ±12h daily window.
    expect(start).toBeGreaterThan(now + 12.4 * DAY_MS);
    expect(end).toBeLessThan(now + 13.6 * DAY_MS);
    expect(end - start).toBeCloseTo(DAY_MS, -4);
  });

  it("targets day 11 as 3 days before trial_ends_at", async () => {
    const now = Date.now();
    await run();

    const gte = filterFor("user_entitlements", "gte", "trial_ends_at", 1);
    const lte = filterFor("user_entitlements", "lte", "trial_ends_at", 1);
    const start = new Date(gte!.value as string).getTime();
    const end = new Date(lte!.value as string).getTime();

    expect(start).toBeGreaterThan(now + 2.4 * DAY_MS);
    expect(end).toBeLessThan(now + 3.6 * DAY_MS);
  });

  it("looks backwards for lapsed trials and requires is_pro false", async () => {
    const now = Date.now();
    await run();

    const lte = filterFor("user_entitlements", "lte", "trial_ends_at", 2);
    expect(new Date(lte!.value as string).getTime()).toBeLessThan(now);

    const isPro = filterFor("user_entitlements", "eq", "is_pro", 2);
    expect(isPro?.value).toBe(false);
  });

  it("requires is_trialing on the two in-trial stages", async () => {
    await run();
    expect(filterFor("user_entitlements", "eq", "is_trialing", 0)?.value).toBe(
      true
    );
    expect(filterFor("user_entitlements", "eq", "is_trialing", 1)?.value).toBe(
      true
    );
  });
});

describe("candidate filtering", () => {
  const trialing = (overrides: Record<string, unknown> = {}) => ({
    user_id: "user-1",
    trial_ends_at: new Date(Date.now() + 13 * DAY_MS).toISOString(),
    product_id: "app.quiversurf.surf.pro.monthly",
    rc_raw: { environment: "PRODUCTION" },
    ...overrides,
  });

  const profile = (overrides: Record<string, unknown> = {}) => ({
    id: "user-1",
    email: "kai@example.com",
    display_name: "Kai",
    home_beach_id: "beach-1",
    timezone: "America/Los_Angeles",
    ...overrides,
  });

  it("sends to an eligible trialing user", async () => {
    entitlementRows = [trialing()];
    profileRows = [profile()];

    const result = await run();

    expect(mockSendEmail).toHaveBeenCalledTimes(3); // one per stage, same stub rows
    expect(result.success).toBe(true);
  });

  it("skips sandbox entitlements", async () => {
    entitlementRows = [trialing({ rc_raw: { environment: "SANDBOX" } })];
    profileRows = [profile()];

    await run();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips users who already received the stage", async () => {
    entitlementRows = [trialing()];
    profileRows = [profile()];
    sentLogRows = [{ user_id: "user-1" }];

    await run();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips users whose email preference is off", async () => {
    entitlementRows = [trialing()];
    profileRows = []; // the profiles query filters on notif_email_enabled

    await run();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("filters profiles on notif_email_enabled", async () => {
    entitlementRows = [trialing()];
    profileRows = [profile()];

    await run();

    expect(filterFor("profiles", "eq", "notif_email_enabled")?.value).toBe(true);
  });
});

describe("charge-date safety", () => {
  it("does not send the charge email when the product price is unknown", async () => {
    // Only the day-11 stage needs a price; give every stage a row and confirm
    // the charge email is the one that drops out.
    entitlementRows = [
      {
        user_id: "user-1",
        trial_ends_at: new Date(Date.now() + 3 * DAY_MS).toISOString(),
        product_id: "app.quiversurf.surf.pro.mystery",
        rc_raw: { environment: "PRODUCTION" },
      },
    ];
    profileRows = [
      {
        id: "user-1",
        email: "kai@example.com",
        display_name: "Kai",
        home_beach_id: "beach-1",
        timezone: "America/Los_Angeles",
      },
    ];

    await run();

    expectConsoleWarnings([/unrecognized product/]);

    const subjects = mockSendEmail.mock.calls.map((call) => call[0].subject);
    expect(subjects.some((s) => s.startsWith("Your trial ends"))).toBe(false);
  });
});

describe("day-1 quiet hours", () => {
  const dayOneRow = {
    user_id: "user-1",
    trial_ends_at: new Date(Date.now() + 13 * DAY_MS).toISOString(),
    product_id: "app.quiversurf.surf.pro.monthly",
    rc_raw: { environment: "PRODUCTION" },
  };
  const dayOneProfile = {
    id: "user-1",
    email: "kai@example.com",
    display_name: "Kai",
    home_beach_id: "beach-1",
    timezone: "America/Los_Angeles",
  };

  it("skips the day-1 email when another email landed in the last 12 hours", async () => {
    entitlementRows = [dayOneRow];
    profileRows = [dayOneProfile];
    recentEmailRows = [{ user_id: "user-1" }];

    await run();

    const subjects = mockSendEmail.mock.calls.map((call) => call[0].subject);
    expect(subjects.some((s) => s.startsWith("Your first Pro call"))).toBe(
      false
    );
  });

  it("does not apply quiet hours to the charge-date email", async () => {
    entitlementRows = [
      { ...dayOneRow, trial_ends_at: new Date(Date.now() + 3 * DAY_MS).toISOString() },
    ];
    profileRows = [dayOneProfile];
    recentEmailRows = [{ user_id: "user-1" }];

    await run();

    const subjects = mockSendEmail.mock.calls.map((call) => call[0].subject);
    expect(subjects.some((s) => s.startsWith("Your trial ends"))).toBe(true);
  });
});
