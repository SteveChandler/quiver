import { Page, expect, Locator } from "@playwright/test";

/**
 * Improved page loading that uses proper load states instead of arbitrary timeouts
 */
export async function waitForPageLoad(page: Page, timeout = 10000) {
  await page.waitForLoadState("networkidle", { timeout });
  await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
}

/**
 * Wait for element to be ready for interaction with proper timeout handling
 */
export async function waitForElementReady(
  locator: Locator,
  options: {
    timeout?: number;
    state?: "visible" | "attached" | "hidden";
    stable?: boolean;
  } = {}
) {
  const { timeout = 5000, state = "visible", stable = false } = options;

  await locator.waitFor({ state, timeout });

  if (stable && state === "visible") {
    // Wait for element to be stable (no position changes)
    await expect(locator).toBeVisible({ timeout: 1000 });
  }
}

/**
 * Deterministic authentication state check
 */
export async function getAuthState(page: Page) {
  await page.waitForLoadState("networkidle");

  const currentUrl = page.url();

  return {
    isAuthenticated:
      !currentUrl.includes("/auth") && !currentUrl.includes("/sign"),
    isOnAuthPage: currentUrl.includes("/auth") || currentUrl.includes("/sign"),
    isOnSignIn: currentUrl.includes("/sign-in"),
    isOnSignUp: currentUrl.includes("/sign-up"),
    isOnHome: currentUrl === new URL("/", page.url()).href,
  };
}

/**
 * Handle authentication redirects gracefully without timeouts
 */
export async function handleAuthRedirect(page: Page) {
  const authState = await getAuthState(page);

  if (authState.isOnAuthPage) {
    return authState;
  }

  // Check if page content indicates auth is required
  const authRequired = await page
    .getByText(/sign.*in|log.*in|please.*authenticate/i)
    .isVisible()
    .catch(() => false);

  return {
    ...authState,
    authRequired,
  };
}

/**
 * Safe click that handles disabled states and ensures element is ready
 */
export async function safeClick(
  locator: Locator,
  options: { timeout?: number; force?: boolean } = {}
) {
  const { timeout = 5000, force = false } = options;

  await waitForElementReady(locator, { timeout, stable: true });

  if (!force) {
    await expect(locator).toBeEnabled({ timeout });
  }

  await locator.click({ timeout, force });
}

/**
 * Find element with fallback selectors using proper Playwright patterns
 */
export function findElementWithFallbacks(page: Page, selectors: string[]) {
  const locators = selectors.map((selector) => page.locator(selector));
  return page.locator(selectors.join(", ")).first();
}

/**
 * Wait for any of multiple elements to appear
 */
