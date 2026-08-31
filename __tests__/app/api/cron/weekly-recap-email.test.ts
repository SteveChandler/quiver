/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { GET } from "@/app/api/cron/weekly-recap-email/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mailer/client";
import { WeeklyRecapEmail } from "@/lib/mailer/templates/WeeklyRecapEmail";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { computeBestDaysForUser } from "@/lib/alerts/best-days";

const mockLogDelivery = jest.fn();
jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

const mockThrottle = jest.fn();
const mockResolveNotificationMajorEventHold = jest.fn();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  createSuccessResponse: jest.fn((data, status = 200) => ({
    json: async () => ({
      success: true,
      data,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  createErrorResponse: jest.fn((error, details, status = 500) => ({
    json: async () => ({
      success: false,
      error,
      details,
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status,
  })),
  handleApiError: jest.fn((error) => ({
    json: async () => ({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: "2026-05-26T00:00:00.000Z",
    }),
    status: 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler) => handler),
}));

jest.mock("date-fns", () => ({
  subDays: jest.fn(
    (date: Date, amount: number) =>
      new Date(date.getTime() - amount * 24 * 60 * 60 * 1000)
  ),
  format: jest.fn(() => "May 26"),
  startOfDay: jest.fn(
    (date: Date) =>
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0,
        0,
        0,
        0
      )
  ),
  endOfDay: jest.fn(
    (date: Date) =>
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999
      )
  ),
}));

jest.mock("date-fns/subDays", () => ({
  __esModule: true,
  default: jest.fn(
    (date: Date, amount: number) =>
      new Date(date.getTime() - amount * 24 * 60 * 60 * 1000)
  ),
}));

jest.mock("date-fns/format", () => ({
  __esModule: true,
  default: jest.fn(() => "May 26"),
}));

jest.mock("date-fns/startOfDay", () => ({
  __esModule: true,
  default: jest.fn(
    (date: Date) =>
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0,
        0,
        0,
        0
      )
  ),
}));

jest.mock("date-fns/endOfDay", () => ({
  __esModule: true,
  default: jest.fn(
    (date: Date) =>
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999
      )
  ),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/mailer/client", () => ({
  sendEmail: jest.fn(),
  MAIL_FROM: "Quiver <from@example.com>",
  MAIL_REPLY_TO: "Quiver <reply@example.com>",
  getBaseUrl: jest.fn(() => "https://quiver.test"),
}));

jest.mock("@/lib/alerts/email-token", () => ({
  generateEmailUnsubscribeToken: jest.fn(() => "test-unsubscribe-token"),
}));

jest.mock("@/lib/mailer/templates/WeeklyRecapEmail", () => ({
  WeeklyRecapEmail: jest.fn((props) => ({
    type: "WeeklyRecapEmail",
    props,
  })),
}));

jest.mock("@/lib/services/email-logging-service", () => ({
  createEmailLogger: jest.fn(() => ({
    logDelivery: mockLogDelivery,
  })),
}));

jest.mock("@/lib/utils/email-rate-limiter", () => ({
  createResendRateLimiter: jest.fn(() => ({
    throttle: mockThrottle,
  })),
}));

jest.mock("@/lib/alerts/best-days", () => ({
  computeBestDaysForUser: jest.fn(() => Promise.resolve([])),
}));

jest.mock(
  "@/lib/recommendations/major-event-hold/adapters/notification",
  () => ({
    resolveNotificationMajorEventHold: (...args: unknown[]) =>
      mockResolveNotificationMajorEventHold(...args),
  })
);

type SessionRow = {
  id: string;
  user_id: string;
  duration_minutes: number | null;
  beach_id: string | null;
  beach_name: string | null;
  beaches: { name: string } | { name: string }[] | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  experience_level: string | null;
  notif_email_enabled: boolean;
};

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type SessionsQuery = {
  select: jest.Mock<SessionsQuery, [string]>;
  gte: jest.Mock<SessionsQuery, [string, string]>;
  lte: jest.Mock<Promise<QueryResult<SessionRow>>, [string, string]>;
};

type ProfilesQuery = {
  select: jest.Mock<ProfilesQuery, [string]>;
  in: jest.Mock<ProfilesQuery, [string, string[]]>;
  eq: jest.Mock<ProfilesQuery, [string, boolean]>;
  not: jest.Mock<Promise<QueryResult<ProfileRow>>, [string, string, null]>;
};

type BeachSourcesRow = {
  camera_url: string | null;
  thumbnail_url: string | null;
};

type SingleResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type BeachSourcesQuery = {
  select: jest.Mock<BeachSourcesQuery, [string]>;
  eq: jest.Mock<BeachSourcesQuery, [string, string]>;
  maybeSingle: jest.Mock<Promise<SingleResult<BeachSourcesRow>>, []>;
};

type SupabaseMock = {
  from: jest.Mock<SessionsQuery | ProfilesQuery | BeachSourcesQuery, [string]>;
};

function createSessionsQuery(result: QueryResult<SessionRow>): SessionsQuery {
  const query = {} as SessionsQuery;
  query.select = jest.fn<SessionsQuery, [string]>(() => query);
  query.gte = jest.fn<SessionsQuery, [string, string]>(() => query);
  query.lte = jest.fn<Promise<QueryResult<SessionRow>>, [string, string]>(() =>
    Promise.resolve(result)
  );
  return query;
}

function createProfilesQuery(result: QueryResult<ProfileRow>): ProfilesQuery {
  const query = {} as ProfilesQuery;
  query.select = jest.fn<ProfilesQuery, [string]>(() => query);
  query.in = jest.fn<ProfilesQuery, [string, string[]]>(() => query);
  query.eq = jest.fn<ProfilesQuery, [string, boolean]>(() => query);
  query.not = jest.fn<Promise<QueryResult<ProfileRow>>, [string, string, null]>(
    () => Promise.resolve(result)
  );
  return query;
}

function createBeachSourcesQuery(
  result: SingleResult<BeachSourcesRow>
): BeachSourcesQuery {
  const query = {} as BeachSourcesQuery;
  query.select = jest.fn<BeachSourcesQuery, [string]>(() => query);
  query.eq = jest.fn<BeachSourcesQuery, [string, string]>(() => query);
  query.maybeSingle = jest.fn<Promise<SingleResult<BeachSourcesRow>>, []>(() =>
    Promise.resolve(result)
  );
  return query;
}

describe("weekly recap email cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/weekly-recap-email/route.ts",
    "utf8"
  );

  let sessionsQuery: SessionsQuery;
  let profilesQuery: ProfilesQuery;
  let beachSourcesQuery: BeachSourcesQuery;
  let supabase: SupabaseMock;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  function mockSupabaseQueries(
    sessionsResult: QueryResult<SessionRow>,
    profilesResult: QueryResult<ProfileRow> = { data: [], error: null },
    beachSourcesResult: SingleResult<BeachSourcesRow> = {
      data: null,
      error: null,
    }
  ): void {
    sessionsQuery = createSessionsQuery(sessionsResult);
    profilesQuery = createProfilesQuery(profilesResult);
    beachSourcesQuery = createBeachSourcesQuery(beachSourcesResult);
    supabase = {
      from: jest.fn<SessionsQuery | ProfilesQuery | BeachSourcesQuery, [string]>(
        (table) => {
          if (table === "sessions") {
            return sessionsQuery;
          }
          if (table === "profiles") {
            return profilesQuery;
          }
          if (table === "beach_sources") {
            return beachSourcesQuery;
          }
          throw new Error(`Unexpected table: ${table}`);
        }
      ),
    };
    (createSupabaseServiceRoleClient as jest.Mock).mockResolvedValue(supabase);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );
    mockSupabaseQueries({ data: [], error: null });
    mockLogDelivery.mockResolvedValue(undefined);
    mockThrottle.mockResolvedValue(undefined);
    (sendEmail as jest.Mock).mockResolvedValue({
      data: { id: "message-1" },
      error: null,
    });
    (computeBestDaysForUser as jest.Mock).mockResolvedValue([]);
    mockResolveNotificationMajorEventHold.mockResolvedValue({
      status: "allowed",
      candidate: null,
    });
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("rejects unauthorized cron requests before creating a Supabase client", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/cron/weekly-recap-email")
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      success: false,
      error: "Unauthorized",
      details: "Invalid cron authentication",
      timestamp: "2026-05-26T00:00:00.000Z",
    });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns an empty weekly summary without fetching profiles when no sessions exist", async () => {
    mockSupabaseQueries({ data: [], error: null });

    const response = await GET(
      new Request("http://localhost/api/cron/weekly-recap-email")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("sessions");
    expect(supabase.from).not.toHaveBeenCalledWith("profiles");
    expect(sessionsQuery.select).toHaveBeenCalledWith(
      expect.stringContaining("user_id")
    );
    expect(sessionsQuery.gte).toHaveBeenCalledWith(
      "arrival_time",
      expect.any(String)
    );
    expect(sessionsQuery.lte).toHaveBeenCalledWith(
      "arrival_time",
      expect.any(String)
    );
    expect(data.success).toBe(true);
    expect(data.data.message).toBe("No sessions found this week");
    expect(data.data.summary).toMatchObject({
      activeUsers: 0,
      sent: 0,
      skipped: {
        noEmail: 0,
        sendFailed: 0,
      },
    });
    expect(typeof data.data.summary.durationMs).toBe("number");
    expect(createEmailLogger).not.toHaveBeenCalled();
    expect(createResendRateLimiter).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends and logs a weekly recap for an eligible active user", async () => {
    mockSupabaseQueries(
      {
        data: [
          {
            id: "session-1",
            user_id: "user-1",
            duration_minutes: 60,
            beach_id: "beach-1",
            beach_name: null,
            beaches: { name: "Mission Beach" },
          },
          {
            id: "session-2",
            user_id: "user-1",
            duration_minutes: 30,
            beach_id: "beach-1",
            beach_name: "Fallback Beach",
            beaches: { name: "Mission Beach" },
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: "user-1",
            email: "surfer@example.com",
            display_name: "Test Surfer",
            experience_level: "intermediate",
            notif_email_enabled: true,
          },
        ],
        error: null,
      },
      {
        data: {
          camera_url: "https://youtu.be/abc123",
          thumbnail_url: null,
        },
        error: null,
      }
    );

    const response = await GET(
      new Request("http://localhost/api/cron/weekly-recap-email")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(profilesQuery.select).toHaveBeenCalledWith(
      "id, email, display_name, experience_level, notif_email_enabled"
    );
    expect(profilesQuery.in).toHaveBeenCalledWith("id", ["user-1"]);
    expect(profilesQuery.eq).toHaveBeenCalledWith("notif_email_enabled", true);
    expect(profilesQuery.eq).toHaveBeenCalledWith("is_mock", false);
    expect(profilesQuery.not).toHaveBeenCalledWith("email", "is", null);
    expect(computeBestDaysForUser).not.toHaveBeenCalled();
    // Top-spot cam thumbnail resolved from beach_sources (top spot is the
    // beach_id shared by both sessions). Pure URL derivation — no network.
    expect(beachSourcesQuery.eq).toHaveBeenCalledWith("beach_id", "beach-1");
    expect(mockThrottle).toHaveBeenCalledTimes(1);
    expect(WeeklyRecapEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: "Test Surfer",
        stats: {
          totalSessions: 2,
          totalHours: "1.5",
          topSpot: "Mission Beach",
        },
        ctaUrl: expect.stringContaining("https://quiver.test/profile/analytics?"),
        unsubscribeUrl: "https://quiver.test/settings",
        bestDays: [],
        topSpotImageUrl: "https://img.youtube.com/vi/abc123/mqdefault.jpg",
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Quiver <from@example.com>",
        replyTo: "Quiver <reply@example.com>",
        to: "surfer@example.com",
        subject: "Your Week in the Water: 2 Sessions",
        unsubscribeUrl:
          "https://quiver.test/api/alerts/unsubscribe-email?user_id=user-1&token=test-unsubscribe-token",
        react: {
          type: "WeeklyRecapEmail",
          props: expect.any(Object),
        },
      })
    );
    expect(mockLogDelivery).toHaveBeenCalledWith({
      userId: "user-1",
      emailType: "weekly_recap",
      messageInstanceId: expect.any(String),
      subject: "Your Week in the Water: 2 Sessions",
      resendMessageId: "message-1",
      meta: { session_count: 2 },
    });
    const ctaUrl = new URL((WeeklyRecapEmail as jest.Mock).mock.calls[0][0].ctaUrl);
    expect(ctaUrl.pathname).toBe("/profile/analytics");
    expect(ctaUrl.searchParams.get("email_type")).toBe("weekly_recap");
    expect(ctaUrl.searchParams.get("utm_campaign")).toBe("weekly_recap");
    expect(ctaUrl.searchParams.get("message_instance_id")).toBe(
      mockLogDelivery.mock.calls[0][0].messageInstanceId,
    );
    expect(data.success).toBe(true);
    expect(data.data.summary).toMatchObject({
      activeUsers: 1,
      sent: 1,
      skipped: {
        noEmail: 0,
        sendFailed: 0,
      },
    });
    expect(typeof data.data.summary.durationMs).toBe("number");
  });

  it("sends the retrospective recap without a separate best-days recommendation", async () => {
    mockSupabaseQueries(
      {
        data: [
          {
            id: "session-1",
            user_id: "user-1",
            duration_minutes: 60,
            beach_id: "beach-1",
            beach_name: "Mission Beach",
            beaches: { name: "Mission Beach" },
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: "user-1",
            email: "surfer@example.com",
            display_name: "Test Surfer",
            experience_level: "beginner",
            notif_email_enabled: true,
          },
        ],
        error: null,
      }
    );
    (computeBestDaysForUser as jest.Mock).mockResolvedValue([
      {
        beach_name: "Mission Beach",
        score: 8.5,
        label: "GOOD",
        weekday: "Thursday",
        time: "6am",
      },
    ]);
    mockResolveNotificationMajorEventHold.mockResolvedValue({
      status: "suppressed",
      reasonCode: "hold_state_unavailable",
      auditCode: "major_event_hold",
      candidate: null,
    });

    const response = await GET(
      new Request("http://localhost/api/cron/weekly-recap-email")
    );

    expect(response.status).toBe(200);
    expect(mockResolveNotificationMajorEventHold).not.toHaveBeenCalled();
    expect(computeBestDaysForUser).not.toHaveBeenCalled();
    expect(WeeklyRecapEmail).toHaveBeenCalledWith(
      expect.objectContaining({ bestDays: [] })
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
