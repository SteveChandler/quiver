/**
 * @jest-environment node
 *
 * The surf call's now recommendation gates like /api/surf/discover: with the
 * best-spot gate on, a free user's now call is withheld unless founding access
 * treats them as paid.
 */
jest.mock("server-only", () => ({}));

const mockDiscoverSurfSpots = jest.fn();
jest.mock("@/lib/services/surf-discovery-service", () => ({
  discoverSurfSpots: (...args: unknown[]) => mockDiscoverSurfSpots(...args),
}));
jest.mock("@/lib/services/discovery/major-event-hold", () => ({
  sanitizeSurfDiscoveryForSerializationMajorEventHold: async (discovery: unknown) => discovery,
}));

import { loadNowRecommendation } from "@/lib/services/discovery/now-recommendation";
import { featureAccessOff, featureAccessOn } from "@/__tests__/setup/founding-access";
import type { Beach } from "@/types/database";

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-04T18:00:00Z");

function nowDiscovery(): Record<string, unknown> {
  return {
    recommendations: [{
      recommendationId: `beach:${BEACH_ID}:now`,
      beach: { id: BEACH_ID, name: "Ocean Beach Pier", lat: 32.75, lon: -117.25 },
      window: {
        start: new Date(NOW.getTime() - 30 * 60_000),
        end: new Date(NOW.getTime() + 2 * 3_600_000),
        timezone: "America/Los_Angeles",
      },
      forecast: { wave_height: "3 ft" },
      score: 62,
      recommendationLabel: "Maybe",
      reasons: [],
    }],
    includedRecommendations: [],
    recommendationAvailability: { state: "available", holdEpoch: "now-test" },
    searchCriteria: { maxResults: 1 },
    metadata: { outcome: "success", generated_at: NOW.toISOString() },
  };
}

const beach = { id: BEACH_ID, lat: 32.75, lon: -117.25 } as Beach;
const savedGate = process.env.SURF_DISCOVERY_BEST_SPOT_GATE;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SURF_DISCOVERY_BEST_SPOT_GATE = "1";
  mockDiscoverSurfSpots.mockResolvedValue(nowDiscovery());
});

afterAll(() => {
  if (savedGate === undefined) delete process.env.SURF_DISCOVERY_BEST_SPOT_GATE;
  else process.env.SURF_DISCOVERY_BEST_SPOT_GATE = savedGate;
});

it("ON: a free user's now call runs as paid and is not withheld", async () => {
  const result = await loadNowRecommendation({
    userId: "user-1", beach, access: featureAccessOn("user-1", false), profileExperience: null, now: NOW,
  });
  expect(mockDiscoverSurfSpots).toHaveBeenCalledWith("user-1", expect.objectContaining({ isPro: true, discoveryMode: "now" }));
  expect(result.recommendation).toMatchObject({ beach: { id: BEACH_ID }, score: 62 });
});

it("OFF: a free user's now call stays behind the best-spot gate", async () => {
  const result = await loadNowRecommendation({
    userId: "user-1", beach, access: featureAccessOff("user-1", false), profileExperience: null, now: NOW,
  });
  expect(mockDiscoverSurfSpots).toHaveBeenCalledWith("user-1", expect.objectContaining({ isPro: false }));
  expect(result.recommendation).toBeNull();
});
