/**
 * Board Recommendations API Contract Tests
 *
 * Tests the board-recommendations endpoint:
 * - Authentication required (returns 401 for guests)
 * - Proper payload validation (waveHeight, windSpeed)
 * - Response structure with suggestions array
 * - Confidence thresholds for recommendations
 *
 * @project auth (requires authentication)
 */

import { test, expect, APIRequestContext } from "@playwright/test";
import { createIsolatedApiContext } from "../utils/api-request-helpers";
import { TEST_BEACHES } from "../fixtures/test-data";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BOARD_RECOMMENDATIONS_ENDPOINT = `${BASE_URL}/api/board-recommendations`;

test.describe("Board Recommendations API Contract", () => {
  test.describe("GET /api/board-recommendations", () => {
    test.describe("Authentication Requirements", () => {
      test("should require authentication (401 for unauthenticated)", async ({
        playwright,
      }, testInfo) => {
        const unauthApi = await createIsolatedApiContext(
          playwright,
          BASE_URL,
          testInfo
          // No storageState = unauthenticated
        );

        const response = await unauthApi.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        expect(response.status()).toBe(401);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test("should return 200 for authenticated user", async ({
        playwright,
      }, testInfo) => {
        const authApi = await createIsolatedApiContext(
          playwright,
          BASE_URL,
          testInfo,
          { storageState: "e2e/.auth/state.json" }
        );

        const response = await authApi.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        // Should be 200 (may have empty suggestions if user has no boards)
        expect(response.status()).toBe(200);

        const json = await response.json();
        expect(json.success).toBe(true);
      });
    });

    test.describe("Parameter Validation", () => {
      let api: APIRequestContext;

      test.beforeAll(async ({ playwright }, testInfo) => {
        api = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
          storageState: "e2e/.auth/state.json",
        });
      });

      test("should reject missing waveHeight", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?windSpeed=5`
        );

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        // API returns "Wave height and wind speed are required"
        expect(json.error).toMatch(/wave.*height|required/i);
      });

      test("should reject missing windSpeed", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3`
        );

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
        // API returns "Wave height and wind speed are required"
        expect(json.error).toMatch(/wind.*speed|required/i);
      });

      test("should accept valid waveHeight and windSpeed", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        expect(response.status()).toBe(200);

        const json = await response.json();
        expect(json.success).toBe(true);
      });

      test("should accept optional beachId parameter", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5&beachId=${TEST_BEACHES.blacks.id}`
        );

        expect(response.status()).toBe(200);

        const json = await response.json();
        expect(json.success).toBe(true);
      });

      test("should reject invalid waveHeight (non-numeric)", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=abc&windSpeed=5`
        );

        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
      });

      test("should handle negative waveHeight gracefully", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=-3&windSpeed=5`
        );

        // API validates input and rejects negative wave heights
        expect(response.status()).toBe(400);

        const json = await response.json();
        expect(json.success).toBe(false);
      });
    });

    test.describe("Response Structure", () => {
      let api: APIRequestContext;

      test.beforeAll(async ({ playwright }, testInfo) => {
        api = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
          storageState: "e2e/.auth/state.json",
        });
      });

      test("should return valid JSON content", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        expect(response.headers()["content-type"]).toContain("application/json");

        const json = await response.json();
        expect(json).toBeDefined();
      });

      test("should return standard API response structure", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        const json = await response.json();

        expect(json).toHaveProperty("success");
        expect(json).toHaveProperty("data");
      });

      test("should include userId, conditions, suggestions on success", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        if (response.status() === 200) {
          const json = await response.json();

          expect(json.data).toHaveProperty("userId");
          expect(json.data).toHaveProperty("conditions");
          expect(json.data).toHaveProperty("suggestions");

          expect(json.data.conditions).toHaveProperty("waveHeight");
          expect(json.data.conditions).toHaveProperty("windSpeed");
          expect(Array.isArray(json.data.suggestions)).toBe(true);
        }
      });
    });

    test.describe("Suggestions Schema", () => {
      let api: APIRequestContext;

      test.beforeAll(async ({ playwright }, testInfo) => {
        api = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
          storageState: "e2e/.auth/state.json",
        });
      });

      test("each suggestion should have required fields", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const suggestions = json.data.suggestions;

          // May be empty if user has no boards/sessions
          if (suggestions.length > 0) {
            suggestions.forEach((suggestion: any) => {
              expect(suggestion).toHaveProperty("board");
              expect(suggestion).toHaveProperty("score");
              expect(suggestion).toHaveProperty("confidence");
              // API returns "reasons" array instead of "reasoning" string
              expect(suggestion).toHaveProperty("reasons");
              expect(Array.isArray(suggestion.reasons)).toBe(true);
            });
          }
        }
      });

      test("board object should have name and board_type", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const suggestions = json.data.suggestions;

          if (suggestions.length > 0) {
            suggestions.forEach((suggestion: any) => {
              expect(suggestion.board).toHaveProperty("id");
              expect(suggestion.board).toHaveProperty("name");
              expect(suggestion.board).toHaveProperty("board_type");
            });
          }
        }
      });

      test("score should be a number between 0 and 100", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const suggestions = json.data.suggestions;

          if (suggestions.length > 0) {
            suggestions.forEach((suggestion: any) => {
              expect(typeof suggestion.score).toBe("number");
              expect(suggestion.score).toBeGreaterThanOrEqual(0);
              expect(suggestion.score).toBeLessThanOrEqual(100);
            });
          }
        }
      });

      test("confidence should be a number between 0 and 1", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        if (response.status() === 200) {
          const json = await response.json();
          const suggestions = json.data.suggestions;

          if (suggestions.length > 0) {
            suggestions.forEach((suggestion: any) => {
              expect(typeof suggestion.confidence).toBe("number");
              expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
              expect(suggestion.confidence).toBeLessThanOrEqual(1);
            });
          }
        }
      });
    });

    test.describe("Condition Variations", () => {
      let api: APIRequestContext;

      test.beforeAll(async ({ playwright }, testInfo) => {
        api = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
          storageState: "e2e/.auth/state.json",
        });
      });

      test("should handle small wave conditions (1-2ft)", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=1.5&windSpeed=5`
        );

        expect(response.status()).toBe(200);

        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.conditions.waveHeight).toBe(1.5);
      });

      test("should handle medium wave conditions (3-5ft)", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=4&windSpeed=8`
        );

        expect(response.status()).toBe(200);

        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.conditions.waveHeight).toBe(4);
      });

      test("should handle large wave conditions (6-10ft)", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=8&windSpeed=10`
        );

        expect(response.status()).toBe(200);

        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.conditions.waveHeight).toBe(8);
      });

      test("should handle very light wind conditions (1 mph)", async () => {
        // Note: API requires windSpeed > 0, so testing with minimal wind
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=1`
        );

        expect(response.status()).toBe(200);

        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.conditions.windSpeed).toBe(1);
      });

      test("should handle high wind conditions", async () => {
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=25`
        );

        expect(response.status()).toBe(200);

        const json = await response.json();
        expect(json.success).toBe(true);
        expect(json.data.conditions.windSpeed).toBe(25);
      });
    });

    test.describe("Error Handling", () => {
      let api: APIRequestContext;

      test.beforeAll(async ({ playwright }, testInfo) => {
        api = await createIsolatedApiContext(playwright, BASE_URL, testInfo, {
          storageState: "e2e/.auth/state.json",
        });
      });

      test("should handle POST requests with 405 Method Not Allowed", async () => {
        const response = await api.post(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );

        expect(response.status()).toBe(405);
      });
    });

    test.describe("Performance", () => {
      test("should respond within reasonable time (< 3000ms)", async ({
        playwright,
      }, testInfo) => {
        const api = await createIsolatedApiContext(
          playwright,
          BASE_URL,
          testInfo,
          { storageState: "e2e/.auth/state.json" }
        );

        const startTime = Date.now();
        const response = await api.get(
          `${BOARD_RECOMMENDATIONS_ENDPOINT}?waveHeight=3&windSpeed=5`
        );
        const duration = Date.now() - startTime;

        console.log(`[Gear Suggestions] Response time: ${duration}ms`);

        expect(duration).toBeLessThan(3000);
      });
    });
  });
});
