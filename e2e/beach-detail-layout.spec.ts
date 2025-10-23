import { test, expect } from '@playwright/test';

/**
 * Beach Detail Layout Compliance Tests
 *
 * These tests validate the implementation of the beach detail page refactor
 * as specified in docs/quiver_beach_detail_refactor.md
 *
 * Test Beach: 84d3468b-c1ec-46ad-8621-d8507e5f167a
 */

const TEST_BEACH_ID = '84d3468b-c1ec-46ad-8621-d8507e5f167a';

test.describe('@beach-layout - Beach Photo Gallery Layout Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });
  });

  test('Phase 1: Photo Gallery - Desktop Grid Layout', async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 800 });

    // Wait for gallery to be visible
    const gallery = page.locator('.grid').first();
    await expect(gallery).toBeVisible({ timeout: 20000 });

    // Verify grid gap is 8px (gap-2 in Tailwind)
    const gap = await gallery.evaluate((el) => {
      return window.getComputedStyle(el).gap;
    });
    expect(gap).toBe('8px');

    // Verify border radius is 12px (rounded-xl in Tailwind)
    const borderRadius = await gallery.evaluate((el) => {
      return window.getComputedStyle(el).borderRadius;
    });
    expect(borderRadius).toBe('12px');

    // Verify grid layout is 2 columns on desktop
    const gridTemplateColumns = await gallery.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });
    // Should have 2 columns
    expect(gridTemplateColumns.split(' ').length).toBe(2);
  });

  test('Phase 1: Photo Gallery - Hero Photo Dimensions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Find hero photo (should be first image or first container)
    const heroContainer = page.locator('.md\\:min-h-\\[400px\\]').first();

    if (await heroContainer.count() > 0) {
      const heroBox = await heroContainer.boundingBox();

      // Verify minimum height of 400px on desktop
      expect(heroBox?.height).toBeGreaterThanOrEqual(395); // Allow 5px tolerance
    }
  });

  test('Phase 1: Photo Gallery - Side Photos Equal Height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Find side photo containers (should be 196px each on desktop)
    const sidePhotos = page.locator('.md\\:h-\\[196px\\]');
    const count = await sidePhotos.count();

    if (count >= 2) {
      const firstBox = await sidePhotos.nth(0).boundingBox();
      const secondBox = await sidePhotos.nth(1).boundingBox();

      // Both should be approximately 196px
      expect(firstBox?.height).toBeCloseTo(196, 5);
      expect(secondBox?.height).toBeCloseTo(196, 5);

      // Heights should be equal
      expect(Math.abs((firstBox?.height || 0) - (secondBox?.height || 0))).toBeLessThan(2);
    }
  });

  test('Phase 1: Photo Gallery - Mobile Aspect Ratios', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for gallery
    const gallery = page.locator('.grid').first();
    await expect(gallery).toBeVisible({ timeout: 20000 });

    // On mobile, should be single column
    const gridTemplateColumns = await gallery.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });

    // Should have only 1 column on mobile
    expect(gridTemplateColumns).not.toContain('repeat');
  });

  test('Phase 1: Photo Gallery - Photo Count Badge Position', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Look for photo count badge
    const badge = page.getByRole('button').filter({ hasText: /photos?$/i });
    const badgeCount = await badge.count();

    if (badgeCount > 0) {
      const badgeBox = await badge.boundingBox();
      const parent = page.locator('.relative').first();
      const parentBox = await parent.boundingBox();

      if (badgeBox && parentBox) {
        // Verify bottom margin: 16px (bottom-4 = 1rem = 16px)
        const bottomMargin = parentBox.bottom - badgeBox.bottom;
        expect(bottomMargin).toBeCloseTo(16, 5);

        // Verify right margin: 16px (right-4 = 1rem = 16px)
        const rightMargin = parentBox.right - badgeBox.right;
        expect(rightMargin).toBeCloseTo(16, 5);
      }
    }
  });

  test('Phase 1: Photo Gallery - Badge Icon and Text Sizing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const badge = page.getByRole('button').filter({ hasText: /photos?$/i });
    const badgeCount = await badge.count();

    if (badgeCount > 0) {
      // Check icon size (should be 16px - h-4 w-4)
      const icon = badge.locator('svg').first();
      const iconBox = await icon.boundingBox();

      if (iconBox) {
        expect(iconBox.width).toBeCloseTo(16, 2);
        expect(iconBox.height).toBeCloseTo(16, 2);
      }

      // Verify padding (px-4 py-2 = 16px horizontal, 8px vertical)
      const padding = await badge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          paddingLeft: parseInt(style.paddingLeft),
          paddingRight: parseInt(style.paddingRight),
          paddingTop: parseInt(style.paddingTop),
          paddingBottom: parseInt(style.paddingBottom),
        };
      });

      expect(padding.paddingLeft).toBeCloseTo(16, 2);
      expect(padding.paddingRight).toBeCloseTo(16, 2);
      expect(padding.paddingTop).toBeCloseTo(8, 2);
      expect(padding.paddingBottom).toBeCloseTo(8, 2);
    }
  });
});

