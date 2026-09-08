/** @jest-environment node */
import { after, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import * as Sentry from "@sentry/nextjs";
import { capturePostHogEvent } from "@/lib/posthog-server";
import { GET } from "@/app/auth/confirm/route";

jest.mock("next/server", () => ({ ...jest.requireActual("next/server"), after: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));
jest.mock("@/lib/posthog-server", () => ({ capturePostHogEvent: jest.fn() }));
jest.mock("@sentry/nextjs", () => ({ withScope: jest.fn(), captureMessage: jest.fn() }));

const exchange = jest.fn();
const verify = jest.fn();
const addEventProcessor = jest.fn();
const cookieGet = jest.fn();
const origin = "https://www.quiversurf.app";
const success = {
  data: { user: { id: "user-1", email: "surfer@example.com" }, session: { access_token: "secret" } },
  error: null,
};

function request(params: Record<string, string | undefined>): NextRequest {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined);
  return new NextRequest(`${origin}/auth/confirm?${new URLSearchParams(entries)}`);
}

function location(response: Response): URL {
  expect(response.status).toBe(307);
  return new URL(response.headers.get("location")!);
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  cookieGet.mockReturnValue(undefined);
  jest.mocked(cookies).mockResolvedValue({ get: cookieGet } as never);
  jest.mocked(Sentry.withScope).mockImplementation((callback: any) => callback({ addEventProcessor }));
  jest.mocked(createServerClient).mockReturnValue({ auth: { exchangeCodeForSession: exchange, verifyOtp: verify } } as never);
  exchange.mockResolvedValue(success);
  verify.mockResolvedValue(success);
});

it.each([
  { code: "pkce-secret" },
  { token_hash: "otp-secret", type: "signup" },
])("establishes the session and preserves destination and cookies for %j", async (params) => {
  const method = params.code ? exchange : verify;
  method.mockImplementation(async () => {
    const config = jest.mocked(createServerClient).mock.calls[0][2] as any;
    expect(config.cookies.getAll()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "verifier" })]));
    config.cookies.setAll([{ name: "session", value: "secret", options: { httpOnly: true, path: "/", sameSite: "lax" } }]);
    return success;
  });
  const req = request({ ...params, next: "/profile?edit=true#settings" });
  req.cookies.set("verifier", "private");
  const response = await GET(req);
  expect(location(response).href).toBe(`${origin}/profile?edit=true#settings`);
  expect(response.cookies.get("session")?.value).toBe("secret");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.cookies.get("auth_callback_completed")?.value).toBe("1");
  expect(response.cookies.get("auth_return_to")?.value).toBe("");
  if (params.code) {
    expect(exchange).toHaveBeenCalledWith("pkce-secret");
    expect(verify).not.toHaveBeenCalled();
  } else {
    expect(verify).toHaveBeenCalledWith({ type: "signup", token_hash: "otp-secret" });
    expect(exchange).not.toHaveBeenCalled();
  }
  expect(Sentry.captureMessage).not.toHaveBeenCalled();
});

it.each([
  { code: "code", next: "/auth/reset" },
  { token_hash: "hash", type: "recovery" },
])("preserves password recovery for %j", async (params) => {
  cookieGet.mockReturnValue({ value: "%2Fprofile" });
  expect(location(await GET(request(params))).pathname).toBe("/auth/reset");
});

it("uses the signup return cookie when next is absent", async () => {
  cookieGet.mockReturnValue({ value: "%2Fmap%3Fbeach%3D1" });
  expect(location(await GET(request({ code: "code" }))).href).toBe(`${origin}/map?beach=1`);
});

it.each([{ code: "code" }, { token_hash: "hash", type: "signup" }])("repairs already-sent links pointing back to signup: %j", async (params) => {
  expect(location(await GET(request({ ...params, next: "/auth/sign-up?redirectTo=/map" }))).href).toBe(`${origin}/`);
});

it.each(["%invalid", "https%3A%2F%2Fevil.example", "%2F%5Cevil.example"])("safely handles a bad return cookie: %s", async (value) => {
  cookieGet.mockReturnValue({ value });
  expect(location(await GET(request({ code: "code" }))).href).toBe(`${origin}/`);
});

