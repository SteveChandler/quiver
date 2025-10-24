import { test, expect } from '@playwright/test';

test.describe('Landing Page - Navbar', () => {
  test('renders sticky navigation with logo and sign in button on desktop', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check for Quiver logo
    const logo = page.getByRole('link', { name: /quiver/i }).first();
    await expect(logo).toBeVisible({ timeout: 10000 });

    // Check for Sign In button (always visible on desktop)
    const signInButton = page.getByRole('link', { name: /sign in/i });
    await expect(signInButton).toBeVisible();

    // Sign Up button removed from desktop nav per AllTrails design
    // It's only available in mobile menu
  });

  test('explore dropdown menu shows categorized items', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Open explore dropdown (desktop view)
    const exploreButton = page.getByRole('button', { name: /explore/i }).first();
    
    // Check if button exists (desktop only)
    const isVisible = await exploreButton.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Explore dropdown not visible in current viewport (likely mobile)');
      return;
    }

    await exploreButton.click();

    // Check for category headers
    await expect(page.getByText(/regions/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/surf spot types/i)).toBeVisible();
    await expect(page.getByText(/conditions/i)).toBeVisible();

    // Check for some menu items
    await expect(page.getByRole('menuitem', { name: /san diego county/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /reef breaks/i })).toBeVisible();
  });

  test('mobile menu opens and closes correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Look for mobile menu toggle button (hamburger icon)
    const menuToggle = page.getByRole('button').filter({ has: page.locator('svg') }).first();
    
    // Click to open mobile menu
    await menuToggle.click();

    // Check for mobile menu content
    await expect(page.getByText(/explore/i).nth(1)).toBeVisible({ timeout: 5000 });

    // Mobile menu should show auth buttons (they're buttons that open modals, not links)
    const mobileLogIn = page.getByRole('button', { name: /log in/i }).last();
    const mobileSignUp = page.getByRole('button', { name: /sign up/i }).last();
    await expect(mobileLogIn).toBeVisible();
    await expect(mobileSignUp).toBeVisible();
  });

  test('quiver logo links back to home page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const logo = page.getByRole('link', { name: /quiver/i }).first();
    await expect(logo).toHaveAttribute('href', '/');
  });
});

test.describe('Landing Page - Hero Section', () => {
  test('search bar renders with correct placeholder', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('search functionality navigates to beach detail page for guests', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('Ocean Beach');
    await searchInput.press('Enter');

    // Search now navigates directly to beach detail page
    await expect(page).toHaveURL(/\/beach\/[0-9a-f-]+/, { timeout: 10000 });

    // Auth gate should appear for guests after some time
    await expect(page.getByText(/keep exploring with quiver/i)).toBeVisible({ timeout: 15000 });
  });

  test('explore nearby link navigates correctly without search query', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // "Explore nearby spots" is now a link (Button variant="link") not a button
    const exploreLink = page.getByRole('link', { name: /explore nearby/i });
    await expect(exploreLink).toBeVisible({ timeout: 10000 });
    
    await exploreLink.click();

    // Should navigate to map page when no search query
    await expect(page).toHaveURL(/\/map/, { timeout: 10000 });
  });

  test('explore nearby link with search query navigates to beach detail for guests', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('La Jolla');

    // "Explore nearby spots" is now a link (Button variant="link") not a button
    const exploreLink = page.getByRole('link', { name: /explore nearby/i });
    await exploreLink.click();

    // Search now navigates directly to beach detail page
    await expect(page).toHaveURL(/\/beach\/[0-9a-f-]+/, { timeout: 10000 });

    // Auth gate should appear for guests after some time
    await expect(page.getByText(/keep exploring with quiver/i)).toBeVisible({ timeout: 15000 });
  });

  test('feature highlights display correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check for feature highlights in hero
    await expect(page.getByText(/discover epic spots/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/live conditions/i)).toBeVisible();
    await expect(page.getByText(/community reviews/i).first()).toBeVisible();
  });

  test('hero carousel displays with rotating images', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check for carousel images (one should be visible)
    const carouselImages = page.locator('img[alt*="Surfer"], img[alt*="surfer"]');
    await expect(carouselImages.first()).toBeVisible({ timeout: 10000 });
    
    // Verify carousel has proper accessibility attributes
    const carousel = page.locator('[aria-roledescription="carousel"]');
    await expect(carousel).toBeVisible();
  });
});

