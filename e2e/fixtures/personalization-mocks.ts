/**
 * Personalization API Mock Fixtures
 *
 * Provides realistic mock API responses and a `setupPersonalizationMocks` helper
 * for E2E tests that need personalization data without a seeded database.
 *
 * Usage in beforeEach (call BEFORE page.goto):
 *
 *   import { setupPersonalizationMocks } from './fixtures/personalization-mocks';
 *
 *   test.beforeEach(async ({ page }) => {
 *     errorCapture = setupErrorDetection(page);
 *     await setupPersonalizationMocks(page);
 *     await ensureAuthenticated(page);
 *   });
 *
 * API contracts mocked here:
 *   POST /api/beach/personalized-score
 *   GET  /api/surf/insights
 *   GET  /api/surf/discover
 *   GET  /api/beaches/favorites
 *   GET  /api/auth/check-session
 */

import { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const TEST_BEACH_ID = "84d3468b-c1ec-46ad-8621-d8507e5f167a";
const TEST_BEACH_ID_2 = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_SESSION_ID = "session-uuid-1234-5678-abcd-ef0000000001";
const GENERATED_AT = new Date().toISOString();

// ---------------------------------------------------------------------------
// POST /api/beach/personalized-score mock response
// ---------------------------------------------------------------------------
// Matches PersonalizedScore interface from
// lib/services/personalized-scoring-service.ts

// totalBonus = 5+8+4+0 = 17, multiplier = 1.0+(17/50)*0.15 = 1.051
// score = round(75*1.051) = 79
export const MOCK_PERSONALIZED_SCORE = {
  score: 79,
  personalized: true,
  breakdown: {
    base: 75,
    onboardingPrefs: 5,
    learnedPrefs: 8,
    implicitPrefs: 4,
    affinity: 0,
    multiplier: 1.051,
  },
};

// ---------------------------------------------------------------------------
// GET /api/surf/insights mock response
// ---------------------------------------------------------------------------
// Matches PersonalizedInsights interface from types/personalization.ts

export const MOCK_INSIGHTS_READY = {
  matchPercent: 87,
  label: "Great" as const,
  reasonBullets: [
    "Wave height (3-5 ft) matches your preferred range",
    "Light offshore wind conditions like your best sessions",
    "You've rated similar conditions 4+ stars",
  ],
  similarSessions: [
    {
      id: TEST_SESSION_ID,
      beachName: "Blacks Beach",
      beachId: TEST_BEACH_ID,
      sessionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      rating: 4,
      waveHeight: 4,
      wavePeriod: 12,
      windSpeed: 8,
      boardName: "Fish",
      boardType: "fish",
      similarityScore: 92,
    },
    {
      id: "session-uuid-1234-5678-abcd-ef0000000002",
      beachName: "Ocean Beach",
      beachId: TEST_BEACH_ID_2,
      sessionDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      rating: 5,
      waveHeight: 3.5,
      wavePeriod: 11,
      windSpeed: 6,
      boardName: "Fish",
      boardType: "fish",
      similarityScore: 85,
    },
  ],
  boardTip: "Your Fish performed well in similar conditions — consider bringing it.",
  sessionCount: 8,
  state: "ready" as const,
};

// ---------------------------------------------------------------------------
// GET /api/surf/discover mock response
// ---------------------------------------------------------------------------
// Matches SurfDiscoveryResponse interface from types/personalization.ts

export const MOCK_DISCOVER_RESPONSE = {
  recommendations: [
    {
      beach: {
        id: TEST_BEACH_ID,
        name: "Blacks Beach",
        slug: "blacks",
        city: "San Diego",
        state: "CA",
        center_lat: 32.8726,
        center_lng: -117.2536,
        photo_url: null,
      },
      isFavorite: true,
      window: {
        start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        tide: "Rising",
        wind: "8 mph SW",
        waveHeight: "3-5 ft",
        wavePeriod: "12s",
        dataSource: "CDIP",
        confidence: 88,
        timezone: "America/Los_Angeles",
      },
      forecast: {
        wave_height: 4,
        wave_period: 12,
        wind_speed: 8,
        wind_direction: 225,
      },
      score: 92,
      matchQuality: "excellent" as const,
      recommendationLabel: "Worth it" as const,
      subscores: {
        waveHeightFit: 22,
        periodEnergyScore: 18,
        windAlignment: 19,
        tideFit: 13,
        affinityBonus: 10,
        distancePenalty: 0,
      },
      summary: "Good surf opportunity in the next few hours",
      message: "Worth it — Good wave size, Offshore wind",
      reasons: [
        "Wave height in your preferred range",
        "Clean offshore conditions",
        "Familiar spot with high affinity",
      ],
      warnings: [],
      conditionBadges: [
        { label: "Clean Swell", contribution: 15 },
        { label: "Offshore Wind", contribution: 12 },
      ],
      waveHeightBadge: "3-5ft",
      distanceMiles: 2.3,
      generated_at: GENERATED_AT,
    },
    {
      beach: {
        id: TEST_BEACH_ID_2,
        name: "Ocean Beach Pier",
        slug: "ocean-beach-pier",
        city: "San Diego",
        state: "CA",
        center_lat: 32.7507,
        center_lng: -117.2526,
        photo_url: null,
      },
      isFavorite: false,
      window: {
        start: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        tide: "High Slack",
        wind: "10 mph W",
        waveHeight: "2-3 ft",
        wavePeriod: "10s",
        dataSource: "NOAA_NWS",
        confidence: 75,
        timezone: "America/Los_Angeles",
      },
      forecast: {
        wave_height: 2.5,
        wave_period: 10,
        wind_speed: 10,
        wind_direction: 270,
      },
      score: 74,
      matchQuality: "good" as const,
      recommendationLabel: "Maybe" as const,
      subscores: {
        waveHeightFit: 16,
        periodEnergyScore: 14,
        windAlignment: 15,
        tideFit: 12,
        affinityBonus: 0,
        distancePenalty: -3,
      },
      summary: "Decent conditions at Ocean Beach",
      message: "Maybe — Small but clean",
      reasons: ["Light onshore wind", "Consistent swell period"],
      warnings: ["Smaller than ideal wave height"],
      conditionBadges: [{ label: "Consistent", contribution: 8 }],
      waveHeightBadge: "2-3ft",
      distanceMiles: 5.1,
      generated_at: GENERATED_AT,
    },
  ],
  searchCriteria: {
    userLocation: { lat: 32.7157, lon: -117.1611 },
    radiusMiles: 25,
    maxResults: 5,
  },
  metadata: {
    totalBeachesConsidered: 12,
    successfulForecasts: 10,
    partialSuccess: false,
    failedBeaches: 2,
    staleBeaches: 0,
    usingStaleData: false,
    generated_at: GENERATED_AT,
  },
};

// ---------------------------------------------------------------------------
// GET /api/beaches/favorites mock response
// ---------------------------------------------------------------------------
// Matches the shape from app/api/beaches/favorites/route.ts:
//   createSuccessResponse({ beaches })

export const MOCK_FAVORITES_RESPONSE = {
  beaches: [
    {
      id: TEST_BEACH_ID,
      name: "Blacks Beach",
      slug: "blacks",
      city: "San Diego",
      state: "CA",
      center_lat: 32.8726,
      center_lng: -117.2536,
    },
  ],
};

// ---------------------------------------------------------------------------
// GET /api/auth/check-session mock response (authenticated)
// ---------------------------------------------------------------------------

export const MOCK_AUTH_SESSION_RESPONSE = {
  hasSession: true,
  sessionData: {
    userId: "test-user-uuid-0000-0000-0000-000000000001",
    email: "testuser@quivertest.local",
  },
};

// ---------------------------------------------------------------------------
// Helper: wrap a data payload in the standard success envelope
// ---------------------------------------------------------------------------

function successEnvelope(data: unknown) {
  return {
    success: true,
    data,
  };
}

// ---------------------------------------------------------------------------
// Main setup function
// ---------------------------------------------------------------------------

/**
 * Set up all personalization API mocks via page.route().
 *
 * Call this in beforeEach BEFORE navigating to any page so that the routes are
 * registered before any network requests fire.
 *
 * Routes registered:
 *   POST  /api/beach/personalized-score  (glob: ** prefix)
 *   GET   /api/surf/insights             (glob: ** prefix, ** suffix)
 *   GET   /api/surf/discover             (glob: ** prefix, ** suffix)
 *   GET   /api/beaches/favorites         (glob: ** prefix, ** suffix)
 *   GET   /api/auth/check-session        (glob: ** prefix, ** suffix)
 */
export async function setupPersonalizationMocks(page: Page): Promise<void> {
  // POST /api/beach/personalized-score
  // Returns a 92% match score with full breakdown
  await page.route("**/api/beach/personalized-score", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(MOCK_PERSONALIZED_SCORE)),
      });
    } else {
      await route.continue();
    }
  });

  // GET /api/surf/insights (with any query params)
  await page.route("**/api/surf/insights**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(MOCK_INSIGHTS_READY)),
      });
    } else {
      await route.continue();
    }
  });

  // GET /api/surf/discover (with any query params)
  await page.route("**/api/surf/discover**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(MOCK_DISCOVER_RESPONSE)),
      });
    } else {
      await route.continue();
    }
  });

  // GET /api/beaches/favorites
  await page.route("**/api/beaches/favorites**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successEnvelope(MOCK_FAVORITES_RESPONSE)),
      });
    } else {
      await route.continue();
    }
  });

  // NOTE: We intentionally do NOT mock /api/auth/check-session here.
  // The real auth state from ensureAuthenticated() provides valid cookies.
  // Mocking this endpoint can interfere with Next.js server-side rendering
  // (page.route intercepts SSR fetches too), causing 500 errors on page loads.
}
