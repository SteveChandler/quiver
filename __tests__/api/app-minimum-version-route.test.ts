/** @jest-environment node */
import { NextRequest } from "next/server";

import { GET } from "@/app/api/v1/app/minimum-version/route";

const ENV_NAMES = [
  "NATIVE_MIN_APP_VERSION_IOS",
  "NATIVE_MIN_APP_VERSION_ANDROID",
  "NATIVE_MIN_BUNDLE_CREATED_AT_IOS",
  "NATIVE_MIN_BUNDLE_CREATED_AT_ANDROID",
] as const;

let ipCounter = 0;

function request(query: string): NextRequest {
  ipCounter += 1;
  return new NextRequest(`http://localhost/api/v1/app/minimum-version${query}`, {
    headers: { "x-forwarded-for": `10.0.0.${ipCounter}` },
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

describe("GET /api/v1/app/minimum-version", () => {
  beforeEach(() => {
    for (const name of ENV_NAMES) delete process.env[name];
  });

  afterAll(() => {
    for (const name of ENV_NAMES) delete process.env[name];
  });

  it("returns the iOS minimums from the env vars, with the date normalized", async () => {
    process.env.NATIVE_MIN_APP_VERSION_IOS = "1.0.6";
    process.env.NATIVE_MIN_BUNDLE_CREATED_AT_IOS = "2026-11-12T00:00:00Z";

    const result = await call("?platform=ios");

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      platform: "ios",
      minimum_version: "1.0.6",
      minimum_bundle_created_at: "2026-11-12T00:00:00.000Z",
    });
  });

  it("reads the Android vars for Android and not the iOS vars", async () => {
    process.env.NATIVE_MIN_APP_VERSION_IOS = "9.9.9";
    process.env.NATIVE_MIN_APP_VERSION_ANDROID = "1.2.3.4";
    process.env.NATIVE_MIN_BUNDLE_CREATED_AT_ANDROID = "2026-11-12T08:30:00-08:00";

    const result = await call("?platform=android");

    expect(result.body).toEqual({
      platform: "android",
      minimum_version: "1.2.3.4",
      minimum_bundle_created_at: "2026-11-12T16:30:00.000Z",
    });
  });

  it("accepts a date-only bundle minimum as UTC midnight", async () => {
    process.env.NATIVE_MIN_BUNDLE_CREATED_AT_IOS = "2026-11-12";

    const result = await call("?platform=ios");

    expect(result.body).toEqual({
      platform: "ios",
      minimum_version: null,
      minimum_bundle_created_at: "2026-11-12T00:00:00.000Z",
    });
  });

  it("returns nulls when the env vars are unset or blank", async () => {
    process.env.NATIVE_MIN_APP_VERSION_IOS = "   ";
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await call("?platform=ios");

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      platform: "ios",
      minimum_version: null,
      minimum_bundle_created_at: null,
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it.each(["1.0.6-beta", "v1.0.6", "1.0.0.0.1", "1..0", "latest"])(
    "returns a null version for the invalid value %s",
    async (value) => {
      process.env.NATIVE_MIN_APP_VERSION_IOS = value;
      process.env.NATIVE_MIN_BUNDLE_CREATED_AT_IOS = "2026-11-12T00:00:00Z";
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await call("?platform=ios");

      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        platform: "ios",
        minimum_version: null,
        minimum_bundle_created_at: "2026-11-12T00:00:00.000Z",
      });
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    },
  );

  it.each(["not-a-date", "2026", "Nov 12 2026", "2026-11-12T00:00:00", "2026-13-45T00:00:00Z"])(
    "returns a null bundle date for the invalid value %s",
    async (value) => {
      process.env.NATIVE_MIN_APP_VERSION_IOS = "1.0.6";
      process.env.NATIVE_MIN_BUNDLE_CREATED_AT_IOS = value;
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await call("?platform=ios");

      expect(result.body).toEqual({
        platform: "ios",
        minimum_version: "1.0.6",
        minimum_bundle_created_at: null,
      });
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    },
  );

  it.each(["", "?platform=", "?platform=web", "?platform=IOS", "?platform=ios,android"])(
    "returns 400 invalid_platform for %s",
    async (query) => {
      const result = await call(query);

      expect(result.status).toBe(400);
      expect(result.body).toEqual({ error: "invalid_platform" });
    },
  );

  it("sets the public cache header on a 200", async () => {
    const result = await call("?platform=ios");

    expect(result.cache).toBe("public, s-maxage=300, stale-while-revalidate=60");
  });

  it("warns with the var name and never logs the invalid value", async () => {
    const secretLike = "zz-distinctive-bad-value-7731";
    process.env.NATIVE_MIN_APP_VERSION_ANDROID = secretLike;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await call("?platform=android");

    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls[0].map(String).join(" ");
    expect(logged).toContain("NATIVE_MIN_APP_VERSION_ANDROID");
    expect(logged).not.toContain(secretLike);
    warn.mockRestore();
  });
  it("ignores a bundle minimum later than now, with a warning, so a typo cannot block every install", async () => {
    process.env.NATIVE_MIN_APP_VERSION_IOS = "1.0.6";
    process.env.NATIVE_MIN_BUNDLE_CREATED_AT_IOS = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const result = await call("?platform=ios");

    expect(result.body).toEqual({
      platform: "ios",
      minimum_version: "1.0.6",
      minimum_bundle_created_at: null,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].map(String).join(" ")).toContain("NATIVE_MIN_BUNDLE_CREATED_AT_IOS");
    warn.mockRestore();
  });
});
