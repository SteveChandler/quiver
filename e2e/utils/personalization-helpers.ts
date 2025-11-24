/**
 * Helper utilities for personalization E2E tests
 *
 * Provides functions for:
 * - Checking personalization data existence
 * - Verifying beach affinity
 * - Fetching personalized recommendations
 * - Test data setup and validation
 */

import { Page, expect } from "@playwright/test";

/**
 * Check if user has personalization data (preferences, affinity, etc.)
 * Returns object indicating which personalization features are available
 */
export async function hasPersonalizationData(page: Page): Promise<{
  hasPreferences: boolean;
  hasAffinity: boolean;
  hasSnapshots: boolean;
  sessionCount: number;
}> {
  try {
    // Navigate to home page to ensure we're authenticated
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for personalization indicators in the UI
    const personalizedBadge = page.locator('[data-testid="personalized-badge"]');
    const affinityBadge = page.locator('[data-testid="familiarity-badge"]');
    const sessionCards = page.locator('[data-testid="session-card"]');

    const hasPersonalizedBadge = await personalizedBadge.count() > 0;
    const hasAffinityBadge = await affinityBadge.count() > 0;
    const sessionCount = await sessionCards.count();

    return {
      hasPreferences: hasPersonalizedBadge,
      hasAffinity: hasAffinityBadge,
      hasSnapshots: sessionCount >= 5, // Minimum for preference learning
      sessionCount,
    };
  } catch (error) {
    console.warn('Could not check personalization data:', error);
    return {
      hasPreferences: false,
      hasAffinity: false,
      hasSnapshots: false,
      sessionCount: 0,
    };
  }
}

/**
 * Verify beach affinity score exists for a given beach
 * Returns the affinity data if found, null otherwise
 */
export async function verifyAffinityScore(
  page: Page,
  beachName: string
): Promise<{
  score: number;
  sessionCount: number;
  lastSurfed: string;
} | null> {
  try {
    // Navigate to beach page
    await page.goto(`/beach/${beachName.toLowerCase().replace(/\s+/g, '-')}`);
    await page.waitForLoadState('networkidle');

    // Look for familiarity badge
    const familiarityBadge = page.locator('[data-testid="familiarity-badge"]');
    const hasBadge = await familiarityBadge.isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasBadge) {
      return null;
    }

    // Extract affinity data from badge text
    const badgeText = await familiarityBadge.textContent();
    const sessionMatch = badgeText?.match(/(\d+)×/);
    const sessionCount = sessionMatch ? parseInt(sessionMatch[1], 10) : 0;

    return {
      score: 0, // UI doesn't show raw score
      sessionCount,
      lastSurfed: '', // UI doesn't show date
    };
  } catch (error) {
    console.warn(`Could not verify affinity for ${beachName}:`, error);
    return null;
  }
}

/**
 * Wait for personalization data to be computed
 * Polls for up to 30 seconds for preferences/affinity to appear
 */
export async function waitForPersonalizationData(
  page: Page,
  options: {
    requirePreferences?: boolean;
    requireAffinity?: boolean;
    requireSnapshots?: boolean;
    timeout?: number;
  } = {}
): Promise<boolean> {
  const {
    requirePreferences = true,
    requireAffinity = false,
    requireSnapshots = false,
    timeout = 30000,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const data = await hasPersonalizationData(page);

    const hasRequired =
      (!requirePreferences || data.hasPreferences) &&
      (!requireAffinity || data.hasAffinity) &&
      (!requireSnapshots || data.hasSnapshots);

    if (hasRequired) {
      return true;
    }

    // Wait 2 seconds before checking again
    await page.waitForTimeout(2000);
  }

  return false;
}

/**
 * Verify PersonalizedBadge component is rendering correctly
 */
export async function verifyPersonalizedBadge(
  page: Page,
  options: {
    shouldBeVisible: boolean;
    shouldShowBreakdown?: boolean;
    shouldShowAffinity?: boolean;
  }
) {
  const { shouldBeVisible, shouldShowBreakdown = false, shouldShowAffinity = false } = options;

  const badge = page.locator('[data-testid="personalized-badge"]');

  if (shouldBeVisible) {
    await expect(badge).toBeVisible();

    // Verify "Personalized for you" text
    await expect(badge).toContainText(/personalized/i);

    // Check tooltip with breakdown if requested
    if (shouldShowBreakdown) {
      await badge.hover();
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText(/score breakdown/i);
    }

    // Check affinity badge if requested
    if (shouldShowAffinity) {
      const affinityBadge = page.locator('[data-testid="affinity-badge"]');
      await expect(affinityBadge).toBeVisible();
      await expect(affinityBadge).toContainText(/surfed here/i);
    }
  } else {
    await expect(badge).not.toBeVisible();
  }
}

/**
 * Verify forecast transparency components are visible
 */
export async function verifyForecastTransparency(page: Page) {
  // Data source badge
  const sourceBadge = page.locator('[data-testid="forecast-source-badge"]');
  await expect(sourceBadge).toBeVisible();

  // Confidence indicator
  const confidenceIndicator = page.locator('[data-testid="confidence-indicator"]');
  const hasConfidence = await confidenceIndicator.isVisible({ timeout: 2000 }).catch(() => false);

  if (hasConfidence) {
    await expect(confidenceIndicator).toContainText(/confidence/i);
  }

  // Data freshness
  const freshness = page.locator('[data-testid="data-freshness"]');
  await expect(freshness).toBeVisible();
  await expect(freshness).toContainText(/updated/i);
}

/**
 * Verify session has captured forecast conditions
 */
export async function verifySessionConditions(page: Page, sessionId: string) {
  await page.goto(`/sessions/${sessionId}`);
  await page.waitForLoadState('networkidle');

  // Look for conditions section
  const conditionsSection = page.locator('text=/Conditions on/i');
  const hasConditions = await conditionsSection.isVisible({ timeout: 2000 }).catch(() => false);

  if (hasConditions) {
    // Verify weather data is shown
    await expect(page.locator('text=/wave.*height/i')).toBeVisible();
    await expect(page.locator('text=/wind/i')).toBeVisible();
  }

  return hasConditions;
}

/**
 * Skip test with helpful message if personalization data is missing
 */
export async function skipIfNoPersonalizationData(
  page: Page,
  test: any,
  requirements: {
    needsPreferences?: boolean;
    needsAffinity?: boolean;
    needsSnapshots?: boolean;
    minSessions?: number;
  } = {}
) {
  const {
    needsPreferences = false,
    needsAffinity = false,
    needsSnapshots = false,
    minSessions = 0,
  } = requirements;

  const data = await hasPersonalizationData(page);

  const reasons: string[] = [];

  if (needsPreferences && !data.hasPreferences) {
    reasons.push('no learned preferences');
  }

  if (needsAffinity && !data.hasAffinity) {
    reasons.push('no beach affinity');
  }

  if (needsSnapshots && !data.hasSnapshots) {
    reasons.push('insufficient forecast snapshots');
  }

  if (minSessions > 0 && data.sessionCount < minSessions) {
    reasons.push(`need ${minSessions} sessions, have ${data.sessionCount}`);
  }

  if (reasons.length > 0) {
    test.skip(
      true,
      `Personalization data missing: ${reasons.join(', ')}. Run: npx tsx e2e/scripts/setup-personalization-db.ts`
    );
  }
}