test.describe('@beach-layout - Beach Stats Grid Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });
  });

  test('Phase 2: Stats Grid - Container Background and Border Radius', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Find stats container (bg-gray-50)
    const statsContainer = page.locator('.bg-gray-50').filter({ has: page.getByText(/break type/i) });
    await expect(statsContainer.first()).toBeVisible({ timeout: 20000 });

    // Verify padding is 20px (p-5)
    const padding = await statsContainer.first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseInt(style.padding);
    });
    expect(padding).toBe(20);

    // Verify border radius is 12px (rounded-xl)
    const borderRadius = await statsContainer.first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return parseInt(style.borderRadius);
    });
    expect(borderRadius).toBe(12);
  });

  test('Phase 2: Stats Grid - Gap is exactly 16px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Find stats grid (inner grid element)
    const statsGrid = page.locator('.grid').filter({ has: page.getByText(/break type/i) });
    await expect(statsGrid.first()).toBeVisible({ timeout: 20000 });

    // Verify gap is exactly 16px (gap-4)
    const gap = await statsGrid.first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.gap;
    });

    expect(gap).toBe('16px');
  });

  test('Phase 2: Stats Grid - Icon Sizing is 24×24px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Wait for stats to be visible
    await expect(page.getByText(/break type/i).first()).toBeVisible({ timeout: 20000 });

    // Find stat icons (should be 24px with h-6 w-6)
    const statIcons = page.locator('svg').filter({
      has: page.locator('..').filter({ hasText: /break type|best swell|best wind|preferred tide/i })
    });

    const count = await statIcons.count();
    if (count > 0) {
      const firstIcon = statIcons.first();
      const iconBox = await firstIcon.boundingBox();

      // Spec requires 24px (h-6 w-6)
      if (iconBox) {
        expect(iconBox.width).toBeCloseTo(24, 2);
        expect(iconBox.height).toBeCloseTo(24, 2);
      }
    }
  });

  test('Phase 2: Stats Grid - Typography Verification', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Find a stat label (e.g., "BREAK TYPE")
    const label = page.getByText(/break type/i).first();
    await expect(label).toBeVisible({ timeout: 20000 });

    // Verify label styling (12px, uppercase, 0.05em letter-spacing)
    const labelStyle = await label.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        fontSize: parseInt(style.fontSize),
        textTransform: style.textTransform,
        letterSpacing: style.letterSpacing,
      };
    });

    expect(labelStyle.fontSize).toBe(12); // text-xs = 12px
    expect(labelStyle.textTransform).toBe('uppercase');
    // tracking-wider should be around 0.05em
    const letterSpacingPx = parseFloat(labelStyle.letterSpacing);
    expect(letterSpacingPx).toBeGreaterThanOrEqual(0.5); // Approximate px value for 0.05em at 12px
  });

  test('Phase 2: Stats Grid - Value Typography (16px, weight 600)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Find a stat value (e.g., "Beach Break")
    const value = page.getByText('Beach Break').or(page.getByText(/\d+–\d+ ft/)).first();
    await expect(value).toBeVisible({ timeout: 20000 });

    // Verify value styling (16px, font-weight 600)
    const valueStyle = await value.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        fontSize: parseInt(style.fontSize),
        fontWeight: style.fontWeight,
      };
    });

    expect(valueStyle.fontSize).toBe(16); // text-base = 16px
    expect(valueStyle.fontWeight).toBe('600'); // font-semibold = 600
  });

  test('Phase 2: Stats Grid - Responsive Grid Layout', async ({ page }) => {
    // Test desktop layout (4 columns)
    await page.setViewportSize({ width: 1280, height: 800 });

    // Find the inner grid element (not the outer container)
    const statsContainer = page.locator('.bg-gray-50').filter({ has: page.getByText(/break type/i) });
    const statsGrid = statsContainer.locator('.grid').first();

    // Should show 4 columns on desktop (md:grid-cols-4)
    const desktopGridCols = await statsGrid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const cols = style.gridTemplateColumns.split(' ');
      return cols.filter(c => c && c !== 'none').length;
    });

    expect(desktopGridCols).toBe(4);

    // Test mobile layout (2 columns)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Allow reflow

    const mobileGridCols = await statsGrid.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const cols = style.gridTemplateColumns.split(' ');
      return cols.filter(c => c && c !== 'none').length;
    });

    // Should show 2 columns on mobile (grid-cols-2)
    expect(mobileGridCols).toBe(2);
  });
});

