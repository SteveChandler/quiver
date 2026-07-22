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
const REQUEST_AS_OF = "2026-07-20T12:00:00.000Z";
const PRIMARY_BEACH_ID = "11111111-1111-4111-8111-111111111111";
const SECONDARY_BEACH_ID = "22222222-2222-4222-8222-222222222222";

function candidateId(beachId: string): string {
  return `coach-pick:${beachId}:${REQUEST_AS_OF}`;
}

function allowDecision(
  beachId: string | null = PRIMARY_BEACH_ID,
  holdEpoch = "ordinary-epoch",
) {
  return {
    candidateId: beachId === null ? null : candidateId(beachId),
    evaluation: {
      outcome: "allow",
      holdIds: [],
      holdEpoch,
    },
    recommendationAvailability: {
      state: "available",
      holdEpoch,
      resolutionAsOf: REQUEST_AS_OF,
    },
  };
}

function unavailableDecision(
  beachId: string | null = PRIMARY_BEACH_ID,
  holdEpoch = "unavailable-epoch",
) {
  return {
    candidateId: beachId === null ? null : candidateId(beachId),
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
      resolutionAsOf: REQUEST_AS_OF,
    },
  };
}

function blockedDecision(beachId: string) {
  return {
    candidateId: candidateId(beachId),
    evaluation: {
      outcome: "explicit_none",
      reasonCode: "major_event_hold",
      holdIds: ["33333333-3333-4333-8333-333333333333"],
      expiresAt: "2026-07-21T00:00:00.000Z",
      holdEpoch: "ordinary-epoch",
    },
    recommendationAvailability: {
      state: "none",
      reasonCode: "major_event_hold",
      expiresAt: "2026-07-21T00:00:00.000Z",
      holdEpoch: "ordinary-epoch",
      resolutionAsOf: REQUEST_AS_OF,
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date(REQUEST_AS_OF));
    jest.clearAllMocks();
    mockAuthGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetProfileExperienceLevel.mockResolvedValue(null);
    mockRpc.mockResolvedValue({
      data: [
        {
          pick_rank: 1,
          beach_id: PRIMARY_BEACH_ID,
          name: "Stale RPC Beach",
          distance_km: 1.2,
          score: 88,
        },
      ],
      error: null,
    });
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      async (input: {
        candidates: Array<{ candidateId: string; beachId: string } | null>;
      }) =>
        input.candidates.map((candidate) =>
          allowDecision(candidate?.beachId ?? null),
        ),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/coach-picks/route.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
  });

  it("preserves legacy Coach picks when the hold policy allows them", async () => {
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");

    const response = await GET(
      new NextRequest(
        new URL(
          `http://localhost/api/coach-picks?beachId=${PRIMARY_BEACH_ID}&radiusKm=80`,
        ),
      ) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("get_coach_picks", {
      _beach_id: PRIMARY_BEACH_ID,
      _radius_km: 80,
    });
    expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
      candidates: [
        {
          candidateId: candidateId(PRIMARY_BEACH_ID),
          beachId: PRIMARY_BEACH_ID,
          startsAt: REQUEST_AS_OF,
          endsAt: "2026-07-20T12:00:00.001Z",
        },
      ],
      profileExperience: null,
      asOf: new Date(REQUEST_AS_OF),
    });
    expect(body.data).toEqual({
      picks: [
        {
          pick_rank: 1,
          beach_id: PRIMARY_BEACH_ID,
          name: "Stale RPC Beach",
          distance_km: 1.2,
          score: 88,
        },
      ],
      recommendationAvailability: {
        state: "available",
        holdEpoch: "ordinary-epoch",
        resolutionAsOf: REQUEST_AS_OF,
      },
    });
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
  });

  it("uses the same invalid-context hold boundary when beachId is missing", async () => {
    mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([
      unavailableDecision(null),
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
      asOf: new Date(REQUEST_AS_OF),
    });
    expect(body.data).toEqual({
      picks: [],
      recommendationAvailability: {
        state: "none",
        reasonCode: "hold_state_unavailable",
        holdEpoch: "unavailable-epoch",
        resolutionAsOf: REQUEST_AS_OF,
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
        new URL(`http://localhost/api/coach-picks?beachId=${PRIMARY_BEACH_ID}`),
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(mockGetProfileExperienceLevel).toHaveBeenCalledWith(
      expect.any(Object),
      "verified-user",
    );
    expect(mockEvaluateMajorEventHoldCandidates).toHaveBeenCalledWith({
      candidates: [
        expect.objectContaining({
          candidateId: candidateId(PRIMARY_BEACH_ID),
          beachId: PRIMARY_BEACH_ID,
        }),
      ],
      profileExperience: "advanced",
      asOf: new Date(REQUEST_AS_OF),
    });
  });

  it("filters blocked picks while preserving allowed picks", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          pick_rank: 1,
          beach_id: PRIMARY_BEACH_ID,
          name: "Held Beach",
          distance_km: 1.2,
          score: 88,
        },
        {
          pick_rank: 2,
          beach_id: SECONDARY_BEACH_ID,
          name: "Allowed Beach",
          distance_km: 4.5,
          score: 82,
        },
      ],
      error: null,
    });
    mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([
      blockedDecision(PRIMARY_BEACH_ID),
      allowDecision(SECONDARY_BEACH_ID),
    ]);
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");

    const response = await GET(
      new NextRequest(
        new URL(`http://localhost/api/coach-picks?beachId=${PRIMARY_BEACH_ID}`),
      ) as never,
    );
    const body = await response.json();

    expect(body.data.picks).toEqual([
      expect.objectContaining({
        beach_id: SECONDARY_BEACH_ID,
        name: "Allowed Beach",
      }),
    ]);
    expect(body.data.recommendationAvailability).toEqual({
      state: "available",
      holdEpoch: "ordinary-epoch",
      resolutionAsOf: REQUEST_AS_OF,
    });
  });

  it("fails unresolved policy closed without exposing internal evidence", async () => {
    mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([
      unavailableDecision(PRIMARY_BEACH_ID, "enforce-epoch"),
    ]);
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");

    const response = await GET(
      new NextRequest(
        new URL(`http://localhost/api/coach-picks?beachId=${PRIMARY_BEACH_ID}`),
      ) as never,
    );
    const body = await response.json();

    expect(mockRpc).toHaveBeenCalledWith("get_coach_picks", {
      _beach_id: PRIMARY_BEACH_ID,
      _radius_km: 80,
    });
    expect(body.data.picks).toEqual([]);
    expect(body.data.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch: "enforce-epoch",
      resolutionAsOf: REQUEST_AS_OF,
    });
    expect(JSON.stringify(body)).not.toMatch(/holdIds|evaluation/);
    expect(response.headers.get("Cache-Control")).toBe(NO_STORE);
  });

  it("fails closed when decisions are not bound to the returned picks", async () => {
    mockEvaluateMajorEventHoldCandidates.mockResolvedValueOnce([
      allowDecision(SECONDARY_BEACH_ID),
    ]);
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");

    const response = await GET(
      new NextRequest(
        new URL(`http://localhost/api/coach-picks?beachId=${PRIMARY_BEACH_ID}`),
      ) as never,
    );
    const body = await response.json();

    expect(body.data.picks).toEqual([]);
    expect(body.data.recommendationAvailability).toEqual({
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch: "ordinary-epoch",
      resolutionAsOf: REQUEST_AS_OF,
    });
  });
});
