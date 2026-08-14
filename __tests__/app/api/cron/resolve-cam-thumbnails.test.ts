/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/cron/resolve-cam-thumbnails/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_job: string, handler: (request: Request) => Promise<Response>) => handler),
}));

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
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/media/cam-thumbnail", () => ({
  getCamThumbnailUrl: jest.fn(() => null),
}));

type EmptyBeachSourcesQuery = {
  select: jest.Mock<EmptyBeachSourcesQuery, [string]>;
  not: jest.Mock<EmptyBeachSourcesQuery, [string, string, null]>;
  neq: jest.Mock<EmptyBeachSourcesQuery, [string, string]>;
  is: jest.Mock<Promise<{ data: unknown[]; error: null }>, [string, null]>;
  then: Promise<{ data: unknown[]; error: null }>["then"];
};

function createEmptyBeachSourcesQuery(): EmptyBeachSourcesQuery {
  const emptyResult = Promise.resolve({ data: [], error: null });
  const query = {} as EmptyBeachSourcesQuery;
  query.select = jest.fn<EmptyBeachSourcesQuery, [string]>(() => query);
  query.not = jest.fn<EmptyBeachSourcesQuery, [string, string, null]>(
    () => query
  );
  query.neq = jest.fn<EmptyBeachSourcesQuery, [string, string]>(() => query);
  query.is = jest.fn<Promise<{ data: unknown[]; error: null }>, [string, null]>(
    () => emptyResult
  );
  query.then = emptyResult.then.bind(emptyResult);

  return query;
}

describe("resolve cam thumbnails cron route", () => {
  const routeSource = readFileSync(
    "app/api/cron/resolve-cam-thumbnails/route.ts",
    "utf8"
  );

  let beachSourcesQuery: EmptyBeachSourcesQuery;
  let supabase: { from: jest.Mock<EmptyBeachSourcesQuery, [string]> };

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );

    beachSourcesQuery = createEmptyBeachSourcesQuery();
    supabase = {
      from: jest.fn<EmptyBeachSourcesQuery, [string]>(
        () => beachSourcesQuery
      ),
    };
    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(supabase);
  });

  it("uses the API wrapper barrel for response helpers and cron request validation", () => {
    expect(routeSource).not.toContain("@/lib/api-utils");
    expect(routeSource).toContain("@/lib/middleware/api-wrappers");
  });

  it("rejects unauthorized cron requests before creating a Supabase client", async () => {
    const { validateCronRequest } = require("@/lib/middleware/api-wrappers");
    validateCronRequest.mockReturnValue(false);

    const response = await GET(
      new NextRequest("http://localhost/api/cron/resolve-cam-thumbnails")
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
  });

  it("filters for missing thumbnails by default and returns an empty-queue response", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/cron/resolve-cam-thumbnails")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("beach_sources");
    expect(beachSourcesQuery.select).toHaveBeenCalledWith(
      "beach_id, camera_url, thumbnail_url"
    );
    expect(beachSourcesQuery.not).toHaveBeenCalledWith(
      "camera_url",
      "is",
      null
    );
    expect(beachSourcesQuery.neq).toHaveBeenCalledWith("camera_url", "");
    expect(beachSourcesQuery.is).toHaveBeenCalledWith("thumbnail_url", null);
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({
      message: "No cams to process",
    });
    expect(typeof data.data.duration).toBe("string");
  });

  it("does not filter missing thumbnails when force mode is enabled", async () => {
    const response = await POST(
      new NextRequest(
        "http://localhost/api/cron/resolve-cam-thumbnails?force=true"
      )
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(beachSourcesQuery.is).not.toHaveBeenCalled();
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({
      message: "No cams to process",
    });
  });
});