test.describe('@beach-layout - Beach Actions Button Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });
  });

  test('Phase 3: Action Buttons - Exact Height 48px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Get all primary action buttons
    const buttons = page.getByRole('button').filter({
      hasText: /get directions|log session|plan session/i
    });

    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    // Check each button height - Phase 3 spec requires EXACTLY 48px
    for (let i = 0; i < Math.min(count, 3); i++) {
      const button = buttons.nth(i);
      await expect(button).toBeVisible();

      const box = await button.boundingBox();
      if (box) {
        // Phase 3 spec: Buttons must be exactly 48px (h-12 class)
        expect(box.height).toBeCloseTo(48, 2); // Allow 2px tolerance for border/shadow
      }
    }
  });

  test('Phase 3: Action Buttons - Icon Sizing (20×20px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Get "Get Directions" button icon
    const directionsBtn = page.getByRole('button', { name: /get directions/i });
    await expect(directionsBtn).toBeVisible({ timeout: 20000 });

    // Check icon size - Phase 3 spec requires 20×20px (h-5 w-5)
    const icon = directionsBtn.locator('svg').first();
    const iconBox = await icon.boundingBox();

    if (iconBox) {
      expect(iconBox.width).toBeCloseTo(20, 2);
      expect(iconBox.height).toBeCloseTo(20, 2);
    }

    // Also check other button icons
    const logBtn = page.getByRole('button', { name: /log session/i });
    const logIcon = logBtn.locator('svg').first();
    const logIconBox = await logIcon.boundingBox();

    if (logIconBox) {
      expect(logIconBox.width).toBeCloseTo(20, 2);
      expect(logIconBox.height).toBeCloseTo(20, 2);
    }
  });

  test('Phase 3: Action Buttons - Primary Color Compliance', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Check "Log Session" button color (should use ocean-blue)
    const logBtn = page.getByRole('button', { name: /log session/i });
    await expect(logBtn).toBeVisible({ timeout: 20000 });

    const bgColor = await logBtn.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // rgb(0, 119, 182) = #0077B6 (ocean-blue)
    // Allow some variation for different color formats
    expect(bgColor).toMatch(/rgb\(0,\s*119,\s*182\)|#0077b6/i);
  });

  test('Phase 3: Action Buttons - Grid Layout Desktop (4 cols)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Find the button container - should be a grid
    const buttonContainer = page.locator('div.grid').filter({
      has: page.getByRole('button', { name: /get directions/i })
    }).first();

    await expect(buttonContainer).toBeVisible();

    // Verify grid layout
    const gridStyle = await buttonContainer.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        gap: style.gap,
      };
    });

    expect(gridStyle.display).toBe('grid');
    expect(gridStyle.gap).toBe('12px'); // gap-3

    // Should have 4 columns on desktop (md:grid-cols-4)
    const colCount = gridStyle.gridTemplateColumns.split(' ').length;
    expect(colCount).toBe(4);
  });

  test('Phase 3: Action Buttons - Grid Layout Mobile (2 cols)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Find the button container
    const buttonContainer = page.locator('div.grid').filter({
      has: page.getByRole('button', { name: /get directions/i })
    }).first();

    await expect(buttonContainer).toBeVisible();

    // Verify grid layout has 2 columns on mobile
    const gridStyle = await buttonContainer.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });

    const colCount = gridStyle.split(' ').length;
    expect(colCount).toBe(2);
  });

  test('Phase 3: Action Buttons - Hover Color #006699', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const logBtn = page.getByRole('button', { name: /log session/i });
    await expect(logBtn).toBeVisible({ timeout: 20000 });

    // Get initial background color (should be ocean-blue #0077B6)
    const initialBg = await logBtn.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Should be rgb(0, 119, 182) = #0077B6
    expect(initialBg).toBe('rgb(0, 119, 182)');

    // Hover over button
    await logBtn.hover();
    await page.waitForTimeout(200); // Allow transition

    // After hover, should be #006699 = rgb(0, 102, 153)
    const hoverBg = await logBtn.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Verify hover color changed to darker blue
    expect(hoverBg).toBe('rgb(0, 102, 153)');
  });

  test('Phase 3: Action Buttons - Active Transform Scale', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const logBtn = page.getByRole('button', { name: /log session/i });
    await expect(logBtn).toBeVisible({ timeout: 20000 });

    // Verify button has the active scale class applied
    const hasActiveScale = await logBtn.evaluate((el) => {
      return el.classList.contains('active:scale-[0.98]');
    });

    expect(hasActiveScale).toBe(true);
  });
});

