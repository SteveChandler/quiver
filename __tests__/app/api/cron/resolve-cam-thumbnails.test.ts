/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/cron/resolve-cam-thumbnails/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import * as Sentry from "@sentry/nextjs";

const mockInsert = jest.fn();

jest.mock("@sentry/nextjs", () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock("@/lib/cron/observability", () => ({
  ...jest.requireActual("@/lib/cron/observability"),
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
  update: jest.Mock;
  select: jest.Mock<EmptyBeachSourcesQuery, [string]>;
  not: jest.Mock<EmptyBeachSourcesQuery, [string, string, null]>;
  neq: jest.Mock<EmptyBeachSourcesQuery, [string, string]>;
  is: jest.Mock<Promise<{ data: unknown[]; error: null }>, [string, null]>;
  then: Promise<{ data: unknown[]; error: null }>["then"];
};

function createEmptyBeachSourcesQuery(rows: unknown[] = []): EmptyBeachSourcesQuery {
  const emptyResult = Promise.resolve({ data: rows, error: null });
  const query = {} as EmptyBeachSourcesQuery;
  query.update = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) }));
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
  let supabase: { from: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    require("@/lib/middleware/api-wrappers").validateCronRequest.mockReturnValue(
      true
    );

    beachSourcesQuery = createEmptyBeachSourcesQuery();
    mockInsert.mockResolvedValue({ error: null });
    supabase = {
      from: jest.fn(
        (table: string) => table === "cron_runs" ? { insert: mockInsert } : beachSourcesQuery
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
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "ok", produced: 0, expected_min: 0 }));
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("reports an ok zero when camera URLs have no supported thumbnail provider", async () => {
    beachSourcesQuery = createEmptyBeachSourcesQuery([
      { beach_id: "unsupported", camera_url: "https://example.com/camera", thumbnail_url: null },
    ]);
    const response = await GET(new NextRequest("http://localhost/api/cron/resolve-cam-thumbnails"));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ total: 1, updated: 0, skipped: 1, failed: 0 });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      status: "ok", produced: 0, legitimately_zero_reason: "No camera sources had supported thumbnail providers",
    }));
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(beachSourcesQuery.update).not.toHaveBeenCalled();
  });

  it.each([false, true])("keeps a failure when an eligible thumbnail cannot be stored (write fails: %s)", async (writeFails) => {
    beachSourcesQuery = createEmptyBeachSourcesQuery([
      { beach_id: "supported", camera_url: "https://portal.hdontap.com/?stream=beach", thumbnail_url: null },
    ]);
    beachSourcesQuery.update.mockReturnValue({ eq: jest.fn().mockResolvedValue({
      error: writeFails ? { message: "write failed" } : null,
    }) });
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await GET(new NextRequest("http://localhost/api/cron/resolve-cam-thumbnails"));
      expect(response.status).toBe(200);
      expect((await response.json()).data).toMatchObject({ updated: writeFails ? 0 : 1, failed: writeFails ? 1 : 0 });
      expect(beachSourcesQuery.update).toHaveBeenCalledWith({
        thumbnail_url: "https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_beach.stream.jpg",
      });
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        status: writeFails ? "failed" : "ok", produced: writeFails ? 0 : 1, expected_min: 1,
      }));
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(writeFails ? 1 : 0);
    } finally {
      consoleSpy.mockRestore();
    }
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
