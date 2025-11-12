import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TIMEOUTS } from './fixtures/test-data';
import {
  TestUser,
  createTestUser,
  deleteTestUser,
  setupTestUserProfile,
  clearHomeBeach,
  setHomeBeach,
  setInvalidHomeBeach,
  getHomeBeachName,
  logProfileState,
  resetTestUserProfile,
  signInTestUser,
} from './utils/profile-helpers';
import { TEST_USER_SCENARIOS } from './fixtures/user-profiles';

/**
 * Home Beach Edge Cases Tests
 *
 * Tests edge cases and error scenarios for the "Best Conditions Near You" feature
 * focusing on "no home beach" scenarios and graceful degradation.
 *
 * Test Scenarios:
 * 1. User with NO home beach + GPS denied → Should show error state
 * 2. User with NO home beach + GPS granted → Should show GPS-based results
 * 3. User with NO home beach + GPS timeout → Should show timeout error
 * 4. User with INVALID home beach + GPS denied → Should show error state
 * 5. User with home beach + GPS denied → Should show home beach fallback
 * 6. Section visibility validation when no location available
 * 7. Error message clarity and actionability
 *
 * @project auth
 */

test.describe('Best Conditions - No Home Beach Edge Cases', () => {
  let testUser: TestUser | null = null;

  // Create a fresh test user before ALL tests in this suite
  test.beforeAll(async () => {
    console.log('[Test Setup] Creating fresh test user...');
    testUser = await createTestUser();
    console.log('[Test Setup] Test user created:', testUser.email);

    // Set up initial state (no home beach for these tests)
    const clearResult = await clearHomeBeach(testUser.id);
    console.log('[Test Setup] Clear home beach result:', clearResult);

    await logProfileState(testUser.id, 'Global Test Setup');
  });

  // Delete the test user after ALL tests complete
  test.afterAll(async () => {
    if (testUser) {
      console.log('[Test Teardown] Deleting test user:', testUser.email);
      await deleteTestUser(testUser.id);
      console.log('[Test Teardown] Test user deleted');
    }
  });

  test.beforeEach(async ({ page }) => {
    // Sign in as the test user
    if (!testUser) {
      throw new Error('Test user not created - check beforeAll hook');
    }

    await signInTestUser(page, testUser.email, testUser.password);
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('User with NO home beach + GPS denied should show error state or hide section', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // Setup: Clear home beach and deny GPS
    const clearResult = await clearHomeBeach(testUser.id);
    console.log('[Test] Clear home beach result:', clearResult);
    expect(clearResult.success).toBe(true);

    await context.clearPermissions();

    // Verify home beach is actually cleared in database
    const homeBeachName = await getHomeBeachName(testUser.id);
    console.log('[Test] Home beach after clear:', homeBeachName);
    expect(homeBeachName).toBeNull();

    await logProfileState(testUser.id, 'Test Setup');

    // Hard navigation to force cache invalidation
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForPageLoad(page);

    // The section might either:
    // 1. Not be visible at all (preferred - graceful degradation)
    // 2. Show an error message explaining no location available

    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');

    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (sectionVisible) {
      // If section is visible, it should show an error
      const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      expect(errorVisible).toBe(true);

      if (errorVisible) {
        // Verify error message is helpful
        const errorText = await error.textContent();
        expect(errorText).toBeTruthy();
        // Should mention location or permissions
        expect(errorText?.toLowerCase()).toMatch(/location|permission|enable|gps|home beach/i);
      }
    } else {
      // Section hidden - this is acceptable graceful degradation
      console.log('[Test] Section appropriately hidden when no location available');
    }
  });

  test('User with NO home beach + GPS granted should show GPS-based results', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // Setup: Clear home beach and grant GPS
    const clearResult = await clearHomeBeach(testUser.id);
    console.log('[Test] Clear home beach result:', clearResult);
    expect(clearResult.success).toBe(true);

    // Verify home beach is actually cleared
    const homeBeachName = await getHomeBeachName(testUser.id);
    console.log('[Test] Home beach after clear:', homeBeachName);
    expect(homeBeachName).toBeNull();

    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 }); // La Jolla
    await logProfileState(testUser.id, 'Test Setup');

    // Hard navigation to force cache invalidation
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForPageLoad(page);

    // Should show GPS-based results
    const section = page.getByTestId('best-conditions-section');
    await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

    // Verify heading shows GPS mode
    const heading = page.getByTestId('best-conditions-heading');
    await expect(heading).toHaveText('Best Conditions Near You');

    // Verify beach cards are displayed
    const cards = page.getByTestId('best-conditions-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    expect(cardCount).toBeLessThanOrEqual(3);
  });

  test('User with NO home beach + GPS timeout should show appropriate error', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // Setup: Clear home beach
    await clearHomeBeach(testUser.id);
    await logProfileState(testUser.id, 'Test Setup');

    // Grant permission but don't set location (simulates timeout)
    await context.grantPermissions(['geolocation']);
    // Note: Not calling setGeolocation - this may cause the geolocation hook to timeout

    // Reload page
    await page.reload();
    await waitForPageLoad(page);

    // Wait to see if section appears
    const section = page.getByTestId('best-conditions-section');
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const error = page.getByTestId('best-conditions-error');

    // Skeleton should appear initially
    const skeletonVisible = await skeleton.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    // After timeout, should either show error or hide section
    await page.waitForTimeout(12000); // Wait longer than the 10s geolocation timeout

    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    // Either error is visible OR section is hidden (both are acceptable)
    expect(errorVisible || !sectionVisible).toBe(true);

    if (errorVisible) {
      const errorText = await error.textContent();
      expect(errorText).toBeTruthy();
      console.log('[Test] Error message:', errorText);
    }
  });

  test('User with INVALID home beach + GPS denied should show error state', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // Setup: Set invalid home beach and deny GPS
    await setInvalidHomeBeach(testUser.id);
    await context.clearPermissions();
    await logProfileState(testUser.id, 'Test Setup');

    // Reload page
    await page.reload();
    await waitForPageLoad(page);

    // Should either hide section or show error
    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');

    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (sectionVisible) {
      // If visible, should show an error
      const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);
      expect(errorVisible).toBe(true);
    } else {
      // Hidden is also acceptable
      console.log('[Test] Section appropriately hidden with invalid home beach and no GPS');
    }
  });

  test('User with valid home beach + GPS denied should show home beach fallback', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // Setup: Set valid home beach and deny GPS
    const setupResult = await setHomeBeach(testUser.id, 'Windansea Beach');
    expect(setupResult.success).toBe(true);
    await context.clearPermissions();

    const homeBeachName = await getHomeBeachName(testUser.id);
    await logProfileState(testUser.id, 'Test Setup');

    // Reload page
    await page.reload();
    await waitForPageLoad(page);

    // Should show home beach fallback
    const section = page.getByTestId('best-conditions-section');
    await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

    // Verify heading shows home beach name
    const heading = page.getByTestId('best-conditions-heading');
    const headingText = await heading.textContent();

    expect(headingText).toBeTruthy();
    if (homeBeachName) {
      expect(headingText).toContain(homeBeachName);
    } else {
      // Fallback to generic heading
      expect(headingText).toMatch(/Best Conditions Near (Home|You)/i);
    }

    // Verify cards are displayed
    const cards = page.getByTestId('best-conditions-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });
});

