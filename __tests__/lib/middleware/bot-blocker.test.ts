jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { withBotBlocking } from "@/lib/middleware/bot-blocker";

function makeRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: new Headers(headers),
    nextUrl: {
      pathname: "/api/test",
      searchParams: new URLSearchParams(),
    },
  } as unknown as NextRequest;
}

describe("withBotBlocking", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns 403 with default security headers for blocked bots", async () => {
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
    const wrapped = withBotBlocking(handler);

    const response = await wrapped(
      makeRequest({
        "user-agent": "curl/8.0.0",
        "accept-language": "en-US,en;q=0.9",
        "x-forwarded-for": "203.0.113.42",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      success: false,
      error: "Access denied",
    });
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls the wrapped handler once for allowed requests", async () => {
    const handlerResponse = NextResponse.json({ success: true, data: { ok: true } });
    const handler = jest.fn().mockResolvedValue(handlerResponse);
    const wrapped = withBotBlocking(handler);
    const request = makeRequest({
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    });

    const response = await wrapped(request);

    expect(response).toBe(handlerResponse);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(request, undefined);
  });

  it("allows native Android okhttp requests with a platform header", async () => {
    const handlerResponse = NextResponse.json({ success: true });
    const handler = jest.fn().mockResolvedValue(handlerResponse);
    const wrapped = withBotBlocking(handler);
    const request = makeRequest({
      "user-agent": "okhttp/4.12.0",
      "accept-language": "en-US,en;q=0.9",
      "x-quiver-platform": "android",
    });

    const response = await wrapped(request);

    expect(response).toBe(handlerResponse);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(request, undefined);
  });

  it("allows native iOS okhttp requests with a platform header", async () => {
    const handlerResponse = NextResponse.json({ success: true });
    const handler = jest.fn().mockResolvedValue(handlerResponse);
    const wrapped = withBotBlocking(handler);
    const request = makeRequest({
      "user-agent": "okhttp/4.12.0",
      "accept-language": "en-US,en;q=0.9",
      "x-quiver-platform": "ios",
    });

    expect(await wrapped(request)).toBe(handlerResponse);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("blocks a bare short okhttp request", async () => {
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
    const wrapped = withBotBlocking(handler);

    const response = await wrapped(
      makeRequest({
        "user-agent": "okhttp/4.12.0",
        "accept-language": "en-US,en;q=0.9",
      })
    );

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[BOT_BLOCKED]",
      expect.objectContaining({ reason: "empty-or-short-ua" })
    );
  });

  it.each([
    [{ "x-quiver-platform": "web", "accept-language": "en-US" }, "empty-or-short-ua"],
    [{ "x-quiver-platform": "android" }, "missing-accept-language"],
  ])("keeps blocking other short okhttp requests (%s)", async (headers, reason) => {
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ success: true }));
    const wrapped = withBotBlocking(handler);

    const response = await wrapped(makeRequest({ "user-agent": "okhttp/4.12.0", ...headers }));

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "[BOT_BLOCKED]",
      expect.objectContaining({ reason })
    );
  });
});

describe("bot-blocker source guard", () => {
  it("uses response-utils for default security headers", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/middleware/bot-blocker.ts"),
      "utf8"
    );

    expect(source).not.toContain("@/lib/api-utils");
    expect(source).toContain("@/lib/middleware/api-wrappers/response-utils");
    expect(source).not.toContain('from "@/lib/middleware/api-wrappers"');
  });
});
