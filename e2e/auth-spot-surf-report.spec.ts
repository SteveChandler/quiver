import { test, expect } from "./fixtures/auth-fixture";
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';
import { isVisibleSafe } from './utils/strict-helpers';

const ALA_MOANA_BOWLS_ID = '80fc2c1b-2d3f-4a94-bcc2-c8ea0e9b8fc5';

interface SurfCallContractResponse {
  success: boolean;
  data: {
    report: {
      verdict: 'YES' | 'MAYBE' | 'NO';
      bestWindowStart: string | null;
      bestWindowEnd: string | null;
      score: number | null;
    };
    sessionDecision: {
      verdict: 'go' | 'maybe' | 'no';
      selection: {
        beachId: string;
        windowStart: string;
        windowEnd: string;
      } | null;
    };
    forecastContext: {
      beachId: string;
      selectedWindowStart: string;
      selectedWindowEnd: string;
    } | null;
  };
}

/**
 * Authenticated Spot Surf Report Tests
 *
 * Verifies that authenticated users do NOT see the sign-in CTA
 * on the surf report card.
 *
 * @project auth
 */

test.describe('Spot Surf Report (Authenticated)', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Spot Surf Report (Authenticated)' });
  });

  test('authenticated users do not see PublicContentGate CTA on surf report', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    const surfReport = page.locator('section[aria-label*="surf call"]');
    const isVisible = await isVisibleSafe(surfReport);

    // eslint-disable-next-line playwright/no-conditional-in-test -- surf report availability depends on live forecast coverage
    if (isVisible) {
      // PublicContentGate renders its CTA only for unauthenticated users.
      // For authenticated users the gate is bypassed and conditions are shown directly.
      const gateTitle = surfReport.getByRole('heading', { name: /see today's best window/i });
      await expect(gateTitle).not.toBeVisible();

      // Conditions content (wave height, wind, best window, or why sentence) should be
      // accessible without blur or an overlay CTA
      const signUpButton = surfReport.getByRole('button', { name: /sign up free/i });
      await expect(signUpButton).not.toBeVisible();
    }
  });

  test('Bowls API keeps its canonical decision and report on the requested beach', async ({ page }) => {
    const response = await page.request.get(
      `/api/surf/call?beachId=${ALA_MOANA_BOWLS_ID}`,
    );
    expect(response.status()).toBe(200);

    const body = (await response.json()) as SurfCallContractResponse;
    expect(body.success).toBe(true);

    const { report, sessionDecision, forecastContext } = body.data;
    const { selection } = sessionDecision;
    expect([null, ALA_MOANA_BOWLS_ID]).toContain(selection?.beachId ?? null);
    expect(report.bestWindowStart).toBe(selection?.windowStart ?? null);
    expect(report.bestWindowEnd).toBe(selection?.windowEnd ?? null);
    expect(report.score).toEqual(selection === null ? null : expect.any(Number));
    expect(report.verdict).toBe(
      { go: 'YES', maybe: 'MAYBE', no: 'NO' }[sessionDecision.verdict],
    );
    expect(forecastContext?.beachId ?? null).toBe(selection?.beachId ?? null);
    expect(forecastContext?.selectedWindowStart ?? null).toBe(
      selection?.windowStart ?? null,
    );
    expect(forecastContext?.selectedWindowEnd ?? null).toBe(
      selection?.windowEnd ?? null,
    );
    expect(selection !== null || sessionDecision.verdict === 'no').toBe(true);
  });
});
