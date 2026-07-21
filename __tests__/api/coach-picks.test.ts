/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const mockEvaluateMajorEventHoldCandidates = jest.fn();
const mockGetProfileExperienceLevel = jest.fn();
const mockAuthGetUser = jest.fn();
const mockRpc = jest.fn();
const NO_STORE = "private, no-store, no-cache, must-revalidate";

function allowDecision(holdEpoch = "ordinary-epoch") {
  return {
    candidateId: null,
    evaluation: {
      outcome: "allow",
      holdIds: [],
      holdEpoch,
    },
    recommendationAvailability: {
      state: "available",
      holdEpoch,
    },
  };
}

function unavailableDecision(holdEpoch = "unavailable-epoch") {
  return {
    candidateId: null,
    evaluation: {
      outcome: "explicit_none",
      reasonCode: "hold_state_unavailable",
      holdIds: [],
      holdEpoch,
    },
    recommendationAvailability: {
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch,
    },
  };
}

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: () => ({
    auth: { getUser: (...args: unknown[]) => mockAuthGetUser(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

jest.mock("@/lib/profile/skill-level", () => ({
  getProfileExperienceLevel: (...args: unknown[]) =>
    mockGetProfileExperienceLevel(...args),
}));

jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: (input: unknown) =>
    mockEvaluateMajorEventHoldCandidates(input),
}));

describe("GET /api/coach-picks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetProfileExperienceLevel.mockResolvedValue(null);
    mockRpc.mockResolvedValue({
      data: [
        {
          pick_rank: 1,
          beach_id: "11111111-1111-4111-8111-111111111111",
          name: "Stale RPC Beach",
          distance_km: 1.2,
          score: 88,
        },
      ],
      error: null,
    });
    mockEvaluateMajorEventHoldCandidates.mockResolvedValue([allowDecision()]);
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/coach-picks/route.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
  });

  it("does not call the removed Coach RPC and returns an explicit empty surface", async () => {
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");

    const response = await GET(
      new NextRequest(
        new URL(
          "http://localhost/api/coach-picks?beachId=test-beach&radiusKm=80",
        ),
      ) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
      candidates: [null],
      profileExperience: null,
    });
    expect(body.data).toEqual({
      picks: [],
      recommendationAvailability: {
        state: "available",
        holdEpoch: "ordinary-epoch",
      },
    });
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
  });

  it("uses the same invalid-context hold boundary when beachId is missing", async () => {
    mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([
      unavailableDecision(),
    ]);
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");

    const response = await GET(
      new NextRequest(new URL("http://localhost/api/coach-picks")) as never,
    );
    const body = await response.json();

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
      candidates: [null],
      profileExperience: null,
    });
    expect(body.data).toEqual({
      picks: [],
      recommendationAvailability: {
        state: "none",
        reasonCode: "hold_state_unavailable",
        holdEpoch: "unavailable-epoch",
      },
    });
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
  });

  it("passes verified profile experience to the hold service", async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: { id: "verified-user" } },
      error: null,
    });
    mockGetProfileExperienceLevel.mockResolvedValueOnce("advanced");
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");

    const response = await GET(
      new NextRequest(
        new URL("http://localhost/api/coach-picks?beachId=test-beach"),
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(mockGetProfileExperienceLevel).toHaveBeenCalledWith(
      expect.any(Object),
      "verified-user",
    );
    expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
      candidates: [null],
      profileExperience: "advanced",
    });
  });

  it("fails unresolved policy closed without exposing internal evidence", async () => {
    mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([
      unavailableDecision("enforce-epoch"),
    ]);
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");

    const response = await GET(
      new NextRequest(
        new URL("http://localhost/api/coach-picks?beachId=test-beach"),
      ) as never,
    );
    const body = await response.json();

    expect(body.data.picks).toEqual([]);
    expect(body.data.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch: "enforce-epoch",
    });
    expect(JSON.stringify(body)).not.toMatch(/holdIds|evaluation/);
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
  });
});
