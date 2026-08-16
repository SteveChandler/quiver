/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/community-stats/route";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";

const REAL_PROFILE_FILTER = "is_mock.is.null,is_mock.eq.false";

type QueryResult = {
  count: number;
  error: null;
};

type QueryBuilder = {
  select: jest.Mock<QueryBuilder, [string, { count: "exact"; head: true }]>;
  or: jest.Mock<QueryBuilder, [string, { referencedTable?: string }?]>;
  gte: jest.Mock<QueryBuilder, [string, string]>;
  then: (
    onFulfilled: (result: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise<unknown>;
};

const mockFrom = jest.fn();

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withBotBlockingAndRateLimit: jest.fn((handler) => handler),
  };
});

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(),
}));

const mockCreateAPIServerClient = createAPIServerClient as jest.MockedFunction<
  typeof createAPIServerClient
>;

function makeQueryBuilder(totalCount: number, realCount: number): QueryBuilder {
  let hasRealProfileFilter = false;

  const builder = {
    select: jest.fn(),
    or: jest.fn(),
    gte: jest.fn(),
    then: (
      onFulfilled: (result: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) =>
      Promise.resolve({
        count: hasRealProfileFilter ? realCount : totalCount,
        error: null,
      }).then(onFulfilled, onRejected),
  } as QueryBuilder;

  builder.select.mockImplementation(() => builder);
  builder.or.mockImplementation(
    (filters: string, options?: { referencedTable?: string }) => {
      if (
        filters === REAL_PROFILE_FILTER &&
        (options === undefined || options.referencedTable === "profiles")
      ) {
        hasRealProfileFilter = true;
      }
      return builder;
    }
  );
  builder.gte.mockImplementation(() => builder);

  return builder;
}

describe("GET /api/community-stats", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const beachQuery = makeQueryBuilder(7, 7);
    const sessionQuery = makeQueryBuilder(3, 2);
    const profileQuery = makeQueryBuilder(3, 2);
    const intelPostQuery = makeQueryBuilder(3, 2);

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "beaches":
          return beachQuery;
        case "sessions":
          return sessionQuery;
        case "profiles":
          return profileQuery;
        case "intel_posts":
          return intelPostQuery;
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    });

    mockCreateAPIServerClient.mockResolvedValue({ from: mockFrom } as never);
  });

  it("excludes synthetic activity, counts NULL is_mock profiles, and preserves the response shape", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/community-stats")
    );

    await expect(response.json()).resolves.toEqual({
      totalBeaches: 7,
      totalSessions: 2,
      totalUsers: 2,
      reportsToday: 2,
    });
    expect(response.status).toBe(200);

    const profileQuery = mockFrom.mock.results[2]?.value as QueryBuilder;
    const sessionQuery = mockFrom.mock.results[1]?.value as QueryBuilder;
    const intelPostQuery = mockFrom.mock.results[3]?.value as QueryBuilder;

    expect(profileQuery.or).toHaveBeenCalledWith(REAL_PROFILE_FILTER);
    expect(sessionQuery.select).toHaveBeenCalledWith(
      "id, profiles!sessions_user_id_profiles_fkey!inner(is_mock)",
      { count: "exact", head: true }
    );
    expect(sessionQuery.or).toHaveBeenCalledWith(REAL_PROFILE_FILTER, {
      referencedTable: "profiles",
    });
    expect(intelPostQuery.select).toHaveBeenCalledWith(
      "id, profiles!intel_posts_user_id_fkey!inner(is_mock)",
      { count: "exact", head: true }
    );
    expect(intelPostQuery.or).toHaveBeenCalledWith(REAL_PROFILE_FILTER, {
      referencedTable: "profiles",
    });
    expect(intelPostQuery.gte).toHaveBeenCalledWith(
      "created_at",
      expect.any(String)
    );
  });
});
