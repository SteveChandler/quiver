/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { signEmailToken } from "@/lib/utils/email-token";
import { GET } from "@/app/invite/start/route";

const ORIGIN = "http://localhost:3000";
const TEST_SECRET = "test-secret-key-that-is-at-least-32-characters-long";

function buildRequest(token?: string): NextRequest {
  const url = new URL("/invite/start", ORIGIN);
  if (token !== undefined) {
    url.searchParams.set("token", token);
  }
  return new NextRequest(url);
}

function getRedirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  if (!location) throw new Error("No Location header on redirect response");
  return new URL(location);
}

describe("GET /invite/start", () => {
  beforeEach(() => {
    process.env.EMAIL_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET;
  });

  it("sets invite_token and redirects valid invite links to signup consume flow", async () => {
    const token = await signEmailToken(
      { user_id: "inviter-id", purpose: "invite" },
      TEST_SECRET,
    );

    const response = await GET(buildRequest(token));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/auth/sign-up");
    expect(location.searchParams.get("redirectTo")).toBe("/invite/consume");
    expect(location.searchParams.has("invite_token")).toBe(false);

    const setCookie = response.headers.get("set-cookie") || "";
    expect(setCookie).toContain("invite_token=");
    expect(setCookie).toContain(token);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//i);
  });

  it("redirects safely and clears stale invite cookies when token is missing", async () => {
    const response = await GET(buildRequest());

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("invite_expired")).toBe("1");

    const setCookie = response.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/invite_token=/);
    expect(setCookie.toLowerCase()).toMatch(
      /max-age=0|expires=thu, 01 jan 1970/,
    );
  });

  it("redirects safely and clears stale invite cookies when token is invalid", async () => {
    const response = await GET(buildRequest("not-a-valid-token"));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("invite_expired")).toBe("1");

    const setCookie = response.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/invite_token=/);
    expect(setCookie.toLowerCase()).toMatch(
      /max-age=0|expires=thu, 01 jan 1970/,
    );
  });

  it("rejects tokens with the wrong purpose", async () => {
    const token = await signEmailToken(
      { user_id: "inviter-id", purpose: "prefs" },
      TEST_SECRET,
    );

    const response = await GET(buildRequest(token));

    const location = getRedirectLocation(response);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("invite_expired")).toBe("1");
  });
});