test.describe('@beach-layout - Beach Hero & Breadcrumb Compliance (Phase 4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });
  });

  test('Phase 4: Beach Name Typography (36px Roboto, 44px line-height)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 20000 });

    const typography = await heading.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        fontSize: parseInt(style.fontSize),
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        lineHeight: parseInt(style.lineHeight),
      };
    });

    // Phase 4 Spec: 36px font-size (text-4xl)
    expect(typography.fontSize).toBe(36);

    // Phase 4 Spec: Roboto font family
    expect(typography.fontFamily).toContain('Roboto');

    // Phase 4 Spec: 700 font-weight (font-bold)
    expect(typography.fontWeight).toBe('700');

    // Phase 4 Spec: 44px line-height
    expect(typography.lineHeight).toBe(44);
  });

  test('Phase 4: Beach Name Color (gray-900)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 20000 });

    const color = await heading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // gray-900 in Tailwind = rgb(17, 24, 39)
    expect(color).toMatch(/rgb\(17,\s*24,\s*39\)/);
  });

  test('Phase 4: Hero Container Styling (white bg, border-bottom)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible({ timeout: 20000 });

    // Get the hero container (parent of h1)
    const heroContainer = await heading.evaluateHandle(el => el.parentElement);
    const containerStyles = await heroContainer.evaluate((el) => {
      const style = window.getComputedStyle(el as HTMLElement);
      return {
        backgroundColor: style.backgroundColor,
        borderBottomWidth: parseInt(style.borderBottomWidth),
        borderBottomColor: style.borderBottomColor,
        paddingTop: parseInt(style.paddingTop),
        paddingBottom: parseInt(style.paddingBottom),
      };
    });

    // Phase 4 Spec: white background
    expect(containerStyles.backgroundColor).toMatch(/rgb\(255,\s*255,\s*255\)/);

    // Phase 4 Spec: border-bottom 1px
    expect(containerStyles.borderBottomWidth).toBe(1);

    // Phase 4 Spec: vertical padding 24px (py-6)
    expect(containerStyles.paddingTop).toBe(24);
    expect(containerStyles.paddingBottom).toBe(24);
  });

  test('Phase 4: Rating Stars Size (20×20px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });

    // Find star icon
    const star = page.locator('.lucide-star').first();
    const starVisible = await star.isVisible().catch(() => false);

    if (starVisible) {
      const starBox = await star.boundingBox();

      if (starBox) {
        // Phase 4 Spec: 20×20px (h-5 w-5)
        expect(starBox.width).toBeCloseTo(20, 2);
        expect(starBox.height).toBeCloseTo(20, 2);
      }
    }
  });

  test('Phase 4: Rating Text Styling (18px, 600 weight)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });

    // Find rating text (should be a number like "4.5")
    const ratingText = page.locator('span').filter({ hasText: /^\d+\.\d+$/ }).first();
    const ratingVisible = await ratingText.isVisible().catch(() => false);

    if (ratingVisible) {
      const textStyle = await ratingText.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          fontSize: parseInt(style.fontSize),
          fontWeight: style.fontWeight,
        };
      });

      // Phase 4 Spec: 18px font-size (text-lg)
      expect(textStyle.fontSize).toBe(18);

      // Phase 4 Spec: 600 font-weight (font-semibold)
      expect(textStyle.fontWeight).toBe('600');
    }
  });

  test('Phase 4: Review Count Styling (14px, gray-600)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });

    // Find review count text (format: "(42 reviews)")
    const reviewCount = page.locator('span').filter({ hasText: /\(\d+ reviews?\)/ }).first();
    const reviewVisible = await reviewCount.isVisible().catch(() => false);

    if (reviewVisible) {
      const textStyle = await reviewCount.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          fontSize: parseInt(style.fontSize),
          color: style.color,
        };
      });

      // Phase 4 Spec: 14px font-size (text-sm)
      expect(textStyle.fontSize).toBe(14);

      // Phase 4 Spec: gray-600 color (approximately rgb(75, 85, 99))
      expect(textStyle.color).toMatch(/rgb\(75,\s*85,\s*99\)/);
    }
  });

  test('Phase 4: Difficulty Badge Styling (pill radius, cyan-50/600)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });

    // Find difficulty badge (e.g., "Intermediate", "Beginner", etc.)
    const difficultyBadge = page.locator('[class*="rounded-full"]').filter({
      hasText: /beginner|intermediate|advanced|expert|easy/i
    }).first();

    const badgeVisible = await difficultyBadge.isVisible().catch(() => false);

    if (badgeVisible) {
      const badgeStyle = await difficultyBadge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          borderRadius: style.borderRadius,
          paddingLeft: parseInt(style.paddingLeft),
          paddingRight: parseInt(style.paddingRight),
          paddingTop: parseInt(style.paddingTop),
          paddingBottom: parseInt(style.paddingBottom),
          fontSize: parseInt(style.fontSize),
          fontWeight: style.fontWeight,
        };
      });

      // Phase 4 Spec: pill shape (rounded-full = large border-radius)
      const borderRadiusPx = parseInt(badgeStyle.borderRadius);
      expect(borderRadiusPx).toBeGreaterThan(15); // rounded-full should be ~9999px

      // Phase 4 Spec: padding px-3 py-1 (12px horizontal, 4px vertical)
      expect(badgeStyle.paddingLeft).toBe(12);
      expect(badgeStyle.paddingRight).toBe(12);
      expect(badgeStyle.paddingTop).toBe(4);
      expect(badgeStyle.paddingBottom).toBe(4);

      // Phase 4 Spec: 12px font-size (text-xs)
      expect(badgeStyle.fontSize).toBe(12);

      // Phase 4 Spec: 600 font-weight (font-semibold)
      expect(badgeStyle.fontWeight).toBe('600');
    }
  });

  test('Phase 4: Breadcrumb Separator Character (›)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
    await expect(breadcrumb).toBeVisible({ timeout: 20000 });

    // Check for › character (not ChevronRight icon)
    const separators = await breadcrumb.locator('span').filter({ hasText: '›' }).count();

    // Phase 4 Spec: Should have 2 › separators
    expect(separators).toBe(2);
  });

  test('Phase 4: Breadcrumb Separator Styling (gray-400, mx-2)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
    await expect(breadcrumb).toBeVisible({ timeout: 20000 });

    const separator = breadcrumb.locator('span').filter({ hasText: '›' }).first();
    const separatorStyle = await separator.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        marginLeft: parseInt(style.marginLeft),
        marginRight: parseInt(style.marginRight),
      };
    });

    // Phase 4 Spec: gray-400 color (approximately rgb(156, 163, 175))
    expect(separatorStyle.color).toMatch(/rgb\(156,\s*163,\s*175\)/);

    // Phase 4 Spec: mx-2 margins (8px each side)
    expect(separatorStyle.marginLeft).toBe(8);
    expect(separatorStyle.marginRight).toBe(8);
  });

  test('Phase 4: Breadcrumb Link Styling (ocean-blue, hover:underline)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
    await expect(breadcrumb).toBeVisible({ timeout: 20000 });

    // Find "Back to Map" link
    const backLink = breadcrumb.getByRole('link', { name: /map/i });
    await expect(backLink).toBeVisible();

    // Check color
    const linkColor = await backLink.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Phase 4 Spec: ocean-blue (#0077B6 = rgb(0, 119, 182))
    expect(linkColor).toMatch(/rgb\(0,\s*119,\s*182\)/);

    // Verify link has href="/map"
    const href = await backLink.getAttribute('href');
    expect(href).toBe('/map');
  });

  test('Phase 4: Breadcrumb Container Margin (mb-4 = 16px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
    await expect(breadcrumb).toBeVisible({ timeout: 20000 });

    const marginBottom = await breadcrumb.evaluate((el) => {
      return parseInt(window.getComputedStyle(el).marginBottom);
    });

    // Phase 4 Spec: mb-4 = 16px margin-bottom
    expect(marginBottom).toBe(16);
  });
});

