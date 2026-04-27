/** @jest-environment node */

/**
 * Mocked-Supabase tests for /auth/callback's anon alert capture finalization
 * (Task 18). The callback creates its supabase client via
 * createServerClient from @supabase/ssr — we mock that to return a chain-mock
 * client with a stubbed `auth.exchangeCodeForSession`, `auth.getUser`,
 * `from()`, and `rpc()`.
 *
 * Per the plan amendment (2026-04-26 mocked-Supabase pivot), local supabase
 * db reset is broken on this branch by pre-existing migration-history defects.
 * The SQL behavior of `finalize_anon_alert_capture` itself is covered by the
 * SKIPPED `__tests__/api/sql/finalize-anon-alert-capture.test.ts`. This file
 * treats the RPC as a black box returning canned rows.
 *
 * Cases covered:
 *   1. Single pending capture → success+magic_link events fire, redirect
 *      uses capture's return_path with ?welcome=alert_capture&count=1.
 *   2. Multiple pending captures → events carry all beach_ids, redirect
 *      uses captures[0].return_path with count=2.
 *   3. No pending captures → no anon_alert_* events, redirect falls back to
 *      onboarding-required (the existing callback behavior for unactivated
 *      users with no captures).
 *   4. Explicit ?redirect= param wins over capture's return_path → URL
 *      param redirect target gets the welcome params; capture's return_path
 *      is ignored.
 *
 * NOT covered here (enforced by the SQL RPC itself, see skipped SQL test):
 *   - Capture for a different email is not consumed (the RPC filters by
 *     `email = lower(p_email)` server-side; we can't observe that with mocks).
 */

// ---- Mocks declared BEFORE importing the route ----

// next/headers cookies is touched by the supabase ssr client setup path.
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    getAll: jest.fn(() => []),
  })),
}));

// Stub email-token verify so the invite-cookie path is a no-op (no cookie
// is set in tests anyway).
jest.mock("@/lib/utils/email-token", () => ({
  verifyEmailToken: jest.fn(async () => null),
  getEmailTokenSecret: jest.fn(() => "test-secret"),
}));

// ---- Mock store ----
type RpcCaptureRow = {
  capture_id: string;
  beach_id: string;
  preset_type: string;
  return_path: string;
  captured_at: string;
};

type EventRow = {
  event_type: string;
  user_id: string | null;
  session_id: string;
  metadata: Record<string, unknown>;
};

interface MockState {
  user: { id: string; email: string } | null;
  profile: { home_beach_id: string | null; onboarding_completed_at: string | null } | null;
  rpcResponse: { data: RpcCaptureRow[] | null; error: unknown };
  rpcCalls: Array<{ name: string; args: unknown }>;
  eventInserts: EventRow[];
  exchangeCodeError: unknown;
}

const state: MockState = {
  user: null,
  profile: null,
  rpcResponse: { data: [], error: null },
  rpcCalls: [],
  eventInserts: [],
  exchangeCodeError: null,
};

const mockSupabaseClient = {
  auth: {
    exchangeCodeForSession: jest.fn(async (_code: string) => ({
      error: state.exchangeCodeError,
    })),
    getUser: jest.fn(async () => ({
      data: { user: state.user },
      error: null,
    })),
  },
  rpc: jest.fn(async (name: string, args: unknown) => {
    state.rpcCalls.push({ name, args });
    return state.rpcResponse;
  }),
  from: jest.fn((table: string) => {
    if (table === "profiles") {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => ({ data: state.profile, error: null })),
      };
      return chain;
    }
    if (table === "user_events") {
      return {
        insert: jest.fn(async (row: EventRow) => {
          state.eventInserts.push(row);
          return { error: null };
        }),
      };
    }
    if (table === "user_follows") {
      return {
        insert: jest.fn(async () => ({ error: null })),
      };
    }
    // Default no-op chain.
    const chain: any = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      insert: jest.fn(async () => ({ error: null })),
    };
    return chain;
  }),
};

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}));

// ---- Imports AFTER mocks ----
import { GET } from "@/app/auth/callback/route";

// Stable required env for createServerClient call.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

// ---- Helpers ----
const USER_ID = "44444444-4444-4444-4444-444444444444";
const USER_EMAIL = "tester@example.com";
const BEACH_ID_1 = "11111111-1111-1111-1111-111111111111";
const BEACH_ID_2 = "22222222-2222-2222-2222-222222222222";
const RETURN_PATH_1 = "/ca/san-diego/blacks-beach";
const RETURN_PATH_2 = "/ca/san-diego/scripps";

function makeRequest(qs: string): any {
  const url = `https://quiversurf.app/auth/callback${qs}`;
  // Build a NextRequest-shaped object minimally sufficient for the route.
  const cookies = {
    getAll: () => [],
    get: () => undefined,
    set: () => {},
  };
  return {
    url,
    cookies,
  };
}

function captureRow(
  overrides: Partial<RpcCaptureRow> = {},
): RpcCaptureRow {
  return {
    capture_id: "00000000-0000-0000-0000-000000000001",
    beach_id: BEACH_ID_1,
    preset_type: "glass_off",
    return_path: RETURN_PATH_1,
    captured_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  state.user = { id: USER_ID, email: USER_EMAIL };
  // Default profile: unactivated (no home_beach_id, no onboarding completion).
  // The RPC sets home_beach_id server-side for capture flows; the mocked
  // profile read still returns the pre-RPC view, but the capture-redirect
  // branch bypasses the onboarding-required append.
  state.profile = { home_beach_id: null, onboarding_completed_at: null };
  state.rpcResponse = { data: [], error: null };
  state.rpcCalls = [];
  state.eventInserts = [];
  state.exchangeCodeError = null;
});

