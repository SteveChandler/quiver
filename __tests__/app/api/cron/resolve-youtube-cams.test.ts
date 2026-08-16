import { GET } from "@/app/api/cron/resolve-youtube-cams/route";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { readFileSync } from "fs";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron:
    <H extends (request: Request) => Promise<Response>>(
      _route: string,
      handler: H
    ): H =>
      handler,
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  return {
    createSuccessResponse: jest.fn((data: unknown, status = 200) =>
      jsonResponse(
        {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        },
        status
      )
    ),
    createErrorResponse: jest.fn(
      (error: string, details: unknown, status = 500) =>
        jsonResponse(
          {
            success: false,
            error,
            details,
            timestamp: new Date().toISOString(),
          },
          status
        )
    ),
    validateCronRequest: jest.fn(() => true),
  };
});

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/youtube/resolver", () => ({
  resolveChannelId: jest.fn(),
  findLiveStreams: jest.fn(),
  matchStreamToBeach: jest.fn(),
  extractVideoIdFromUrl: jest.fn(),
  buildYouTubeWatchUrl: jest.fn(),
}));

const mockValidateCronRequest = validateCronRequest as jest.MockedFunction<
  typeof validateCronRequest
>;

function createCronRequest(
  url = "http://localhost/api/cron/resolve-youtube-cams"
): Request {
  return new Request(url, {
    headers: {
      authorization: "Bearer test-cron-secret",
    },
  });
}

describe("GET /api/cron/resolve-youtube-cams", () => {
  const routeSource = readFileSync(
    "app/api/cron/resolve-youtube-cams/route.ts",
    "utf8"
  );
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.YOUTUBE_API_KEY;
    mockValidateCronRequest.mockReturnValue(true);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("returns a skipped success response when YOUTUBE_API_KEY is missing", async () => {
    const response = await GET(createCronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      status: "skipped",
      skip_reason: "config_missing",
      message: "YOUTUBE_API_KEY not set",
      processed: 0,
      results: [],
    });
  });
});
