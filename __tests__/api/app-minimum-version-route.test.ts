/** @jest-environment node */
import { NextRequest } from "next/server";

import { GET } from "@/app/api/v1/app/minimum-version/route";
import { resetMinimumVersionWarningsForTests } from "@/lib/native/minimum-version";
import { createPublicReadClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(),
}));

type ReadResult = { data: unknown; error: { code?: string; message: string } | null };

const mockCreatePublicReadClient = createPublicReadClient as jest.Mock;
const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=60";

let ipCounter = 0;
let lastTable: string | null = null;
let lastPlatform: unknown = null;

function mockRead(result: ReadResult | Promise<ReadResult>): void {
  mockCreatePublicReadClient.mockReturnValue({
    from: (table: string) => {
      lastTable = table;
      const builder = {
        select: () => builder,
        eq: (_column: string, value: unknown) => {
          lastPlatform = value;
          return builder;
        },
        abortSignal: () => builder,
        maybeSingle: () => Promise.resolve(result),
      };
      return builder;
    },
  });
}

function request(query: string): NextRequest {
  ipCounter += 1;
  return new NextRequest(`http://localhost/api/v1/app/minimum-version${query}`, {
    headers: { "x-forwarded-for": `10.0.1.${ipCounter}` },
  });
}

async function call(query: string): Promise<{ status: number; body: unknown; cache: string | null }> {
  const response = await GET(request(query));
  return {
    status: response.status,
    body: await response.json(),
    cache: response.headers.get("Cache-Control"),
  };
}

const NULLS_IOS = { platform: "ios", minimum_version: null, minimum_bundle_created_at: null };

describe("GET /api/v1/app/minimum-version", () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    mockCreatePublicReadClient.mockReset();
    resetMinimumVersionWarningsForTests();
    lastTable = null;
    lastPlatform = null;
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    error = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
    jest.useRealTimers();
  });

  it("returns the row for the platform, with the date normalized and the public cache header", async () => {
    mockRead({
      data: { minimum_version: "1.0.6", minimum_bundle_created_at: "2026-11-12T00:00:00+00:00" },
      error: null,
    });

    const result = await call("?platform=ios");

    expect(lastTable).toBe("native_app_minimums");
    expect(lastPlatform).toBe("ios");
    expect(result).toEqual({
      status: 200,
      body: { platform: "ios", minimum_version: "1.0.6", minimum_bundle_created_at: "2026-11-12T00:00:00.000Z" },
      cache: PUBLIC_CACHE,
    });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("reads the Android row for Android", async () => {
    mockRead({ data: { minimum_version: "1.2.3.4", minimum_bundle_created_at: null }, error: null });

    const result = await call("?platform=android");

    expect(lastPlatform).toBe("android");
    expect(result.body).toEqual({ platform: "android", minimum_version: "1.2.3.4", minimum_bundle_created_at: null });
  });

  it("returns nulls with the public cache header when the row is null or missing", async () => {
    mockRead({ data: { minimum_version: null, minimum_bundle_created_at: null }, error: null });
    expect(await call("?platform=ios")).toEqual({ status: 200, body: NULLS_IOS, cache: PUBLIC_CACHE });

    mockRead({ data: null, error: null });
    expect(await call("?platform=ios")).toEqual({ status: 200, body: NULLS_IOS, cache: PUBLIC_CACHE });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("fails open with no-store and an error log when the read returns an error", async () => {
    mockRead({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } });

    const result = await call("?platform=ios");

    expect(result).toEqual({ status: 200, body: NULLS_IOS, cache: "no-store" });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("fails open with no-store when the client cannot be created", async () => {
    mockCreatePublicReadClient.mockImplementation(() => {
      throw new Error("Supabase configuration missing.");
    });

    const result = await call("?platform=ios");

    expect(result).toEqual({ status: 200, body: NULLS_IOS, cache: "no-store" });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("fails open with no-store when the read takes longer than 2 s", async () => {
    jest.useFakeTimers({ doNotFake: ["Date"] });
    mockRead(new Promise<ReadResult>(() => {}));

    const pending = call("?platform=ios");
    await jest.advanceTimersByTimeAsync(2000);
    const result = await pending;

    expect(result).toEqual({ status: 200, body: NULLS_IOS, cache: "no-store" });
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain("timed out");
  });

  it.each(["PGRST205", "42P01"])(
    "returns nulls with no-store and warns once when the table is missing (%s)",
    async (code) => {
      mockRead({ data: null, error: { code, message: 'relation "public.native_app_minimums" does not exist' } });

      const first = await call("?platform=ios");
      const second = await call("?platform=ios");

      expect(first).toEqual({ status: 200, body: NULLS_IOS, cache: "no-store" });
      expect(second).toEqual(first);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain("native_app_minimums is missing");
      expect(error).not.toHaveBeenCalled();
    },
  );

  it("does not treat an unrelated error that says 'does not exist' as a missing table", async () => {
    mockRead({ data: null, error: { code: "42703", message: 'column "minimum_version" does not exist' } });

    const result = await call("?platform=ios");

    expect(result).toEqual({ status: 200, body: NULLS_IOS, cache: "no-store" });
    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain("read failed");
  });

  it.each(["", "?platform=", "?platform=web", "?platform=IOS", "?platform=ios,android"])(
    "returns 400 invalid_platform for %s without a read",
    async (query) => {
      const result = await call(query);

      expect(result.status).toBe(400);
      expect(result.body).toEqual({ error: "invalid_platform" });
      expect(mockCreatePublicReadClient).not.toHaveBeenCalled();
    },
  );

  it("returns a null for an invalid row value, warns with the field name, and never logs the value", async () => {
    const badVersion = "zz-distinctive-bad-value-7731";
    const badDate = "zz-distinctive-bad-date-4410";
    mockRead({ data: { minimum_version: badVersion, minimum_bundle_created_at: badDate }, error: null });

    const result = await call("?platform=android");

    expect(result).toEqual({
      status: 200,
      body: { platform: "android", minimum_version: null, minimum_bundle_created_at: null },
      cache: PUBLIC_CACHE,
    });
    expect(warn).toHaveBeenCalledTimes(2);
    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("native_app_minimums.minimum_version (android)");
    expect(logged).toContain("native_app_minimums.minimum_bundle_created_at (android)");
    expect(logged).not.toContain(badVersion);
    expect(logged).not.toContain(badDate);
  });

  it("ignores a row bundle date later than now", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockRead({ data: { minimum_version: "1.0.6", minimum_bundle_created_at: future }, error: null });

    const result = await call("?platform=ios");

    expect(result.body).toEqual({ platform: "ios", minimum_version: "1.0.6", minimum_bundle_created_at: null });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain(future);
  });
});