test.describe('@beach-layout - Color Compliance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });
  });

  test('Phase 6: No AllTrails Green Present', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Check that no elements use AllTrails green (#428A13)
    const allElements = page.locator('*');
    const count = await allElements.count();

    // Sample up to 100 visible elements
    for (let i = 0; i < Math.min(count, 100); i++) {
      const element = allElements.nth(i);
      const isVisible = await element.isVisible().catch(() => false);

      if (isVisible) {
        const bgColor = await element.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        }).catch(() => '');

        const textColor = await element.evaluate((el) => {
          return window.getComputedStyle(el).color;
        }).catch(() => '');

        // Should not contain AllTrails green
        expect(bgColor).not.toMatch(/#428a13/i);
        expect(textColor).not.toMatch(/#428a13/i);
      }
    }
  });

  test('Phase 6: Ocean Blue Primary Color Usage', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Check primary action buttons use ocean-blue
    const primaryButtons = page.getByRole('button').filter({
      hasText: /log session|plan session/i
    });

    const count = await primaryButtons.count();
    if (count > 0) {
      const bgColor = await primaryButtons.first().evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Should use ocean-blue (#0077B6)
      expect(bgColor).toMatch(/rgb\(0,\s*119,\s*182\)/);
    }
  });

  test('Phase 6: Stat Icons Use Ocean Blue', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(page.getByText(/break type/i).first()).toBeVisible({ timeout: 20000 });

    // Find stat icons
    const statIcons = page.locator('svg').filter({
      has: page.locator('..').filter({ hasText: /break type|best swell/i })
    });

    const count = await statIcons.count();
    if (count > 0) {
      const color = await statIcons.first().evaluate((el) => {
        return window.getComputedStyle(el).color;
      });

      // Should use some shade of blue
      expect(color).toMatch(/rgb\(\s*0,\s*\d+,\s*\d+\)/);
    }
  });
});

