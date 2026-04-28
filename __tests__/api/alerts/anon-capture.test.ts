/** @jest-environment node */

// NextResponse.json relies on the static Response.json() helper (available in newer runtimes).
// Jest's jsdom environment may not provide it, so we polyfill it for route handler tests.
if (typeof (globalThis as any).Response?.json !== "function") {
  (globalThis as any).Response.json = (data: any, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
}

/**
 * Unit tests for POST /api/alerts/anon-capture (Task 17).
 *
 * Strategy: mocked Supabase via per-table chain factory + auth.signInWithOtp
 * mock. Mirrors the chain-mock pattern from
 * `__tests__/api/cron/condition-alert-deliver.test.ts`. Per the plan
 * amendment (2026-04-26), we don't depend on a live local DB.
 *
 * Cases covered:
 * 1. Happy path — valid input, OTP succeeds, pending row inserted, submit
 *    event recorded.
 * 2. OTP failure — pending row deleted (since we inserted it), no
 *    user_events row, returns otp_send_failed.
 * 3. Honeypot tripped — silent 200 success, no inserts, no OTP call.
 * 4. Invalid email — returns invalid_email, no inserts, no OTP call.
 * 5. Idempotency — second POST reuses existing unconsumed pending row;
 *    only one insert across two POSTs; OTP fires both times.
 */

// ---- Mock middleware as pass-throughs so rate-limiting doesn't fire ----
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withErrorHandler: (handler: any) => handler,
  withRateLimit: (handler: any) => handler,
}));

// ---- Mock validator (use real implementation; just need its export) ----
// (validator is pure — no need to mock)

// ---- Mock Supabase via per-table store ----
type PendingRow = {
  id: string;
  email: string;
  beach_id: string;
  preset_type: string;
  return_path: string;
  consumed_at: string | null;
  expires_at: string; // ISO
};
type EventRow = {
  event_type: string;
  user_id: string | null;
  session_id: string;
  metadata: Record<string, unknown>;
};

interface MockStore {
  beaches: { id: string }[];
  pendingRows: PendingRow[];
  eventRows: EventRow[];
  insertCount: number;
  deleteCount: number;
  otpCalls: { email: string; emailRedirectTo: string }[];
}

const store: MockStore = {
  beaches: [],
  pendingRows: [],
  eventRows: [],
  insertCount: 0,
  deleteCount: 0,
  otpCalls: [],
};

let nextOtpResult: { error: any } = { error: null };