describe("/auth/callback — anon alert capture finalization", () => {
  it("single pending capture → fires both events and redirects to return_path with welcome params", async () => {
    state.rpcResponse = {
      data: [captureRow()],
      error: null,
    };

    const res = await GET(makeRequest("?code=abc"));

    // RPC called with normalized email.
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0]).toEqual({
      name: "finalize_anon_alert_capture",
      args: { p_user_id: USER_ID, p_email: USER_EMAIL.toLowerCase() },
    });

    // Two events: success then magic_link_clicked.
    const successEvents = state.eventInserts.filter(
      (e) => e.event_type === "anon_alert_signup_success",
    );
    expect(successEvents).toHaveLength(1);
    expect(successEvents[0]).toMatchObject({
      event_type: "anon_alert_signup_success",
      user_id: USER_ID,
      metadata: { capture_count: 1, beach_ids: [BEACH_ID_1] },
    });

    const clickEvents = state.eventInserts.filter(
      (e) => e.event_type === "anon_alert_magic_link_clicked",
    );
    expect(clickEvents).toHaveLength(1);
    expect(clickEvents[0]).toMatchObject({
      event_type: "anon_alert_magic_link_clicked",
      user_id: USER_ID,
      metadata: { beach_id: BEACH_ID_1, preset_type: "glass_off" },
    });

    // Redirect to capture's return_path + welcome params.
    expect(res.status).toBe(307);
    const location = res.headers.get("location")!;
    const parsed = new URL(location);
    expect(parsed.pathname).toBe(RETURN_PATH_1);
    expect(parsed.searchParams.get("welcome")).toBe("alert_capture");
    expect(parsed.searchParams.get("count")).toBe("1");
    // Onboarding-required should NOT appear — the capture branch overrides it.
    expect(parsed.searchParams.get("onboarding")).toBeNull();
  });

  it("multiple pending captures → events carry all beach_ids, redirect uses first capture's return_path", async () => {
    state.rpcResponse = {
      data: [
        captureRow({
          capture_id: "00000000-0000-0000-0000-000000000001",
          beach_id: BEACH_ID_1,
          preset_type: "glass_off",
          return_path: RETURN_PATH_1,
        }),
        captureRow({
          capture_id: "00000000-0000-0000-0000-000000000002",
          beach_id: BEACH_ID_2,
          preset_type: "big_day",
          return_path: RETURN_PATH_2,
        }),
      ],
      error: null,
    };

    const res = await GET(makeRequest("?code=abc"));

    const successEvents = state.eventInserts.filter(
      (e) => e.event_type === "anon_alert_signup_success",
    );
    expect(successEvents).toHaveLength(1);
    expect(successEvents[0].metadata).toEqual({
      capture_count: 2,
      beach_ids: [BEACH_ID_1, BEACH_ID_2],
    });

    const clickEvents = state.eventInserts.filter(
      (e) => e.event_type === "anon_alert_magic_link_clicked",
    );
    expect(clickEvents).toHaveLength(1);
    expect(clickEvents[0].metadata).toEqual({
      beach_id: BEACH_ID_1,
      preset_type: "glass_off",
    });

    expect(res.status).toBe(307);
    const parsed = new URL(res.headers.get("location")!);
    expect(parsed.pathname).toBe(RETURN_PATH_1);
    expect(parsed.searchParams.get("welcome")).toBe("alert_capture");
    expect(parsed.searchParams.get("count")).toBe("2");
  });

  it("no pending captures → no anon_alert_* events, falls through to existing onboarding redirect", async () => {
    state.rpcResponse = { data: [], error: null };

    const res = await GET(makeRequest("?code=abc"));

    // RPC was still called (cheap to call, idempotent).
    expect(state.rpcCalls).toHaveLength(1);

    // No anon_alert_* events recorded.
    const anonEvents = state.eventInserts.filter((e) =>
      e.event_type.startsWith("anon_alert_"),
    );
    expect(anonEvents).toHaveLength(0);

    // Profile is unactivated, so existing onboarding-gate logic appends
    // ?onboarding=required to the redirect target.
    expect(res.status).toBe(307);
    const parsed = new URL(res.headers.get("location")!);
    expect(parsed.searchParams.get("onboarding")).toBe("required");
    expect(parsed.searchParams.get("welcome")).toBeNull();
    expect(parsed.searchParams.get("count")).toBeNull();
  });

  it("explicit ?redirect= param wins over capture's return_path", async () => {
    state.rpcResponse = {
      data: [captureRow({ return_path: "/some/other/path" })],
      error: null,
    };

    const res = await GET(
      makeRequest(`?code=abc&redirect=${encodeURIComponent("/explicit")}`),
    );

    // Capture finalized + events still fire.
    const successEvents = state.eventInserts.filter(
      (e) => e.event_type === "anon_alert_signup_success",
    );
    expect(successEvents).toHaveLength(1);
    expect(successEvents[0].metadata).toMatchObject({ capture_count: 1 });

    // Redirect goes to /explicit, NOT to the capture's return_path.
    expect(res.status).toBe(307);
    const parsed = new URL(res.headers.get("location")!);
    expect(parsed.pathname).toBe("/explicit");
    expect(parsed.searchParams.get("welcome")).toBe("alert_capture");
    expect(parsed.searchParams.get("count")).toBe("1");
  });
});