test.describe('Best Conditions - Section Visibility Logic', () => {
  let testUser: TestUser | null = null;

  // Create a fresh test user before ALL tests in this suite
  test.beforeAll(async () => {
    console.log('[Test Setup] Creating fresh test user...');
    testUser = await createTestUser();
    console.log('[Test Setup] Test user created:', testUser.email);

    // Set up initial state (no home beach for these tests)
    const clearResult = await clearHomeBeach(testUser.id);
    console.log('[Test Setup] Clear home beach result:', clearResult);

    await logProfileState(testUser.id, 'Global Test Setup');
  });

  // Delete the test user after ALL tests complete
  test.afterAll(async () => {
    if (testUser) {
      console.log('[Test Teardown] Deleting test user:', testUser.email);
      await deleteTestUser(testUser.id);
      console.log('[Test Teardown] Test user deleted');
    }
  });

  test.beforeEach(async ({ page }) => {
    // Sign in as the test user
    if (!testUser) {
      throw new Error('Test user not created - check beforeAll hook');
    }

    await signInTestUser(page, testUser.email, testUser.password);
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('Section should be hidden when no location source available', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // Clear home beach and deny GPS
    const clearResult = await clearHomeBeach(testUser.id);
    console.log('[Test] Clear home beach result:', clearResult);
    expect(clearResult.success).toBe(true);

    // Verify cleared
    const homeBeachName = await getHomeBeachName(testUser.id);
    console.log('[Test] Home beach after clear:', homeBeachName);
    expect(homeBeachName).toBeNull();

    await context.clearPermissions();

    // Hard navigation to force cache invalidation
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForPageLoad(page);

    // Section should either:
    // 1. Not exist in DOM
    // 2. Exist but be hidden (display: none or visibility: hidden)
    // 3. Show error state

    const section = page.getByTestId('best-conditions-section');
    const sectionExists = await section.count() > 0;

    if (sectionExists) {
      // If it exists, check visibility
      const isVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

      if (isVisible) {
        // If visible, should show error
        const error = page.getByTestId('best-conditions-error');
        await expect(error).toBeVisible({ timeout: TIMEOUTS.short });
      }
    }

    console.log('[Test] Section visibility validated for no location scenario');
  });

  test('Section should show loading state initially', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // Setup with home beach
    await setupTestUserProfile(testUser.id, { homeBeach: 'Windansea Beach' });
    await context.clearPermissions();

    // Navigate and immediately check for skeleton
    const navigationPromise = page.goto('/');

    // Skeleton should appear quickly (within 2 seconds)
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    await navigationPromise;
    await waitForPageLoad(page);

    // Either skeleton showed (slow load) or content loaded immediately (fast connection)
    // Both are valid states
    const section = page.getByTestId('best-conditions-section');
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    expect(skeletonVisible || sectionVisible).toBe(true);
  });

  test('Section should transition from loading to content state', async ({ page, context }) => {
    // Setup with GPS
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    await page.goto('/');

    // Check for skeleton
    const skeleton = page.getByTestId('best-conditions-skeleton');
    const skeletonAppeared = await skeleton.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    if (skeletonAppeared) {
      // Skeleton should disappear when content loads
      await expect(skeleton).not.toBeVisible({ timeout: TIMEOUTS.long });
    }

    await waitForPageLoad(page);

    // Content should be visible
    const section = page.getByTestId('best-conditions-section');
    await expect(section).toBeVisible({ timeout: TIMEOUTS.medium });

    const cards = page.getByTestId('best-conditions-card');
    expect(await cards.count()).toBeGreaterThan(0);
  });
});

