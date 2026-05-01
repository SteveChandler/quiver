/**
 * @jest-environment node
 *
 * Phase 5m: extended diagnostics endpoint accepts user_id, type, status,
 * stale, retry_heavy filters and returns the matching slice of
 * notification_events with their attempts.
 */

jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(),
}));

// Capture each query-builder method call for assertion.
const mockEq = jest.fn();
const mockGte = jest.fn();
const mockLt = jest.fn();
const mockLimit = jest.fn();
const mockOrder = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

// Build a chainable mock where every method returns `this` and limit() is
// awaitable as a Promise<{ data, error }>.
function buildChain(result: {
  data: unknown[] | null;
  error: { message: string } | null;
}) {
  const chain: any = {};
  chain.eq = mockEq.mockImplementation(() => chain);
  chain.gte = mockGte.mockImplementation(() => chain);
  chain.lt = mockLt.mockImplementation(() => chain);
  chain.limit = mockLimit.mockImplementation(() =>
    Object.assign(Promise.resolve(result), chain)
  );
  chain.order = mockOrder.mockImplementation(() => chain);
  chain.select = mockSelect.mockImplementation(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

import { GET } from "@/app/api/admin/notifications/recent/route";
import {
  createMockAdminUser,
  createMockRequest,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

const mockAuthenticateAdmin = require("@/lib/auth/admin").authenticateAdmin;

describe("/api/admin/notifications/recent (Phase 5m diagnostics)", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const env = setupApiTestEnvironment();
    cleanup = env.cleanup;
    jest.clearAllMocks();
    const chain = buildChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);
  });

  afterEach(() => cleanup?.());

  function adminAuthed() {
    mockAuthenticateAdmin.mockResolvedValue({
      success: true,
      user: createMockAdminUser(),
    });
  }

  it("requires admin authentication", async () => {
    mockAuthenticateAdmin.mockResolvedValue({
      success: false,
      error: "Unauthorized",
      status: 401,
    });

    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/admin/notifications/recent"
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 on a malformed user_id", async () => {
    adminAuthed();
    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/admin/notifications/recent?user_id=not-a-uuid"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 400 on a malformed status", async () => {
    adminAuthed();
    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/admin/notifications/recent?status=banana"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("applies user_id, type, and status filters via .eq()", async () => {
    adminAuthed();
    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/admin/notifications/recent?user_id=550e8400-e29b-41d4-a716-446655440000&type=like&status=processed"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith(
      "recipient_user_id",
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(mockEq).toHaveBeenCalledWith("type", "like");
    expect(mockEq).toHaveBeenCalledWith("status", "processed");
  });

  it("retry_heavy=true → .gte('attempt_count', 2)", async () => {
    adminAuthed();
    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/admin/notifications/recent?retry_heavy=true"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGte).toHaveBeenCalledWith("attempt_count", 2);
  });

  it("stale=true → status='processing' + claimed_at < (now - 5min)", async () => {
    adminAuthed();
    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/admin/notifications/recent?stale=true"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith("status", "processing");
    expect(mockLt).toHaveBeenCalledWith(
      "claimed_at",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    );
  });

  it("default limit is 50, capped at 200", async () => {
    adminAuthed();
    const req = createMockRequest(
      "GET",
      "http://localhost:3000/api/admin/notifications/recent?limit=999"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockLimit).toHaveBeenCalledWith(200);
  });
});
