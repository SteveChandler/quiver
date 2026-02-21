import { test, expect } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { navigateToBeach } from './utils/test-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

/**
 * Nearby Surf Spots - Skill Level Display Tests
 *
 * Verifies that nearby beach cards display actual skill levels
 * (not "All levels" for every card), proving the skill_level column
 * flows through get_nearby_beaches RPC -> enrichment -> SurfSpotCard.
 *
 * @project guest
 */

const KNOWN_SKILL_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
  'Beginner-Intermediate',
  'Intermediate-Advanced',
];

test.describe('Nearby Spots Skill Levels', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Nearby Spots Skill Levels' });
  });

  test('nearby spots section shows real skill levels, not all "All levels"', async ({ page }) => {
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Scroll down incrementally to find the "Nearby Surf Spots" section
    const nearbyHeading = page.getByRole('heading', { name: /nearby surf spots/i });

    for (let i = 0; i < 10; i++) {
      const visible = await nearbyHeading.isVisible().catch(() => false);
      if (visible) break;
      await page.evaluate((step) => window.scrollBy(0, 600 * (step + 1)), i);
      // eslint-disable-next-line playwright/no-wait-for-timeout -- incremental scroll wait
      await page.waitForTimeout(1000);
    }

    await expect(nearbyHeading).toBeVisible({ timeout: 15000 });

    // Scroll heading into view to ensure cards are rendered
    await nearbyHeading.scrollIntoViewIfNeeded();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for cards to hydrate
    await page.waitForTimeout(2000);

    // Get the full text content of the nearby section and look for skill levels.
    // SurfSpotCard renders skill levels as text spans like "Advanced", "Intermediate", etc.
    // We use page.evaluate to find the section and extract text from card elements.
    const sectionText = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2'));
      const nearbyH2 = headings.find(h => /nearby surf spots/i.test(h.textContent || ''));
      if (!nearbyH2) return '';
      // The section is the parent element of the heading
      const section = nearbyH2.closest('section') || nearbyH2.parentElement;
      return section?.textContent || '';
    });

    // Check that at least one known skill level appears in the section text
    const foundSkillLevels = KNOWN_SKILL_LEVELS.filter(level => sectionText.includes(level));

    expect(
      foundSkillLevels.length,
      `Expected at least one real skill level in nearby spots section. ` +
      `Found text contains: ${sectionText.substring(0, 500)}...`
    ).toBeGreaterThan(0);

    // Verify "All levels" is NOT the only skill indicator (some cards may still say it)
    const allLevelsCount = (sectionText.match(/All levels/g) || []).length;
    const realSkillCount = foundSkillLevels.reduce((count, level) => {
      return count + (sectionText.match(new RegExp(level, 'g')) || []).length;
    }, 0);

    expect(
      realSkillCount,
      `Expected real skill levels to appear. Found ${allLevelsCount} "All levels" and ${realSkillCount} real skill levels.`
    ).toBeGreaterThan(0);
  });
});
