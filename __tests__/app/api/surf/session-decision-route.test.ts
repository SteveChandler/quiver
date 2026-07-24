/** @jest-environment node */

jest.mock("server-only", () => ({}));
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: unknown) => handler,
    withRateLimit: (handler: unknown) => handler,
  };
});

const mockResolveCanonicalSessionDecision = jest.fn();
jest.mock("@/lib/recommendations/canonical-decision", () => ({
  resolveCanonicalSessionDecision: (...args: unknown[]) =>
    mockResolveCanonicalSessionDecision(...args),
}));

const mockGetProfileExperienceLevel = jest.fn();
jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: (...args: unknown[]) =>
    mockGetProfileExperienceLevel(...args),
}));

import { NextRequest } from "next/server";

function supabaseStub(): Record<string, unknown> {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({
            data: { is_pro: true },
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe("GET /api/surf/session-decision", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockGetProfileExperienceLevel.mockResolvedValue("beginner");
    mockResolveCanonicalSessionDecision.mockResolvedValue({
      schemaVersion: "canonical-session-decision.v1",
      engineVersion: "rules.v1",
      decisionId: "a".repeat(64),
      verdict: "no",
      decisionBasis: "safety_override",
      reasonCode: "no_candidates",
      selection: null,
    });
  });

  it("resolves one server-owned decision without any surface-specific input", async () => {
    const { GET } = await import("@/app/api/surf/session-decision/route");
    const request = new NextRequest(
      "http://localhost:3000/api/surf/session-decision?lat=32.83&lon=-117.27&horizonHours=24&timezone=America%2FLos_Angeles&timeSlot=any",
    );
    const response = await GET(request, {
      user: { id: "user-1" },
      supabase: supabaseStub(),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, no-cache, must-revalidate",
    );
    expect(mockResolveCanonicalSessionDecision).toHaveBeenCalledTimes(1);
    expect(mockResolveCanonicalSessionDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        profileExperience: "beginner",
        scope: expect.objectContaining({
          kind: "plan_next_session",
          timezone: "America/Los_Angeles",
        }),
        discoveryOptions: expect.objectContaining({
          userLocation: { lat: 32.83, lon: -117.27 },
          horizonHours: 24,
          timeSlot: "any",
          isPro: true,
        }),
      }),
    );
    const call = mockResolveCanonicalSessionDecision.mock.calls[0][0];
    expect(call).not.toHaveProperty("surface");
  });

  it("rejects unpaired coordinates before invoking the decision engine", async () => {
    const { GET } = await import("@/app/api/surf/session-decision/route");
    const request = new NextRequest(
      "http://localhost:3000/api/surf/session-decision?lat=32.83&timezone=America%2FLos_Angeles",
    );
    const response = await GET(request, {
      user: { id: "user-1" },
      supabase: supabaseStub(),
    } as never);

    expect(response.status).toBe(400);
    expect(mockResolveCanonicalSessionDecision).not.toHaveBeenCalled();
  });
});
