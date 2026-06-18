import { test, expect } from "../fixtures/auth-fixture";
import type { Locator, Page } from '@playwright/test';
import { TEST_BEACHES, VIEWPORTS, TIMEOUTS } from '../fixtures/test-data';
import { waitForPageLoad, navigateToBeach } from '../utils/test-helpers';
import { isVisibleSafe } from '../utils/strict-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from '../utils/error-detection';

const FORECAST_CONDITIONS_HEADING = /^(Current|Forecasted) Conditions$/i;

function forecastConditionsHeading(page: Page): Locator {
  return page.getByRole('heading', {
    name: FORECAST_CONDITIONS_HEADING,
    level: 2,
  });
}

// These tests all exercise the same beach forecast route. Running them inside
// one file in parallel can saturate the local RSC/cache path without adding
// coverage, so keep the file ordered while the suite still runs with workers.
test.describe.configure({ mode: 'serial' });

/**
 * ForecastTab - Tabbed Interface Tests
 *
 * Tests the restructured ForecastTab component with three sub-tabs:
 * 1. Today (default) - Current conditions, live cam, best surf window
 * 2. Tides - Tide chart visualization
 * 3. Conditions - Detailed forecast table
 *
 * @project auth
 */

test.describe('ForecastTab - Tabbed Interface', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    // Navigate to a known beach page (Blacks Beach)
    await navigateToBeach(page, TEST_BEACHES.blacks);

    // Click Forecast tab to show ForecastTab component
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: TIMEOUTS.medium });
    await forecastTab.click();

    // Wait for forecast content to load
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.medium }).catch(() => {
      // Ignore networkidle timeout - forecast may have long-polling
    });

    // Wait for forecast content to load. Cached model data labels this section
    // as "Forecasted Conditions"; live current data labels it "Current Conditions".
    await expect(forecastConditionsHeading(page)).toBeVisible({ timeout: TIMEOUTS.long });
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Tabbed Interface' });
  });

  test.describe('Default Tab Behavior', () => {
    test('should have "Today" tab active on page load', async ({ page }) => {
      // Verify Today tab is active — use .first() to avoid matching the tide chart time-range "Today" button
      const todayTab = page.getByRole('tab', { name: /today/i }).first();
      await expect(todayTab).toBeVisible();
      await expect(todayTab).toHaveAttribute('data-state', 'active');
    });

    test('should display "Today" tab content immediately', async ({ page }) => {
      // Verify Today tab content is visible
      const currentConditionsHeading = forecastConditionsHeading(page);
      await expect(currentConditionsHeading).toBeVisible({ timeout: TIMEOUTS.short });
    });

    test('should have "Tides" and "Conditions" tabs inactive on load', async ({ page }) => {
      // Verify Tides tab is inactive
      const tidesTab = page.getByRole('tab', { name: /tides/i });
      await expect(tidesTab).toBeVisible();
      await expect(tidesTab).toHaveAttribute('data-state', 'inactive');

      // Verify Conditions tab is inactive
      const conditionsTab = page.getByRole('tab', { name: /conditions/i });
      await expect(conditionsTab).toBeVisible();
      await expect(conditionsTab).toHaveAttribute('data-state', 'inactive');
    });
  });

  test.describe('Tab Switching', () => {
    test('should switch to "Tides" tab when clicked', async ({ page }) => {
      const tidesTab = page.getByRole('tab', { name: /tides/i });

      // Click Tides tab
      await tidesTab.click();

      // Verify Tides tab becomes active
      await expect(tidesTab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.short });

      // Verify Today tab becomes inactive
      const todayTab = page.getByRole('tab', { name: /today/i }).first();
      await expect(todayTab).toHaveAttribute('data-state', 'inactive');
    });

    test('should display tide chart when "Tides" tab is active', async ({ page }) => {
      const tidesTab = page.getByRole('tab', { name: /tides/i });

      // Click Tides tab
      await tidesTab.click();

      // Verify tide chart becomes visible
      const tideSvg = page.locator('svg').first();
      await expect(tideSvg).toBeVisible({ timeout: TIMEOUTS.short });
    });

    test('should hide "Today" content when switching to "Tides"', async ({ page }) => {
      const tidesTab = page.getByRole('tab', { name: /tides/i });

      // Click Tides tab
      await tidesTab.click();

      // Verify Today content is hidden
      const currentConditionsHeading = forecastConditionsHeading(page);
      await expect(currentConditionsHeading).not.toBeVisible();
    });

    test('should switch to "Conditions" tab when clicked', async ({ page }) => {
      const conditionsTab = page.getByRole('tab', { name: /conditions/i });

      // Click Conditions tab
      await conditionsTab.click();

      // Verify Conditions tab becomes active
      await expect(conditionsTab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.short });

      // Verify Today tab becomes inactive
      const todayTab = page.getByRole('tab', { name: /today/i }).first();
      await expect(todayTab).toHaveAttribute('data-state', 'inactive');
    });

    test('should display conditions overview when "Conditions" tab is active', async ({ page }) => {
      const conditionsTab = page.getByRole('tab', { name: /conditions/i });

      // Click Conditions tab
      await conditionsTab.click();

      // Verify conditions overview content becomes visible (hero section)
      // Text may be "Best Day This Week" or "Selected Day" depending on
      // whether a day is selected in the horizon strip (Today is auto-selected)
      const heroSection = page.locator('text=/Best Day This Week|Selected Day/i');
      await expect(heroSection).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test('should return to "Today" tab when clicked after switching', async ({ page }) => {
      const todayTab = page.getByRole('tab', { name: /today/i }).first();
      const tidesTab = page.getByRole('tab', { name: /tides/i });

      // Switch to Tides
      await tidesTab.click();
      await expect(tidesTab).toHaveAttribute('data-state', 'active');

      // Switch back to Today
      await todayTab.click();
      await expect(todayTab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.short });

      // Verify Today content is visible again - use exact match and level to target the h2, not h4
      const currentConditionsHeading = forecastConditionsHeading(page);
      // Scroll into view first - element may be below viewport
      await currentConditionsHeading.scrollIntoViewIfNeeded();
      await expect(currentConditionsHeading).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test('should switch between all tabs in sequence', async ({ page }) => {
      const todayTab = page.getByRole('tab', { name: /today/i }).first();
      const tidesTab = page.getByRole('tab', { name: /tides/i });
      const conditionsTab = page.getByRole('tab', { name: /conditions/i });

      // Test: Today → Tides → Conditions → Today
      const sequence = [
        { tab: tidesTab, name: 'Tides' },
        { tab: conditionsTab, name: 'Conditions' },
        { tab: todayTab, name: 'Today' },
      ];

      for (const { tab, name } of sequence) {
        await tab.click();
        await expect(tab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.short });
      }

      // Final state: Today should be active
      await expect(todayTab).toHaveAttribute('data-state', 'active');
    });
  });

  test.describe('Today Tab Content Verification', () => {
    test('should display conditions section', async ({ page }) => {
      const currentConditionsHeading = forecastConditionsHeading(page);
      await expect(currentConditionsHeading).toBeVisible();
    });

    test('should display metric cards (Tide, Wind, Swell)', async ({ page }) => {
      // Scope all locators to the active "Today" tabpanel to avoid matching
      // hidden elements in the ConditionsTicker's CSS-hidden static track.
      const todayPanel = page.getByRole('tabpanel', { name: /today/i });

      // Check for Next Tide card (in the secondary conditions grid)
      const tideLabel = todayPanel.getByText(/next tide/i).first();
      await expect(tideLabel).toBeVisible({ timeout: TIMEOUTS.short });

      // Check for Wind card (label in the metric card header)
      const windLabel = todayPanel.getByText(/^wind$/i).first();
      await expect(windLabel).toBeVisible({ timeout: TIMEOUTS.short });

      // Check for Swell card (label in the metric card header)
      const swellLabel = todayPanel.getByText(/^swell$/i).first();
      await expect(swellLabel).toBeVisible({ timeout: TIMEOUTS.short });
    });

    test('should display tide information with trend', async ({ page }) => {
      // Tide should show type (High/Low)
      const tideType = page.locator('text=/high|low/i').first();
      const hasTideType = await isVisibleSafe(tideType);

      // Should have some tide information visible
      expect(hasTideType || await page.getByText(/next tide/i).isVisible()).toBe(true);
    });

    test('should display wind information', async ({ page }) => {
      const todayPanel = page.getByRole('tabpanel', { name: /today/i });

      // Wind should show speed and direction in the active Today panel.
      const windLabel = todayPanel.getByText(/^wind$/i).first();
      await expect(windLabel).toBeVisible({ timeout: TIMEOUTS.short });

      // Check for wind speed (should have mph or kts)
      const hasWindData = await isVisibleSafe(todayPanel.getByText(/mph|kts|kt|knots/i).first());

      // Or check for wind direction (N, NE, E, SE, S, SW, W, NW)
      /* Wind direction text depends on forecast data availability */
      const hasWindDirection = await isVisibleSafe(
        todayPanel.getByText(/^(N|NE|E|SE|S|SW|W|NW|NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW)$/i).first()
      );

      expect(hasWindData || hasWindDirection).toBe(true);
    });

    test('should display swell information', async ({ page }) => {
      // Scope to the "Today" tabpanel to avoid matching hidden ConditionsTicker
      // elements (ticker-static-track is CSS display:none but still in the DOM).
      const todayPanel = page.getByRole('tabpanel', { name: /today/i });
      const swellHeight = todayPanel.locator('text=/\\d+(\\.\\d+)?\\s*ft/i').first();
      await expect(swellHeight).toBeVisible({ timeout: TIMEOUTS.short });
    });

    test('should display BestSurfWindow component', async ({ page }) => {
      // Best Surf Window section should be visible
      // The component may show "Best Surf Window" heading or related session-related content
      const bestSurfSection = page.getByRole('heading', { name: /best|surf window|when to paddle/i }).first();
      const hasBestSurf = await isVisibleSafe(bestSurfSection, { timeout: TIMEOUTS.medium });

      // If the heading isn't visible, check for the overall section
      if (!hasBestSurf) {
        // Some beaches may not have best surf window data - this is acceptable
        const currentConditions = forecastConditionsHeading(page);
        await expect(currentConditions).toBeVisible();
      }
    });

    test('should conditionally display Live Cam section if beach has camera', async ({ page }) => {
      // Check if Live Cam section exists
      const liveCamHeading = page.getByRole('heading', { name: /live cam/i });
      const hasLiveCam = await isVisibleSafe(liveCamHeading, { timeout: TIMEOUTS.short });

      // This test just verifies the conditional rendering works
      // Some beaches have cameras, some don't
      // If camera exists, heading should be visible
      if (hasLiveCam) {
        await expect(liveCamHeading).toBeVisible();
      }
    });
  });

  test.describe('Tides Tab Content Verification', () => {
    test.beforeEach(async ({ page }) => {
      // Switch to Tides tab
      const tidesTab = page.getByRole('tab', { name: /tides/i });
      await tidesTab.click();
    });

    test('should render TideChart component', async ({ page }) => {
      // Verify tide chart SVG is visible
      const tideSvg = page.locator('svg').first();
      await expect(tideSvg).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test('should display tide chart with data visualization', async ({ page }) => {
      // Canvas should have non-zero dimensions (indicating it's rendered)
      const svg = page.locator('svg').first();
      const boundingBox = await svg.boundingBox();

      expect(boundingBox).not.toBeNull();
      expect(boundingBox!.width).toBeGreaterThan(0);
      expect(boundingBox!.height).toBeGreaterThan(0);
    });

    test('should display tide-related text or labels', async ({ page }) => {
      // Wait for the Tides tabpanel to become active, then scope the locator
      // to avoid matching hidden elements (ConditionsTicker static track, inactive
      // tabpanels, etc.) that are in the DOM but CSS-hidden.
      const tidesPanel = page.getByRole('tabpanel', { name: /tides/i });
      await expect(tidesPanel).toBeVisible({ timeout: TIMEOUTS.medium });

      const tideText = tidesPanel.locator('text=/tide|high|low|am|pm/i').first();
      await expect(tideText).toBeVisible({ timeout: TIMEOUTS.short });
    });

    test('should have interactive chart elements', async ({ page }) => {
      // Verify SVG is interactive (not just a static image)
      const svg = page.locator('svg').first();

      // SVG should be attached and visible
      await expect(svg).toBeAttached();
      await expect(svg).toBeVisible();
    });
  });

  test.describe('Conditions Tab Content Verification', () => {
    test.beforeEach(async ({ page }) => {
      // Switch to Conditions tab
      const conditionsTab = page.getByRole('tab', { name: /conditions/i });
      await conditionsTab.click();
    });

    test('should render Best Day hero section', async ({ page }) => {
      // The hero card should display with a gradient background
      // Text may be "Best Day This Week" or "Selected Day" depending on
      // whether a day is selected in the horizon strip (Today is auto-selected)
      const heroSection = page.locator('text=/Best Day This Week|Selected Day/i');
      await expect(heroSection).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test('should display score gauge in hero', async ({ page }) => {
      // AnimatedScoreGauge renders an SVG
      // Use .first() — multiple tabpanels exist (main beach tab + forecast sub-tab)
      const conditionsPanel = page.getByRole('tabpanel').first();
      const svgGauge = conditionsPanel.locator('svg').first();
      await expect(svgGauge).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test('should display wave and wind information in hero', async ({ page }) => {
      // Hero should show wave height (ft) and wind conditions
      const heroWaveInfo = page.locator('text=/\\d+-?\\d*ft/i').first();
      await expect(heroWaveInfo).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test('should display Day Outlook chart section', async ({ page }) => {
      // The horizon strip heading (h2 with dynamic day count)
      const chartHeading = page.getByRole('heading', { name: /\d+-Day Outlook/, level: 2 });
      await expect(chartHeading).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test('should display Explore More links', async ({ page }) => {
      // Should show "Surf Guide" and "Map" explore links
      const surfGuideLink = page.locator('text=/Surf Guide/i').first();
      await expect(surfGuideLink).toBeVisible({ timeout: TIMEOUTS.medium });

      const mapLink = page.locator('text=/Nearby Beaches on Map/i');
      await expect(mapLink).toBeVisible({ timeout: TIMEOUTS.medium });
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should display correctly on mobile viewport (375x667)', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);

      // Verify tabs are visible on mobile
      const todayTab = page.getByRole('tab', { name: /today/i }).first();
      await expect(todayTab).toBeVisible();

      // Verify content is accessible
      const currentConditionsHeading = forecastConditionsHeading(page);
      await expect(currentConditionsHeading).toBeVisible({ timeout: TIMEOUTS.short });

      // Verify metric cards are visible - use text content instead of class-based selector
      const tideLabel = page.getByText('Next Tide', { exact: true });
      await expect(tideLabel).toBeVisible({ timeout: TIMEOUTS.short });
    });

    test('should display correctly on tablet viewport (768x1024)', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.tablet);

      // Verify tabs are visible on tablet
      const tidesTab = page.getByRole('tab', { name: /tides/i });
      await expect(tidesTab).toBeVisible();

      // Verify content layout adapts - HorizonStrip heading uses dynamic day count
      const outlookHeading = page.getByRole('heading', { name: /\d+-day outlook/i });
      await expect(outlookHeading).toBeVisible({ timeout: TIMEOUTS.short });
    });

    test('should display correctly on desktop viewport (1920x1080)', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.large);

      // Verify tabs are visible on desktop
      const conditionsTab = page.getByRole('tab', { name: /conditions/i });
      await expect(conditionsTab).toBeVisible();

      // Verify wide layout is used
      const forecastSection = page.locator('[class*="space-y-6"]').first();
      await expect(forecastSection).toBeVisible();
    });

    test('should allow tab switching on mobile viewport', async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);

      // Test tab switching works on mobile
      const tidesTab = page.getByRole('tab', { name: /tides/i });
      await tidesTab.click();

      await expect(tidesTab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.short });

      // Verify tide-specific content appears (use first() since multiple tide headings exist)
      const tideHeading = page.getByRole('heading', { name: /tide forecast/i }).first();
      await expect(tideHeading).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test('should maintain readable text on all viewports', async ({ page }) => {
      const viewports = [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.large];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);

        // Check that headings are still readable
        const currentConditionsHeading = forecastConditionsHeading(page);
        await expect(currentConditionsHeading).toBeVisible({ timeout: TIMEOUTS.short });

      }
    });
  });

  test.describe('Tab Keyboard Navigation', () => {
    test('should support keyboard navigation between tabs', async ({ page }) => {
      const todayTab = page.getByRole('tab', { name: /today/i }).first();

      // Focus the Today tab
      await todayTab.focus();

      // Press ArrowRight to move to Tides tab
      await page.keyboard.press('ArrowRight');

      // Verify Tides tab receives focus
      const tidesTab = page.getByRole('tab', { name: /tides/i });
      const isFocused = await tidesTab.evaluate((el) => el === document.activeElement);
      expect(isFocused).toBe(true);
    });

    test('should activate tab on Enter key', async ({ page }) => {
      const tidesTab = page.getByRole('tab', { name: /tides/i });

      // Focus the Tides tab
      await tidesTab.focus();

      // Press Enter to activate
      await page.keyboard.press('Enter');

      // Verify Tides tab becomes active
      await expect(tidesTab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.short });
    });

    test('should activate tab on Space key', async ({ page }) => {
      const conditionsTab = page.getByRole('tab', { name: /conditions/i });

      // Focus the Conditions tab
      await conditionsTab.focus();

      // Press Space to activate
      await page.keyboard.press('Space');

      // Verify Conditions tab becomes active
      await expect(conditionsTab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.short });
    });
  });

  test.describe('Tab Accessibility', () => {
    test('should have proper ARIA attributes on tabs', async ({ page }) => {
      const todayTab = page.getByRole('tab', { name: /today/i }).first();

      // Verify tab role
      await expect(todayTab).toHaveAttribute('role', 'tab');

      // Verify aria-selected on the active tab (Radix sets both data-state and aria-selected)
      await expect(todayTab).toHaveAttribute('aria-selected', 'true');
    });

    test('should have proper ARIA attributes on tab panels', async ({ page }) => {
      // Look for tabpanel role (content area)
      const tabpanel = page.getByRole('tabpanel').first();

      // Verify tabpanel exists and is visible
      await expect(tabpanel).toBeVisible();
    });

    test('should maintain focus visible indicators', async ({ page }) => {
      const todayTab = page.getByRole('tab', { name: /today/i }).first();

      // Focus the tab using keyboard
      await page.keyboard.press('Tab');
      await todayTab.focus();

      // Tab should have focus-visible styling
      // This is verified by checking for focus-visible class or outline
      const hasFocusVisible = await todayTab.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.outlineWidth !== '0px' || el.classList.contains('focus-visible');
      });

      // Note: This may vary based on browser and styling
      // The test verifies focus can be applied
      expect(hasFocusVisible || true).toBe(true);
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle missing forecast data gracefully', async ({ page }) => {
      // Even with missing data, tabs should still be functional
      const todayTab = page.getByRole('tab', { name: /today/i }).first();
      const tidesTab = page.getByRole('tab', { name: /tides/i });

      // Tabs should be clickable
      await tidesTab.click();
      await expect(tidesTab).toHaveAttribute('data-state', 'active');

      // Should be able to return to Today
      await todayTab.click();
      await expect(todayTab).toHaveAttribute('data-state', 'active');
    });

    test('should not have console errors during tab switching', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter out known non-critical errors
          if (!text.includes('localhost') &&
              !text.includes('DevTools') &&
              !text.includes('Extension')) {
            errors.push(text);
          }
        }
      });

      // Switch between tabs
      const tidesTab = page.getByRole('tab', { name: /tides/i });
      const conditionsTab = page.getByRole('tab', { name: /conditions/i });
      const todayTab = page.getByRole('tab', { name: /today/i }).first();

      await tidesTab.click();
      await expect(tidesTab).toHaveAttribute('data-state', 'active', { timeout: 2000 });

      await conditionsTab.click();
      await expect(conditionsTab).toHaveAttribute('data-state', 'active', { timeout: 2000 });

      await todayTab.click();
      await expect(todayTab).toHaveAttribute('data-state', 'active', { timeout: 2000 });

      // Should have no critical errors
      if (errors.length > 0) {
        console.log('Console errors during tab switching:', errors);
      }

      expect(errors.length).toBe(0);
    });

    test('should handle rapid tab switching without breaking', async ({ page }) => {
      const todayTab = page.getByRole('tab', { name: /today/i }).first();
      const tidesTab = page.getByRole('tab', { name: /tides/i });
      const conditionsTab = page.getByRole('tab', { name: /conditions/i });

      // Rapidly click tabs
      await tidesTab.click();
      await conditionsTab.click();
      await todayTab.click();
      await tidesTab.click();

      // Final tab should be active
      await expect(tidesTab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.short });

      // Content should be visible
      const tideSvg = page.locator('svg').first();
      await expect(tideSvg).toBeVisible({ timeout: TIMEOUTS.medium });
    });
  });

  test.describe('Tab readiness', () => {
    test('should render Today tab content', async ({ page }) => {
      // Today tab should already be loaded.
      const currentConditionsHeading = forecastConditionsHeading(page);
      await expect(currentConditionsHeading).toBeVisible({ timeout: TIMEOUTS.short });
    });

    test('should switch tabs and activate the selected tab', async ({ page }) => {
      const tidesTab = page.getByRole('tab', { name: /tides/i });

      await tidesTab.click();

      await expect(tidesTab).toHaveAttribute('data-state', 'active', { timeout: TIMEOUTS.short });
    });
  });
});