it.each([
  {}, { token_hash: "secret" }, { token_hash: "secret", type: "unknown" },
])("rejects missing or invalid credentials before calling Supabase: %j", async (params) => {
  expect(location(await GET(request(params))).searchParams.get("flow")).toBe("confirmation");
  expect(createServerClient).not.toHaveBeenCalled();
});

it("handles provider errors before exchanging credentials", async () => {
  const response = await GET(request({ error: "access_denied", code: "code", next: "/auth/reset" }));
  expect(location(response).searchParams.get("flow")).toBe("recovery");
  expect(exchange).not.toHaveBeenCalled();
});

it.each(["pkce", "otp"])("reports expired/reused %s credentials without secrets", async (format) => {
  (format === "pkce" ? exchange : verify).mockResolvedValue({ data: { session: null }, error: { message: "secret-token private@example.com" } });
  const response = await GET(request(format === "pkce" ? { code: "secret-token" } : { token_hash: "secret-token", type: "signup" }));
  expect(location(response).pathname).toBe("/error");
  expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  expect(Sentry.captureMessage).toHaveBeenCalledWith("auth.confirm: confirmation failed", expect.objectContaining({ tags: expect.objectContaining({ reason: "verification_failed" }) }));
  const processor = addEventProcessor.mock.calls[0][0];
  const event = processor({ request: { url: "secret-token", headers: { cookie: "secret-token" } }, breadcrumbs: [{ message: "secret-token" }], user: { email: "private@example.com" } });
  expect(event.request).toEqual({ url: `${origin}/auth/confirm` });
  expect(event.breadcrumbs).toEqual([]);
  expect(event.user).toBeUndefined();
  const report = jest.mocked(after).mock.calls[0][0] as () => Promise<void>;
  await report();
  expect(capturePostHogEvent).toHaveBeenCalledWith(expect.objectContaining({ event: "auth_failed", properties: expect.objectContaining({ source: "auth_confirm", reason: "verification_failed", $process_person_profile: false }) }));
  expect(JSON.stringify(jest.mocked(capturePostHogEvent).mock.calls)).not.toMatch(/secret-token|private@example/);
});

it("reports thrown failures once and redirects", async () => {
  exchange.mockRejectedValue(new Error("private token"));
  expect(location(await GET(request({ code: "code" }))).pathname).toBe("/error");
  expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
});

it.each([success.data.user, null])("offers sign-in when verification succeeds without a session: %j", async (user) => {
  verify.mockResolvedValue({ data: { user, session: null }, error: null });
  const response = await GET(request({ token_hash: "hash", type: "signup", next: "/map" }));
  const url = location(response);
  expect(url.pathname).toBe("/auth/sign-in");
  expect(url.searchParams.get("just_confirmed")).toBe("1");
  expect(url.searchParams.get("email")).toBe(user?.email ?? null);
  expect(url.searchParams.get("next")).toBe("/map");
  expect(response.cookies.get("auth_return_to")?.value).toBe("");
});

it("does not claim recovery succeeded without a session", async () => {
  exchange.mockResolvedValue({ data: { user: success.data.user, session: null }, error: null });
  const url = location(await GET(request({ code: "code", next: "/auth/reset" })));
  expect(url.pathname).toBe("/error");
  expect(url.searchParams.get("flow")).toBe("recovery");
});

it.each(["error", "throw", "no-session"])("preserves Supabase cookie mutations on %s redirects", async (outcome) => {
  exchange.mockImplementation(async () => {
    const config = jest.mocked(createServerClient).mock.calls[0][2] as any;
    config.cookies.setAll([{ name: "stale-session", value: "", options: { maxAge: 0, path: "/", httpOnly: true } }]);
    if (outcome === "throw") throw new Error("exchange failed");
    return { data: { user: success.data.user, session: null }, error: outcome === "error" ? new Error("expired") : null };
  });
  const response = await GET(request({ code: "code" }));
  expect(location(response).pathname).toBe(outcome === "no-session" ? "/auth/sign-in" : "/error");
  expect(response.cookies.get("stale-session")).toEqual(expect.objectContaining({ value: "", maxAge: 0, httpOnly: true }));
  expect(response.cookies.get("auth_return_to")?.value).toBe("");
  expect(response.cookies.get("auth_callback_completed")).toBeUndefined();
});