let nextPendingId = 1;
function genPendingId(): string {
  // Stable test UUIDs
  const n = nextPendingId++;
  return `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

function makeChain(rowsResolver: () => any[]) {
  const chain: any = {
    _filters: {} as Record<string, any>,
    select: jest.fn(() => chain),
    eq: jest.fn((col: string, val: any) => {
      chain._filters[col] = val;
      return chain;
    }),
    is: jest.fn((col: string, val: any) => {
      chain._filters[`${col}__is`] = val;
      return chain;
    }),
    gt: jest.fn((col: string, val: any) => {
      chain._filters[`${col}__gt`] = val;
      return chain;
    }),
    lt: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lte: jest.fn(() => chain),
    in: jest.fn(() => chain),
    not: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() =>
      Promise.resolve({ data: rowsResolver()[0] ?? null, error: null })
    ),
    maybeSingle: jest.fn(() =>
      Promise.resolve({ data: rowsResolver()[0] ?? null, error: null })
    ),
    then: jest.fn((resolve: any) =>
      resolve({ data: rowsResolver(), error: null })
    ),
  };
  return chain;
}

function mockFrom(table: string) {
  if (table === "beaches") {
    const chain: any = makeChain(() => {
      const f = chain._filters;
      return store.beaches.filter((b) => f.id == null || b.id === f.id);
    });
    return chain;
  }
  if (table === "pending_alert_captures") {
    const chain: any = makeChain(() => {
      const f = chain._filters;
      const now = new Date().toISOString();
      return store.pendingRows.filter((r) => {
        if (f.email != null && r.email !== f.email) return false;
        if (f.beach_id != null && r.beach_id !== f.beach_id) return false;
        if (f.preset_type != null && r.preset_type !== f.preset_type)
          return false;
        if (f.consumed_at__is === null && r.consumed_at !== null) return false;
        if (f.expires_at__gt != null && r.expires_at <= (f.expires_at__gt ?? now))
          return false;
        if (f.id != null && r.id !== f.id) return false;
        return true;
      });
    });
    chain.insert = jest.fn((row: Partial<PendingRow>) => {
      store.insertCount += 1;
      const inserted: PendingRow = {
        id: genPendingId(),
        email: row.email!,
        beach_id: row.beach_id!,
        preset_type: row.preset_type!,
        return_path: row.return_path ?? "",
        consumed_at: null,
        // Default 24h expiry — long enough for tests.
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      store.pendingRows.push(inserted);
      return {
        select: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({ data: { id: inserted.id }, error: null })
          ),
        })),
      };
    });
    chain.delete = jest.fn(() => ({
      eq: jest.fn((col: string, val: any) => {
        const before = store.pendingRows.length;
        store.pendingRows = store.pendingRows.filter(
          (r) => !(col === "id" && r.id === val)
        );
        store.deleteCount += before - store.pendingRows.length;
        return Promise.resolve({ error: null });
      }),
    }));
    return chain;
  }
  if (table === "user_events") {
    const chain: any = makeChain(() => store.eventRows);
    chain.insert = jest.fn((row: EventRow) => {
      store.eventRows.push(row);
      return Promise.resolve({ error: null });
    });
    return chain;
  }
  return makeChain(() => []);
}

const mockSupabase = {
  from: jest.fn(mockFrom),
  auth: {
    signInWithOtp: jest.fn(async (args: any) => {
      store.otpCalls.push({
        email: args.email,
        emailRedirectTo: args.options?.emailRedirectTo ?? "",
      });
      return { data: {}, error: nextOtpResult.error };
    }),
  },
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// Import AFTER mocks are set up.
import { POST } from "@/app/api/alerts/anon-capture/route";

// ---- Test helpers ----
const BEACH_ID = "11111111-1111-1111-1111-111111111111";
const EMAIL = "tester@example.com";
const PRESET = "glass_off";
const RETURN_PATH = "/ca/san-diego/blacks-beach";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("https://quiversurf.app/api/alerts/anon-capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    email: EMAIL,
    beach_id: BEACH_ID,
    preset_type: PRESET,
    return_path: RETURN_PATH,
    website: "",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  store.beaches = [{ id: BEACH_ID }];
  store.pendingRows = [];
  store.eventRows = [];
  store.insertCount = 0;
  store.deleteCount = 0;
  store.otpCalls = [];
  nextOtpResult = { error: null };
  nextPendingId = 1;
});

describe("POST /api/alerts/anon-capture", () => {
  it("happy path — inserts pending row, sends OTP, fires submit event", async () => {
    const res = await POST(makeRequest(validBody()) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });

    expect(store.pendingRows).toHaveLength(1);
    expect(store.pendingRows[0]).toMatchObject({
      email: EMAIL,
      beach_id: BEACH_ID,
      preset_type: PRESET,
      return_path: RETURN_PATH,
    });
    expect(store.insertCount).toBe(1);
    expect(store.deleteCount).toBe(0);

    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(store.otpCalls[0].email).toBe(EMAIL);
    expect(store.otpCalls[0].emailRedirectTo).toBe(
      `https://quiversurf.app/auth/callback?redirect=${encodeURIComponent(RETURN_PATH)}`
    );

    expect(store.eventRows).toHaveLength(1);
    expect(store.eventRows[0]).toMatchObject({
      event_type: "anon_alert_capture_submit",
      user_id: null,
      metadata: {
        beach_id: BEACH_ID,
        preset_type: PRESET,
        return_path: RETURN_PATH,
      },
    });
  });

  it("OTP failure — deletes the just-inserted pending row and returns otp_send_failed", async () => {
    nextOtpResult = { error: new Error("rate-limited") };

    const res = await POST(makeRequest(validBody()) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "otp_send_failed" });

    expect(store.insertCount).toBe(1);
    expect(store.deleteCount).toBe(1);
    expect(store.pendingRows).toHaveLength(0);

    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(store.eventRows).toHaveLength(0);
  });

  it("honeypot tripped — silent 200 success, no inserts, no OTP call", async () => {
    const res = await POST(
      makeRequest(validBody({ website: "https://spam.com" })) as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });

    expect(store.insertCount).toBe(0);
    expect(store.pendingRows).toHaveLength(0);
    expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(store.eventRows).toHaveLength(0);
  });

  it("invalid email — returns invalid_email, no inserts, no OTP call", async () => {
    const res = await POST(
      makeRequest(validBody({ email: "not-an-email" })) as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "invalid_email" });

    expect(store.insertCount).toBe(0);
    expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(store.eventRows).toHaveLength(0);
  });

  it("idempotency — second POST with same (email, beach, preset) reuses pending row", async () => {
    const res1 = await POST(makeRequest(validBody()) as any);
    expect(res1.status).toBe(200);
    expect((await res1.json())).toEqual({ success: true });

    const res2 = await POST(makeRequest(validBody()) as any);
    expect(res2.status).toBe(200);
    expect((await res2.json())).toEqual({ success: true });

    // One pending row total — second call reused the first.
    expect(store.pendingRows).toHaveLength(1);
    expect(store.insertCount).toBe(1);
    expect(store.deleteCount).toBe(0);

    // Both calls still fired a fresh OTP magic link.
    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledTimes(2);

    // Both calls still produce one server-side submit event each.
    expect(store.eventRows).toHaveLength(2);
  });
});