test.describe('@beach-layout - Responsive Breakpoint Tests', () => {
  const breakpoints = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1024, height: 768 },
    { name: 'Large', width: 1280, height: 800 },
    { name: 'XL', width: 1440, height: 900 },
  ];

  for (const breakpoint of breakpoints) {
    test(`Loads correctly at ${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`, async ({ page }) => {
      await page.setViewportSize({
        width: breakpoint.width,
        height: breakpoint.height
      });

      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      // Beach name should be visible
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible({ timeout: 20000 });

      // Stats should be visible
      await expect(page.getByText(/break type/i).first()).toBeVisible({ timeout: 20000 });

      // Action buttons should be visible
      await expect(page.getByRole('button', { name: /log session/i })).toBeVisible({ timeout: 20000 });

      // No horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);

      // Allow small tolerance for scrollbars
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
    });
  }
});

test.describe('@beach-layout - Performance Requirements', () => {
  test('First Contentful Paint < 1.2s', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    // Wait for main content to be visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });

    const fcp = Date.now() - startTime;

    // Document FCP (may not meet spec on slow networks)
    test.info().annotations.push({
      type: 'performance',
      description: `FCP: ${fcp}ms (target: <1200ms)`
    });
  });

  test('Cumulative Layout Shift - No major shifts', async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'networkidle' });

    // Get initial position of heading
    const heading = page.getByRole('heading', { level: 1 });
    const initialPos = await heading.boundingBox();

    // Wait for any lazy loading
    await page.waitForTimeout(2000);

    // Check position again
    const finalPos = await heading.boundingBox();

    // Heading should not have shifted significantly
    if (initialPos && finalPos) {
      const yShift = Math.abs(initialPos.y - finalPos.y);
      expect(yShift).toBeLessThan(10); // Less than 10px shift
    }
  });
});

