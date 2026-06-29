/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/gamification/award/route";
import { createBearerTokenClient } from "@/lib/supabase/bearer-client";
import {
  fetchUserXPStatus,
  getCurrentXP,
  getXPForAction,
  incrementUserXP,
  initializeUserXP,
  logXPEvent,
  updateUserXP,
} from "@/lib/gamification/xp-service";
import { calculateLevel } from "@/lib/gamification/level-service";
import { evaluateBadgeUnlocks } from "@/lib/gamification/badge-service";
import { invalidateUserCaches } from "@/lib/gamification/cache";

const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const bearerToken = "native-token";

type MockSupabase = {
  auth: {
    getUser: jest.Mock;
  };
  from: jest.Mock;
};

let mockSupabase: MockSupabase;
let sessionMaybeSingle: jest.Mock;
let xpEventMaybeSingle: jest.Mock;
let sessionEq: jest.Mock;
let xpEventEq: jest.Mock;

type SelectChain = {
  select: jest.Mock;
  eq: jest.Mock;
  maybeSingle: jest.Mock;
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabase),
}));

jest.mock("@/lib/supabase/bearer-client", () => ({
  createBearerTokenClient: jest.fn(() => mockSupabase),
}));

jest.mock("@/lib/gamification/xp-service", () => ({
  fetchUserXPStatus: jest.fn(),
  getCurrentXP: jest.fn(),
  getXPForAction: jest.fn(),
  incrementUserXP: jest.fn(),
  initializeUserXP: jest.fn(),
  logXPEvent: jest.fn(),
  updateUserXP: jest.fn(),
}));

jest.mock("@/lib/gamification/level-service", () => ({
  calculateLevel: jest.fn(),
}));

jest.mock("@/lib/gamification/badge-service", () => ({
  evaluateBadgeUnlocks: jest.fn(),
}));

jest.mock("@/lib/gamification/cache", () => ({
  invalidateUserCaches: jest.fn(),
}));

function makeSelectChain(maybeSingle: jest.Mock, eq: jest.Mock): SelectChain {
  const chain: SelectChain = {
    select: jest.fn(),
    eq,
    maybeSingle,
  };
  chain.select.mockReturnValue(chain);
  eq.mockReturnValue(chain);
  return chain;
}

