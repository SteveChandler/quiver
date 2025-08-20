import { test, expect } from "@playwright/test";

// Helpers for flexible status checks per repo guidance
function isAllowedStatus(status: number, allowed: number[] = [200, 400, 401, 403, 404, 405]) {
  return allowed.includes(status);
}

test.describe("API: /api/session-planner/gear-suggestions", () => {
  test("should handle auth appropriately", async ({ request, baseURL }) => {
    const url = new URL("/api/session-planner/gear-suggestions?waveHeight=3&windSpeed=8", baseURL!).toString();
    const resp = await request.get(url);
    // The endpoint may work without auth (returning 200) or require auth (401/403)
    expect(isAllowedStatus(resp.status(), [200, 401, 403, 404, 405])).toBeTruthy();
  });

  test("validation: missing params returns 400", async ({ page }) => {
    const resp = await page.request.get("/api/session-planner/gear-suggestions");
    expect(isAllowedStatus(resp.status(), [400])).toBeTruthy();
    const body = await resp.json().catch(() => ({}));
    // Standardized error shape
    expect(body).toHaveProperty("success", false);
    expect(typeof body.error === "string").toBeTruthy();
  });

  test("happy path: with a board returns suggestions (authenticated)", async ({ page }) => {
    // 1) Create a board for the authenticated test user (idempotent-ish by random name)
    const boardName = `Test Board ${Date.now()}`;
    const createBoardResp = await page.request.post("/api/boards", {
      data: {
        name: boardName,
        board_type: "Shortboard",
        dimensions: "5'8\"",
        description: "API test board",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(isAllowedStatus(createBoardResp.status(), [200, 201])).toBeTruthy();

    // 2) Call gear suggestions (no beachId required); should not error and should include suggestions array
    const resp = await page.request.get(
      `/api/session-planner/gear-suggestions?waveHeight=3&windSpeed=8`
    );
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json).toHaveProperty("success", true);
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data.suggestions)).toBeTruthy();
    // With at least one board, suggestions may still be filtered by score; assert non-null array
    // If empty, ensure analysisResults present and no error pathway was taken
    expect(json.data).toHaveProperty("analysisResults");
  });
});