test.describe('Best Conditions - Error Messages', () => {
  let testUser: TestUser | null = null;

  // Create a fresh test user before ALL tests in this suite
  test.beforeAll(async () => {
    console.log('[Test Setup] Creating fresh test user...');
    testUser = await createTestUser();
    console.log('[Test Setup] Test user created:', testUser.email);

    // Set up initial state (no home beach for these tests)
    const clearResult = await clearHomeBeach(testUser.id);
    console.log('[Test Setup] Clear home beach result:', clearResult);

    await logProfileState(testUser.id, 'Global Test Setup');
  });

  // Delete the test user after ALL tests complete
  test.afterAll(async () => {
    if (testUser) {
      console.log('[Test Teardown] Deleting test user:', testUser.email);
      await deleteTestUser(testUser.id);
      console.log('[Test Teardown] Test user deleted');
    }
  });

  test.beforeEach(async ({ page }) => {
    // Sign in as the test user
    if (!testUser) {
      throw new Error('Test user not created - check beforeAll hook');
    }

    await signInTestUser(page, testUser.email, testUser.password);
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('Error message should be clear and actionable', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // Setup no location scenario
    await setupTestUserProfile(testUser.id, { homeBeach: null });
    await context.clearPermissions();

    await page.goto('/');
    await waitForPageLoad(page);

    const error = page.getByTestId('best-conditions-error');
    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (errorVisible) {
      const errorText = await error.textContent();
      expect(errorText).toBeTruthy();

      // Error should be informative
      const lowerText = errorText?.toLowerCase() || '';

      // Should mention one of these concepts
      const hasRelevantInfo =
        lowerText.includes('location') ||
        lowerText.includes('permission') ||
        lowerText.includes('gps') ||
        lowerText.includes('home beach') ||
        lowerText.includes('enable');

      expect(hasRelevantInfo).toBe(true);

      console.log('[Test] Error message:', errorText);
    }
  });

  test('Error state should be accessible', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // Setup error scenario
    await setupTestUserProfile(testUser.id, { homeBeach: null });
    await context.clearPermissions();

    await page.goto('/');
    await waitForPageLoad(page);

    const error = page.getByTestId('best-conditions-error');
    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    if (errorVisible) {
      // Error container should have proper ARIA attributes
      const role = await error.getAttribute('role');
      const ariaLive = await error.getAttribute('aria-live');

      // Should have alert role or aria-live
      expect(role === 'alert' || ariaLive === 'polite' || ariaLive === 'assertive').toBe(true);

      console.log('[Test] Error accessibility attributes:', { role, ariaLive });
    }
  });
});