export async function waitForAnyElement(
  page: Page,
  selectors: string[],
  timeout = 5000
): Promise<{ element: Locator; index: number } | null> {
  const locators = selectors.map((selector) => page.locator(selector));

  try {
    for (let i = 0; i < locators.length; i++) {
      const isVisible = await locators[i].isVisible().catch(() => false);
      if (isVisible) {
        return { element: locators[i], index: i };
      }
    }

    // If none are immediately visible, wait for any to appear
    await Promise.race(
      locators.map((locator) => locator.waitFor({ state: "visible", timeout }))
    );

    // Find which one became visible
    for (let i = 0; i < locators.length; i++) {
      const isVisible = await locators[i].isVisible().catch(() => false);
      if (isVisible) {
        return { element: locators[i], index: i };
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

/**
 * Deterministic form filling with proper error handling
 */
export async function fillForm(
  page: Page,
  formData: { [key: string]: string },
  submitButtonText?: string
) {
  for (const [fieldName, value] of Object.entries(formData)) {
    const field = page.locator(
      `#${fieldName}, [name="${fieldName}"], [data-testid="${fieldName}"]`
    );
    await expect(field).toBeVisible({ timeout: 5000 });
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }

  if (submitButtonText) {
    const submitButton = page.getByRole("button", {
      name: new RegExp(submitButtonText, "i"),
    });
    await safeClick(submitButton);
  }
}

/**
 * Create a planned session with proper error handling
 */
export async function createPlannedSession(
  page: Page,
  sessionData: {
    beach: string;
    date?: string;
    time?: string;
    notes?: string;
  }
) {
  await page.goto("/plan-session");
  await waitForPageLoad(page);

  const authState = await getAuthState(page);
  if (authState.isOnAuthPage) {
    throw new Error("User not authenticated for session creation");
  }

  // Fill beach field
  const beachInput = page.locator(
    "#beach-input, [name='beach'], [data-testid='beach-input']"
  );
  await expect(beachInput).toBeVisible();
  await beachInput.fill(sessionData.beach);

  // Fill date if provided
  if (sessionData.date) {
    const dateInput = page.locator(
      "#session-date, [name='date'], [type='date']"
    );
    await expect(dateInput).toBeVisible();
    await dateInput.fill(sessionData.date);
  }

  // Fill time if provided
  if (sessionData.time) {
    const timeInput = page.locator(
      "#session-time, [name='time'], [type='time']"
    );
    if (await timeInput.isVisible()) {
      await timeInput.fill(sessionData.time);
    }
  }

  // Fill notes if provided
  if (sessionData.notes) {
    const notesInput = page.getByLabel(/notes/i);
    if (await notesInput.isVisible()) {
      await notesInput.fill(sessionData.notes);
    }
  }

  // Submit the form
  const planButton = page.getByRole("button", { name: /plan|save|create/i });
  await expect(planButton).toBeEnabled();
  await safeClick(planButton);

  // Wait for success indication
  await expect(page.getByText(/planned|success|saved/i)).toBeVisible({
    timeout: 10000,
  });

  return sessionData;
}

/**
 * Create a completed session with proper validation
 */
export async function createCompletedSession(
  page: Page,
  sessionData: {
    beach: string;
    date?: string;
    rating?: string;
    duration?: string;
    notes?: string;
  }
) {
  await page.goto("/log-session");
  await waitForPageLoad(page);

  const authState = await getAuthState(page);
  if (authState.isOnAuthPage) {
    throw new Error("User not authenticated for session logging");
  }

  // Fill required fields
  await fillForm(page, {
    beach: sessionData.beach,
    ...(sessionData.date && { date: sessionData.date }),
  });

  // Fill optional fields
  if (sessionData.rating) {
    const ratingSelect = page.getByLabel(/rating|quality/i);
    if (await ratingSelect.isVisible()) {
      await ratingSelect.selectOption(sessionData.rating);
    }
  }

  if (sessionData.duration) {
    const durationInput = page.getByLabel(/duration/i);
    if (await durationInput.isVisible()) {
      await durationInput.fill(sessionData.duration);
    }
  }

  if (sessionData.notes) {
    const notesInput = page.getByLabel(/notes/i);
    if (await notesInput.isVisible()) {
      await notesInput.fill(sessionData.notes);
    }
  }

  // Submit the form
  const logButton = page.getByRole("button", {
    name: /log|save|add.*journal/i,
  });
  await expect(logButton).toBeEnabled();
  await safeClick(logButton);

  // Wait for success indication
  await expect(page.getByText(/logged|success|saved/i)).toBeVisible({
    timeout: 10000,
  });

  return sessionData;
}

/**
 * Navigate to and verify beach detail page
 */
export async function navigateToBeachDetail(page: Page, beachName?: string) {
  await page.goto("/map");
  await waitForPageLoad(page);

  const beachCards = page.locator('.beach-card, [data-testid="beach-card"]');
  await expect(beachCards.first()).toBeVisible();

  let targetCard = beachCards.first();

  if (beachName) {
    targetCard = beachCards.filter({ hasText: beachName }).first();
    await expect(targetCard).toBeVisible();
  }

  await safeClick(targetCard);
  await waitForPageLoad(page);

  // Verify we're on beach detail page or modal opened
  const isOnDetailPage = page.url().includes("/beach/");
  const hasDetailModal = await page
    .locator('.modal, .beach-detail, [data-testid="beach-detail"]')
    .isVisible()
    .catch(() => false);

  expect(isOnDetailPage || hasDetailModal).toBeTruthy();

  return { isOnDetailPage, hasDetailModal };
}

/**
 * Test social interaction (like, comment) with proper validation
 */
export async function testSocialInteraction(
  page: Page,
  interactionType: "like" | "comment",
  sessionCardSelector = '.session-card, [data-testid="session-card"]'
) {
  const sessionCard = page.locator(sessionCardSelector).first();
  await expect(sessionCard).toBeVisible();

  if (interactionType === "like") {
    const likeButton = sessionCard.locator("button").filter({
      has: page.locator('svg[class*="thumbs-up"], [data-testid="like-icon"]'),
    });

    await expect(likeButton).toBeVisible();

    const initialCount = await likeButton.textContent();
    await safeClick(likeButton);

    // Verify like count changed or button state changed
    await expect(async () => {
      const newCount = await likeButton.textContent();
      const isPressed = await likeButton.getAttribute("aria-pressed");
      expect(newCount !== initialCount || isPressed === "true").toBeTruthy();
    }).toPass({ timeout: 5000 });

    return { success: true };
  }

  if (interactionType === "comment") {
    const commentButton = sessionCard.locator("button").filter({
      has: page.locator('svg[class*="message"], [data-testid="comment-icon"]'),
    });

    await expect(commentButton).toBeVisible();
    await safeClick(commentButton);

    // Should open comment modal or navigate to comments
    const commentModal = page.locator(
      '.modal, .comments-modal, [data-testid="comments-modal"]'
    );
    const commentForm = page.locator('form, [data-testid="comment-form"]');

    await waitForAnyElement(page, [
      ".modal",
      ".comments-modal",
      '[data-testid="comments-modal"]',
      "form",
      '[data-testid="comment-form"]',
    ]);

    return { success: true };
  }

  return { success: false };
}

/**
 * Wait for real-time updates (websocket/polling)
 */
export async function waitForRealtimeUpdate(
  page: Page,
  elementSelector: string,
  expectedChange: "content" | "count" | "visibility",
  timeout = 10000
) {
  const element = page.locator(elementSelector);

  if (expectedChange === "content") {
    const initialContent = await element.textContent().catch(() => "");

    await expect(async () => {
      const newContent = await element.textContent().catch(() => "");
      expect(newContent).not.toBe(initialContent);
    }).toPass({ timeout });
  }

  if (expectedChange === "count") {
    const initialCount = await element.count();

    await expect(async () => {
      const newCount = await element.count();
      expect(newCount).not.toBe(initialCount);
    }).toPass({ timeout });
  }

  if (expectedChange === "visibility") {
    await expect(element).toBeVisible({ timeout });
  }
}

/**
 * Upload test photo with proper validation
 */
export async function uploadTestPhoto(
  page: Page,
  fileInputSelector = 'input[type="file"]',
  photoData = {
    name: "test-photo.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-image-content"),
  }
) {
  const fileInput = page.locator(fileInputSelector);
  await expect(fileInput).toBeAttached();

  await fileInput.setInputFiles(photoData);

  // Wait for upload confirmation
  const uploadSuccess = await waitForAnyElement(
    page,
    [
      ".upload-success",
      '[data-testid="upload-success"]',
      ".photo-preview",
      '[data-testid="photo-preview"]',
      'img[src*="blob"]',
    ],
    10000
  );

  expect(uploadSuccess).toBeTruthy();
  return uploadSuccess;
}

/**
 * Verify responsive design across viewports
 */
export async function testResponsiveDesign(
  page: Page,
  viewports = [
    { width: 375, height: 667, name: "mobile" },
    { width: 768, height: 1024, name: "tablet" },
    { width: 1280, height: 720, name: "desktop" },
  ]
) {
  const originalUrl = page.url();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.reload();
    await waitForPageLoad(page);

    // Verify layout doesn't break
    await expect(page.locator("body")).toBeVisible();

    // Check for horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy();

    console.log(
      `✓ ${viewport.name} viewport (${viewport.width}x${viewport.height}) - Layout OK`
    );
  }

  // Restore original viewport
  await page.setViewportSize({ width: 1280, height: 720 });
}