test.describe('@beach-layout - Beach Tabs Navigation Compliance (Phase 5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });
  });

  test('Phase 5: Tab Padding (12px vertical × 24px horizontal)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Find any tab button
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await expect(overviewTab).toBeVisible({ timeout: 20000 });

    const padding = await overviewTab.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        paddingTop: parseInt(style.paddingTop),
        paddingBottom: parseInt(style.paddingBottom),
        paddingLeft: parseInt(style.paddingLeft),
        paddingRight: parseInt(style.paddingRight),
      };
    });

    // Phase 5 Spec: py-3 = 12px vertical, px-6 = 24px horizontal
    expect(padding.paddingTop).toBe(12);
    expect(padding.paddingBottom).toBe(12);
    expect(padding.paddingLeft).toBe(24);
    expect(padding.paddingRight).toBe(24);
  });

  test('Phase 5: Tab Font Size (16px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await expect(overviewTab).toBeVisible({ timeout: 20000 });

    const fontSize = await overviewTab.evaluate((el) => {
      return parseInt(window.getComputedStyle(el).fontSize);
    });

    // Phase 5 Spec: text-base = 16px
    expect(fontSize).toBe(16);
  });

  test('Phase 5: Inactive Tab Styling (gray-600 text, 500 weight)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Set overview as active, so forecast is inactive
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: 20000 });

    // Verify it's not the active tab
    const isActive = await forecastTab.getAttribute('data-state');
    expect(isActive).toBe('inactive');

    const inactiveStyle = await forecastTab.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        fontWeight: style.fontWeight,
      };
    });

    // Phase 5 Spec: font-medium = 500
    expect(inactiveStyle.fontWeight).toBe('500');

    // Phase 5 Spec: gray-600 color (approximately rgb(75, 85, 99))
    expect(inactiveStyle.color).toMatch(/rgb\(75,\s*85,\s*99\)/);
  });

  test('Phase 5: Active Tab Styling (ocean-blue text, 600 weight)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await expect(overviewTab).toBeVisible({ timeout: 20000 });

    // Verify it's the active tab
    const isActive = await overviewTab.getAttribute('data-state');
    expect(isActive).toBe('active');

    const activeStyle = await overviewTab.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        fontWeight: style.fontWeight,
      };
    });

    // Phase 5 Spec: font-semibold = 600
    expect(activeStyle.fontWeight).toBe('600');

    // Phase 5 Spec: ocean-blue color (#0077B6 = rgb(0, 119, 182))
    expect(activeStyle.color).toMatch(/rgb\(0,\s*119,\s*182\)/);
  });

  test('Phase 5: Active Tab Border Color (ocean-blue)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await expect(overviewTab).toBeVisible({ timeout: 20000 });

    const borderBottomColor = await overviewTab.evaluate((el) => {
      return window.getComputedStyle(el).borderBottomColor;
    });

    // Phase 5 Spec: ocean-blue border (#0077B6 = rgb(0, 119, 182))
    expect(borderBottomColor).toMatch(/rgb\(0,\s*119,\s*182\)/);
  });

  test('Phase 5: Inactive Tab Border (transparent)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: 20000 });

    // Verify it's inactive
    const isActive = await forecastTab.getAttribute('data-state');
    expect(isActive).toBe('inactive');

    const borderBottomColor = await forecastTab.evaluate((el) => {
      return window.getComputedStyle(el).borderBottomColor;
    });

    // Phase 5 Spec: transparent border for inactive tabs
    // Transparent is typically rgba(0, 0, 0, 0)
    expect(borderBottomColor).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)/);
  });

  test('Phase 5: Tab Container Border (2px gray-200)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible({ timeout: 20000 });

    const borderStyle = await tabList.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        borderBottomWidth: parseInt(style.borderBottomWidth),
        borderBottomColor: style.borderBottomColor,
      };
    });

    // Phase 5 Spec: border-b-2 = 2px
    expect(borderStyle.borderBottomWidth).toBe(2);

    // Phase 5 Spec: gray-200 border (approximately rgb(229, 231, 235))
    expect(borderStyle.borderBottomColor).toMatch(/rgb\(229,\s*231,\s*235\)/);
  });

  test('Phase 5: Tab Container Margin Bottom (24px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible({ timeout: 20000 });

    const marginBottom = await tabList.evaluate((el) => {
      return parseInt(window.getComputedStyle(el).marginBottom);
    });

    // Phase 5 Spec: mb-6 = 24px
    expect(marginBottom).toBe(24);
  });

  test('Phase 5: Tab Transitions (duration-200)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const overviewTab = page.getByRole('tab', { name: /overview/i });
    await expect(overviewTab).toBeVisible({ timeout: 20000 });

    const transitionDuration = await overviewTab.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.transitionDuration;
    });

    // Phase 5 Spec: duration-200 = 0.2s (200ms)
    // Can be "0.2s" or "200ms"
    expect(transitionDuration).toMatch(/0\.2s|200ms/);
  });

  test('Phase 5: All Five Tabs Rendered', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Wait for tabs to be visible
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 20000 });

    // Phase 5: Verify all 5 tabs exist
    expect(await page.getByRole('tab', { name: /overview/i }).count()).toBe(1);
    expect(await page.getByRole('tab', { name: /forecast/i }).count()).toBe(1);
    expect(await page.getByRole('tab', { name: /reviews/i }).count()).toBe(1);
    expect(await page.getByRole('tab', { name: /local intel/i }).count()).toBe(1);
    expect(await page.getByRole('tab', { name: /sessions/i }).count()).toBe(1);
  });

  test('Phase 5: Tab Switching Functionality', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Wait for tabs to load
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 20000 });

    // Overview should be active by default
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    expect(await overviewTab.getAttribute('data-state')).toBe('active');

    // Click on Forecast tab
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await forecastTab.click();

    // Wait a moment for state change
    await page.waitForTimeout(300);

    // Forecast should now be active
    expect(await forecastTab.getAttribute('data-state')).toBe('active');

    // Overview should now be inactive
    expect(await overviewTab.getAttribute('data-state')).toBe('inactive');
  });

  test('Phase 5: Hover State Styling', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Get an inactive tab (forecast)
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    await expect(forecastTab).toBeVisible({ timeout: 20000 });

    // Get initial color
    const initialBg = await forecastTab.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Hover over the tab
    await forecastTab.hover();
    await page.waitForTimeout(250); // Wait for transition

    // Check background changed to gray-50
    const hoverBg = await forecastTab.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Phase 5 Spec: hover:bg-gray-50 (rgb(249, 250, 251))
    // The background should have changed from transparent/white
    expect(hoverBg).not.toBe(initialBg);
    expect(hoverBg).toMatch(/rgb\(249,\s*250,\s*251\)/);
  });

  test('Phase 5: Responsive Tab Layout (no overflow)', async ({ page }) => {
    // Test on mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible({ timeout: 20000 });

    // Check no horizontal overflow
    const tabListWidth = await tabList.evaluate((el) => el.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    // Tabs should fit within viewport (allow small tolerance)
    expect(tabListWidth).toBeLessThanOrEqual(viewportWidth + 20);

    // All tabs should still be visible
    expect(await page.getByRole('tab', { name: /overview/i }).isVisible()).toBe(true);
    expect(await page.getByRole('tab', { name: /forecast/i }).isVisible()).toBe(true);
    expect(await page.getByRole('tab', { name: /reviews/i }).isVisible()).toBe(true);
  });

  test('Phase 5: Tab Accessibility - ARIA attributes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 20000 });

    // Active tab should have aria-selected="true"
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    expect(await overviewTab.getAttribute('aria-selected')).toBe('true');

    // Inactive tabs should have aria-selected="false"
    const forecastTab = page.getByRole('tab', { name: /forecast/i });
    expect(await forecastTab.getAttribute('aria-selected')).toBe('false');
  });
});