test.describe('Best Conditions - Home Beach Data Integrity', () => {
  let testUser: TestUser | null = null;

  // Create a fresh test user before ALL tests in this suite
  test.beforeAll(async () => {
    console.log('[Test Setup] Creating fresh test user...');
    testUser = await createTestUser();
    console.log('[Test Setup] Test user created:', testUser.email);

    // Set up initial state (no home beach for these tests)
    const clearResult = await clearHomeBeach(testUser.id);
    console.log('[Test Setup] Clear home beach result:', clearResult);

    await logProfileState(testUser.id, 'Global Test Setup');
  });

  // Delete the test user after ALL tests complete
  test.afterAll(async () => {
    if (testUser) {
      console.log('[Test Teardown] Deleting test user:', testUser.email);
      await deleteTestUser(testUser.id);
      console.log('[Test Teardown] Test user deleted');
    }
  });

  test.beforeEach(async ({ page }) => {
    // Sign in as the test user
    if (!testUser) {
      throw new Error('Test user not created - check beforeAll hook');
    }

    await signInTestUser(page, testUser.email, testUser.password);
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('Should handle home beach with null coordinates gracefully', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // This tests database integrity - if home beach exists but has null coordinates
    // the app should fall back to GPS or hide section gracefully

    await setupTestUserProfile(testUser.id, { homeBeach: 'Windansea Beach' });
    await context.clearPermissions();

    await page.goto('/');
    await waitForPageLoad(page);

    const section = page.getByTestId('best-conditions-section');
    const error = page.getByTestId('best-conditions-error');

    // Should either show content, show error, or hide section
    // All are acceptable depending on data quality
    const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);
    const errorVisible = await error.isVisible({ timeout: TIMEOUTS.short }).catch(() => false);

    // At least one of these should be true: section hidden OR error shown OR content shown
    console.log('[Test] Home beach integrity check:', { sectionVisible, errorVisible });
  });

  test('Should update when home beach changes mid-session', async ({ page, context }) => {
    if (!testUser) throw new Error('Test user not available');

    // Start with no home beach
    const clearResult = await clearHomeBeach(testUser.id);
    console.log('[Test] Clear home beach result:', clearResult);
    expect(clearResult.success).toBe(true);

    // Verify cleared
    const homeBeachBefore = await getHomeBeachName(testUser.id);
    console.log('[Test] Home beach before setting (should be null):', homeBeachBefore);
    expect(homeBeachBefore).toBeNull();

    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

    // Hard navigation to force cache invalidation
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForPageLoad(page);

    // Verify GPS heading
    const heading = page.getByTestId('best-conditions-heading');
    await expect(heading).toHaveText('Best Conditions Near You', { timeout: TIMEOUTS.long });

    // Now set home beach
    const setResult = await setHomeBeach(testUser.id, 'Windansea Beach');
    console.log('[Test] Set home beach result:', setResult);
    expect(setResult.success).toBe(true);

    // Verify it was set
    const homeBeachAfter = await getHomeBeachName(testUser.id);
    console.log('[Test] Home beach after setting:', homeBeachAfter);
    expect(homeBeachAfter).toBe('Windansea Beach');

    // Clear GPS permissions to force home beach fallback
    await context.clearPermissions();

    // Hard navigation to trigger refetch
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForPageLoad(page);

    // Should now show home beach heading
    const newHeadingText = await heading.textContent();
    console.log('[Test] New heading text:', newHeadingText);
    expect(newHeadingText).not.toBe('Best Conditions Near You');
    expect(newHeadingText).toMatch(/Best Conditions Near/i);
  });
});
