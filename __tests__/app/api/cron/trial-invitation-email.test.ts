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

const mockSendEmail = jest.fn(async (_options: unknown) => ({
  data: { id: "resend-1" },
  error: null,
}));

jest.mock("@/lib/mailer/client", () => ({
  sendEmail: (options: unknown) => mockSendEmail(options),
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

interface QueryRecord {
  table: string;
  filters: { op: string; column: string; value: unknown }[];
}

let queries: QueryRecord[] = [];
let profileRows: Record<string, unknown>[] = [];
let entitlementRows: { user_id: string }[] = [];
let sentLogRows: { user_id: string }[] = [];
let favoriteRows: { user_id: string }[] = [];
let sessionRows: { user_id: string }[] = [];
let alertRows: { user_id: string }[] = [];
let beachRow: Record<string, unknown> | null = null;

function makeChain(table: string) {
  const record: QueryRecord = { table, filters: [] };
  queries.push(record);

  const resolveRows = (): Record<string, unknown>[] => {
    if (table === "profiles") {
      const cutoff = record.filters.find(
        (filter) => filter.op === "lte" && filter.column === "created_at"
      )?.value;
      if (typeof cutoff !== "string") return profileRows;
      return profileRows.filter(
        (profile) =>
          typeof profile.created_at === "string" &&
          profile.created_at <= cutoff
      );
    }
    if (table === "user_entitlements") return entitlementRows;
    if (table === "email_send_log") return sentLogRows;
    if (table === "favorite_beaches") return favoriteRows;
    if (table === "sessions") return sessionRows;
    if (table === "alert_rules") return alertRows;
    return [];
  };

  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: resolveRows(), error: null }).then(resolve),
    maybeSingle: async () => ({ data: beachRow, error: null }),
  };

  for (const op of ["select", "eq", "lte", "in", "not", "order"]) {
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

import { GET } from "@/app/api/cron/trial-invitation-email/route";

const DAY_MS = 24 * 60 * 60 * 1000;
const originalEnabled = process.env.TRIAL_INVITATION_EMAIL_ENABLED;

function profile(
  userId: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: userId,
    email: `${userId}@example.com`,
    display_name: "Kai",
    home_beach_id: "beach-1",
    created_at: new Date(Date.now() - 4 * DAY_MS).toISOString(),
    onboarding_completed_at: new Date(Date.now() - 4 * DAY_MS).toISOString(),
    notif_email_enabled: true,
    ...overrides,
  };
}

async function run() {
  const response = await (GET as unknown as (r: Request) => Promise<Response>)(
    new Request("https://www.quiversurf.app/api/cron/trial-invitation-email")
  );
  return response.json();
}

beforeEach(() => {
  process.env.TRIAL_INVITATION_EMAIL_ENABLED = "true";
  queries = [];
  profileRows = [];
  entitlementRows = [];
  sentLogRows = [];
  favoriteRows = [];
  sessionRows = [];
  alertRows = [];
  beachRow = { name: "Blacks Beach", slug: "blacks-beach" };
  mockSendEmail.mockClear();
  mockLogDelivery.mockClear();
});

afterAll(() => {
  if (originalEnabled === undefined) {
    delete process.env.TRIAL_INVITATION_EMAIL_ENABLED;
  } else {
    process.env.TRIAL_INVITATION_EMAIL_ENABLED = originalEnabled;
  }
});

it("does no work while the operator gate is disabled", async () => {
  delete process.env.TRIAL_INVITATION_EMAIL_ENABLED;

  const result = await run();

  expect(result.data.summary).toEqual({
    enabled: false,
    candidates: 0,
    sent: 0,
  });
  expect(queries.some((query) => query.table === "profiles")).toBe(false);
  expect(mockSendEmail).not.toHaveBeenCalled();
});

it("sends to an old-enough engaged user with no entitlement", async () => {
  profileRows = [profile("user-1")];
  sessionRows = [{ user_id: "user-1" }];

  const result = await run();

  expect(result.success).toBe(true);
  expect(mockSendEmail).toHaveBeenCalledTimes(1);
  expect(mockLogDelivery).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: "user-1",
      emailType: "trial_invitation",
      meta: expect.objectContaining({
        beach_name: "Blacks Beach",
        signup_at: expect.any(String),
        message_instance_id: expect.any(String),
      }),
    })
  );
});

it("skips a user with any entitlement row", async () => {
  profileRows = [profile("user-1")];
  entitlementRows = [{ user_id: "user-1" }];
  sessionRows = [{ user_id: "user-1" }];

  await run();

  expect(mockSendEmail).not.toHaveBeenCalled();
});

it("filters out users younger than three days", async () => {
  const now = Date.now();
  profileRows = [
    profile("user-1", {
      created_at: new Date(now - 2 * DAY_MS).toISOString(),
    }),
  ];
  sessionRows = [{ user_id: "user-1" }];

  await run();

  const ageFilter = queries
    .find((query) => query.table === "profiles")
    ?.filters.find(
      (filter) => filter.op === "lte" && filter.column === "created_at"
    );
  const cutoff = new Date(ageFilter!.value as string).getTime();
  // Upper bound uses a post-run clock reading: the route calls Date.now()
  // after `now` is captured, so a ms tick between them must not fail the test.
  const afterRun = Date.now();
  expect(cutoff).toBeGreaterThan(now - 3 * DAY_MS - 2_000);
  expect(cutoff).toBeLessThanOrEqual(afterRun - 3 * DAY_MS);
  expect(mockSendEmail).not.toHaveBeenCalled();
});

it("skips a user with no engagement rows", async () => {
  profileRows = [profile("user-1")];

  const result = await run();

  expect(result.data.summary.skipped.noEngagement).toBe(1);
  expect(mockSendEmail).not.toHaveBeenCalled();
});

it("skips a user who already received the invitation", async () => {
  profileRows = [profile("user-1")];
  sentLogRows = [{ user_id: "user-1" }];
  favoriteRows = [{ user_id: "user-1" }];

  await run();

  const logQuery = queries.find((query) => query.table === "email_send_log");
  expect(logQuery?.filters).toContainEqual({
    op: "eq",
    column: "email_type",
    value: "trial_invitation",
  });
  expect(mockSendEmail).not.toHaveBeenCalled();
});

it("caps a warm backlog at 15 sends per run", async () => {
  profileRows = Array.from({ length: 20 }, (_, index) =>
    profile(`user-${index + 1}`)
  );
  favoriteRows = profileRows.map((row) => ({ user_id: row.id as string }));

  const result = await run();

  expect(mockSendEmail).toHaveBeenCalledTimes(15);
  expect(result.data.summary.sent).toBe(15);
  expect(result.data.summary.skipped.overCap).toBe(5);
});

it("excludes NPC/mock profiles from the audience query", async () => {
  profileRows = [profile("user-1")];
  favoriteRows = [{ user_id: "user-1" }];

  await run();

  const profilesQuery = queries.find((query) => query.table === "profiles");
  expect(profilesQuery?.filters).toContainEqual({
    op: "eq",
    column: "is_mock",
    value: false,
  });
});