test.describe('Landing Page - Content Sections', () => {
  test('featured beaches section displays cards with conditions', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for section heading
    const surfHighlightsHeading = page.getByRole('heading', { name: /featured surf spots|surf highlights/i });
    await expect(surfHighlightsHeading).toBeVisible({ timeout: 15000 });

    // Wait for surf spot cards to load (check for beach names or conditions)
    const beachCards = page.locator('[class*="grid"]').filter({ 
      has: page.locator('text=/ft/i')  // Cards should show wave heights
    });
    
    // Should have multiple cards
    await expect(beachCards.locator('text=/ft/i').first()).toBeVisible({ timeout: 15000 });

    // Check for condition indicators
    const swellIndicator = page.getByText(/ft/i).first();
    await expect(swellIndicator).toBeVisible();
  });

  test('explore all surf spots CTA navigates to map', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Scroll to CTA button
    const exploreAllButton = page.getByRole('link', { name: /explore all surf spots/i });
    await exploreAllButton.scrollIntoViewIfNeeded();
    await expect(exploreAllButton).toBeVisible({ timeout: 15000 });

    await exploreAllButton.click();

    // Should navigate to map
    await expect(page).toHaveURL(/\/map/, { timeout: 10000 });
  });

  test('activities section shows surf activity types', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Scroll to activities section
    const activitiesHeading = page.getByRole('heading', { name: /surf by activity/i });
    await activitiesHeading.scrollIntoViewIfNeeded();
    await expect(activitiesHeading).toBeVisible({ timeout: 15000 });

    // Check for activity types (should have at least a few)
    const activityCards = page.locator('text=/longboarding|reef breaks|point breaks|beginner/i');
    await expect(activityCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('CTA section shows join the lineup button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Scroll to CTA section
    const joinButton = page.getByRole('link', { name: /join the lineup|join free/i });
    await joinButton.scrollIntoViewIfNeeded();
    await expect(joinButton).toBeVisible({ timeout: 15000 });

    // Should link to sign up page
    await expect(joinButton).toHaveAttribute('href', /sign-up/);
  });

  test('footer section displays with tagline', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Check for tagline
    const tagline = page.getByText(/built for surfers.*powered by the swell/i);
    await expect(tagline).toBeVisible({ timeout: 10000 });

    // Check for footer sections
    await expect(page.getByText(/about quiver|about/i).last()).toBeVisible();
  });
});

test.describe('Landing Page - Bug Fixes Validation', () => {
  test('no duplicate AppHeader appears on landing page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // The landing page should use its own Navbar, not show AppHeader
    // Count how many navigation elements are present
    const navElements = page.locator('nav');
    const navCount = await navElements.count();

    // Should only have one navigation element (the Navbar)
    expect(navCount).toBeLessThanOrEqual(1);
  });

  test('no 500 errors when loading featured beaches', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const failedRequests: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 500) {
        failedRequests.push(response.url());
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Wait for featured beaches to load
    await page.waitForTimeout(3000);

    // Check for 500 errors in API calls
    const has500Error = failedRequests.some(url => url.includes('/api/beaches/featured'));
    expect(has500Error).toBe(false);
  });

  test('beach search with "blacks beach" normalizes text correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('blacks beach');
    await searchInput.press('Enter');

    // Search now navigates directly to beach detail page (text normalization working)
    await expect(page).toHaveURL(/\/beach\/[0-9a-f-]+/, { timeout: 10000 });

    // Auth gate should appear for guests after some time
    await expect(page.getByText(/keep exploring with quiver/i)).toBeVisible({ timeout: 15000 });
  });

  test('search navigation for guests goes to beach detail page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const searchInput = page.getByPlaceholder(/search by beach, spot, or region/i);
    await searchInput.fill('Tourmaline');
    await searchInput.press('Enter');

    // Search now navigates directly to beach detail page
    await page.waitForURL(/\/beach\/[0-9a-f-]+/, { timeout: 10000 });

    // Verify we're on the beach detail page
    const url = page.url();
    expect(url).toContain('/beach/');

    // Auth gate should appear for guests after some time
    await expect(page.getByText(/keep exploring with quiver/i)).toBeVisible({ timeout: 15000 });
  });
});

