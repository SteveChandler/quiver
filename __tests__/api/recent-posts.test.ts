/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

type QueryResult = {
  data?: unknown[] | null;
  error?: Error | null;
  count?: number | null;
};

const mockFrom = jest.fn();
const mockBlocksSelect = jest.fn();
const mockCountSelect = jest.fn();
const mockCountEq = jest.fn();
const mockCountNot = jest.fn();
const mockDataSelect = jest.fn();
const mockDataEq = jest.fn();
const mockDataNot = jest.fn();
const mockOrder = jest.fn();
const mockRange = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withBotBlockingAndRateLimit: <T>(handler: T) => handler,
  };
});

import { GET } from "@/app/api/recent-posts/route";

function makeAwaitableBuilder(result: QueryResult) {
  const builder = {
    eq: mockCountEq,
    not: mockCountNot,
    then: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  };

  mockCountEq.mockReturnValue(builder);
  mockCountNot.mockReturnValue(builder);

  return builder;
}

function makeDataBuilder(result: QueryResult) {
  const builder = {
    eq: mockDataEq,
    not: mockDataNot,
    order: mockOrder,
    range: mockRange,
  };

  mockDataEq.mockReturnValue(builder);
  mockDataNot.mockReturnValue(builder);
  mockOrder.mockReturnValue(builder);
  mockRange.mockResolvedValue(result);

  return builder;
}

function setupSupabaseResults({
  blocks = { data: [], error: null },
  count = { count: 1, error: null },
  sessions = { data: [], error: null },
}: {
  blocks?: QueryResult;
  count?: QueryResult;
  sessions?: QueryResult;
}) {
  mockBlocksSelect.mockResolvedValue(blocks);
  const countBuilder = makeAwaitableBuilder(count);
  const dataBuilder = makeDataBuilder(sessions);

  mockCountSelect.mockReturnValue(countBuilder);
  mockDataSelect.mockReturnValue(dataBuilder);

  let sessionsCall = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "user_blocks") {
      return { select: mockBlocksSelect };
    }

    if (table === "sessions") {
      sessionsCall += 1;
      return {
        select: sessionsCall === 1 ? mockCountSelect : mockDataSelect,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe("GET /api/recent-posts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupSupabaseResults({});
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/recent-posts/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("returns paginated recent posts with default pagination and cache headers", async () => {
    setupSupabaseResults({
      count: { count: 9, error: null },
      sessions: {
        data: [
          {
            id: "session-1",
            beach_name: "Ocean Beach",
            notes: "Clean little runners",
            rating: 4,
            description: "fallback description",
            image_url: "/session.jpg",
            likes_count: 3,
            created_at: "2026-05-26T12:00:00Z",
            profiles: {
              id: "profile-1",
              full_name: "Avery",
              avatar_url: "/avery.jpg",
            },
            session_media: [
              {
                id: "media-1",
                public_url: "/clip.mp4",
                media_type: "video",
                caption: "inside section",
                file_size: 1234,
                deleted_at: null,
              },
              {
                id: "media-deleted",
                public_url: "/deleted.jpg",
                media_type: "image",
                caption: null,
                file_size: 222,
                deleted_at: "2026-05-26T13:00:00Z",
              },
            ],
          },
        ],
        error: null,
      },
    });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/recent-posts")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age");
    expect(mockBlocksSelect).toHaveBeenCalledWith("blocked_id");
    expect(mockCountSelect).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });
    expect(mockDataSelect).toHaveBeenCalledWith(expect.stringContaining("session_media"));
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockRange).toHaveBeenCalledWith(0, 3);
    expect(body.meta).toMatchObject({
      page: 1,
      limit: 4,
      total: 9,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(body.data).toEqual([
      {
        id: "session-1",
        caption: "Clean little runners",
        imageUrl: "/session.jpg",
        rating: 4,
        beachName: "Ocean Beach",
        likesCount: 3,
        createdAt: "2026-05-26T12:00:00Z",
        author: {
          id: "profile-1",
          name: "Avery",
          avatar: "/avery.jpg",
        },
        media: [
          {
            id: "media-1",
            url: "/clip.mp4",
            type: "video",
            caption: "inside section",
            fileSize: 1234,
          },
        ],
      },
    ]);
  });

  it("returns an empty cached page when the session query errors", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupSupabaseResults({
      count: { count: 4, error: null },
      sessions: { data: null, error: new Error("sessions failed") },
    });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/recent-posts?page=2&limit=2")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age");
    expect(body.data).toEqual([]);
    expect(body.meta).toMatchObject({
      page: 2,
      limit: 2,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: true,
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Error fetching recent posts:",
      expect.any(Error)
    );

    consoleError.mockRestore();
  });

  it("wraps block query errors", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    setupSupabaseResults({
      blocks: { data: null, error: new Error("blocks failed") },
    });

    const response = await GET(
      new NextRequest("http://localhost:3000/api/recent-posts")
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Failed to fetch recent posts");
    expect(consoleError).toHaveBeenCalledWith(
      "Error in recent-posts API:",
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});