function setupSupabase(options: {
  sessionRow?: { id: string } | null;
  existingEvent?: { id: string } | null;
} = {}): void {
  sessionMaybeSingle = jest.fn().mockResolvedValue({
    data: "sessionRow" in options ? options.sessionRow : { id: sessionId },
    error: null,
  });
  xpEventMaybeSingle = jest.fn().mockResolvedValue({
    data: options.existingEvent ?? null,
    error: null,
  });
  sessionEq = jest.fn();
  xpEventEq = jest.fn();

  const sessionChain = makeSelectChain(sessionMaybeSingle, sessionEq);
  const xpEventChain = makeSelectChain(xpEventMaybeSingle, xpEventEq);

  mockSupabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      if (table === "sessions") return sessionChain;
      if (table === "xp_events") return xpEventChain;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function requestWithBody(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/gamification/award", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function validBody(): Record<string, string> {
  return {
    action: "log_session",
    related_entity_id: sessionId,
    related_entity_type: "session",
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  setupSupabase();
  (getXPForAction as jest.Mock).mockReturnValue(50);
  (initializeUserXP as jest.Mock).mockResolvedValue(undefined);
  (getCurrentXP as jest.Mock).mockResolvedValue({
    xp_total: 50,
    level: 1,
  });
  (incrementUserXP as jest.Mock).mockResolvedValue({
    xp_total: 100,
    level: 2,
    awarded: 50,
  });
  (calculateLevel as jest.Mock).mockReturnValue({
    level: 2,
    title: "Grom",
  });
  (updateUserXP as jest.Mock).mockResolvedValue(undefined);
  (logXPEvent as jest.Mock).mockResolvedValue(undefined);
  (evaluateBadgeUnlocks as jest.Mock).mockResolvedValue([
    {
      badge_slug: "first_ride",
      name: "First Ride",
      icon: "Waves",
      xp_reward: 50,
    },
  ]);
  (fetchUserXPStatus as jest.Mock).mockResolvedValue({
    xp_total: 100,
    level: 2,
    created_at: "2026-06-21T00:00:00.000Z",
    updated_at: "2026-06-21T00:00:00.000Z",
    level_title: "Grom",
    progress_to_next: 25,
    xp_to_next_level: 200,
    next_level_title: "Paddler",
  });
});

describe("POST /api/gamification/award", () => {
  it("awards XP for an owned native session", async () => {
    const response = await POST(requestWithBody(validBody()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      awarded: true,
      result: {
        xp_gained: 50,
        total_xp: 100,
        previous_level: 1,
        new_level: 2,
        level_up: true,
        level_title: "Grom",
      },
    });
    expect(createBearerTokenClient).toHaveBeenCalledWith(bearerToken);
    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith(bearerToken);
    expect(sessionEq).toHaveBeenCalledWith("id", sessionId);
    expect(sessionEq).toHaveBeenCalledWith("user_id", userId);
    expect(getXPForAction).toHaveBeenCalledWith("log_session");
    expect(incrementUserXP).toHaveBeenCalledWith(
      userId,
      50,
      "log_session",
      sessionId,
      `log_session:${sessionId}`,
      mockSupabase,
    );
    expect(updateUserXP).not.toHaveBeenCalled();
    expect(logXPEvent).not.toHaveBeenCalled();
    expect(invalidateUserCaches).toHaveBeenCalledWith(userId);
  });

  it("returns an idempotent response when the session already has an XP event", async () => {
    setupSupabase({ existingEvent: { id: "xp-event-1" } });

    const response = await POST(requestWithBody(validBody()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      awarded: false,
      reason: "already_awarded",
      xp: {
        xp_total: 100,
        level: 2,
      },
    });
    expect(xpEventEq).toHaveBeenCalledWith("user_id", userId);
    expect(xpEventEq).toHaveBeenCalledWith("action", "log_session");
    expect(xpEventEq).toHaveBeenCalledWith("related_entity_id", sessionId);
    expect(fetchUserXPStatus).toHaveBeenCalledWith(userId, mockSupabase);
    expect(incrementUserXP).not.toHaveBeenCalled();
    expect(logXPEvent).not.toHaveBeenCalled();
    expect(updateUserXP).not.toHaveBeenCalled();
  });

  it("returns an idempotent response when the XP RPC reports a replayed award", async () => {
    (incrementUserXP as jest.Mock).mockResolvedValue({
      xp_total: 100,
      level: 2,
      awarded: 0,
    });

    const response = await POST(requestWithBody(validBody()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      awarded: false,
      reason: "already_awarded",
      xp: {
        xp_total: 100,
        level: 2,
      },
    });
    expect(incrementUserXP).toHaveBeenCalledWith(
      userId,
      50,
      "log_session",
      sessionId,
      `log_session:${sessionId}`,
      mockSupabase,
    );
    expect(fetchUserXPStatus).toHaveBeenCalledWith(userId, mockSupabase);
    expect(evaluateBadgeUnlocks).not.toHaveBeenCalled();
    expect(invalidateUserCaches).not.toHaveBeenCalled();
    expect(updateUserXP).not.toHaveBeenCalled();
    expect(logXPEvent).not.toHaveBeenCalled();
  });

  it("returns 404 and skips XP writes when the session is not owned by the user", async () => {
    setupSupabase({ sessionRow: null });

    const response = await POST(requestWithBody(validBody()));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Session not found");
    expect(getXPForAction).not.toHaveBeenCalled();
    expect(incrementUserXP).not.toHaveBeenCalled();
    expect(updateUserXP).not.toHaveBeenCalled();
    expect(logXPEvent).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid payload before touching session or XP tables", async () => {
    const response = await POST(
      requestWithBody({
        action: "add_board",
        related_entity_id: "not-a-uuid",
        related_entity_type: "board",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid payload");
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(getXPForAction).not.toHaveBeenCalled();
  });

  it("rejects retired make_call XP awards before touching tables", async () => {
    const response = await POST(
      requestWithBody({
        action: "make_call",
        related_entity_id: "33333333-3333-4333-8333-333333333333",
        related_entity_type: "daily_call",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid payload");
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(getXPForAction).not.toHaveBeenCalled();
    expect(incrementUserXP).not.toHaveBeenCalled();
    expect(updateUserXP).not.toHaveBeenCalled();
    expect(logXPEvent).not.toHaveBeenCalled();
  });
});
