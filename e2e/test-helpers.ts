import { Page, expect } from "@playwright/test";

/**
 * Reliable page loading that doesn't depend on networkidle
 */
export async function waitForPageLoad(page: Page, timeout = 10000) {
  // Use load state instead of networkidle for reliability
  await page.waitForLoadState("load");

  // Wait for basic page structure
  await page.waitForSelector("body", { timeout });

  // Give a small buffer for React hydration
  await page.waitForTimeout(500);
}

/**
 * Wait for element to be ready for interaction
 */
export async function waitForElementReady(
  locator: any,
  options: { timeout?: number; state?: "visible" | "attached" | "hidden" } = {}
) {
  const { timeout = 5000, state = "visible" } = options;
  await locator.waitFor({ state, timeout });

  // If it's supposed to be visible, make sure it's actually clickable
  if (state === "visible") {
    // Wait a bit more for element to be stable
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Handle authentication redirects and fail test if auth is required but missing
 */
export async function handleAuthRedirect(page: Page) {
  await page.waitForTimeout(1000);

  const currentUrl = page.url();
  const isAuthPage =
    currentUrl.includes("/auth") || currentUrl.includes("/sign");

  // If we're on an auth page, this indicates auth setup failed
  if (isAuthPage) {
    throw new Error(
      `Authentication setup failed - test was redirected to auth page: ${currentUrl}. ` +
      `This suggests the global setup authentication didn't work properly.`
    );
  }

  try {
    const baseUrl = new URL(page.url()).origin;
    const homeUrl = baseUrl + "/";

    return {
      isAuthPage: false,
      isSignIn: false,
      isSignUp: false,
      isHome: currentUrl === homeUrl || currentUrl === baseUrl,
    };
  } catch (error) {
    // Fallback if URL parsing fails
    return {
      isAuthPage: false,
      isSignIn: false,
      isSignUp: false,
      isHome: currentUrl.endsWith("/") && !currentUrl.includes("/auth"),
    };
  }
}

/**
 * Safe click that handles disabled states
 */
export async function safeClick(
  locator: any,
  options: { timeout?: number } = {}
) {
  const { timeout = 5000 } = options;

  // Wait for element to be attached
  await locator.waitFor({ state: "attached", timeout });

  // Check if element is enabled
  const isEnabled = await locator.isEnabled().catch(() => false);
  if (!isEnabled) {
    throw new Error("Element is disabled and cannot be clicked");
  }

  // Wait for element to be visible and stable
  await locator.waitFor({ state: "visible", timeout });
  await new Promise((resolve) => setTimeout(resolve, 200)); // Stability buffer

  // Perform the click
  await locator.click();
}

/**
 * Find element with fallback selectors to avoid strict mode violations
 */
export function findElementWithFallbacks(page: Page, selectors: string[]) {
  // Try each selector until one works
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      return element;
    } catch (error) {
      continue;
    }
  }

  // If all fail, return the first selector's result
  return page.locator(selectors[0]).first();
}

/**
 * Check if any of multiple elements are visible
 */
export async function isAnyElementVisible(locators: any[], timeout = 5000) {
  const promises = locators.map((locator) =>
    locator.isVisible().catch(() => false)
  );

  const results = await Promise.all(promises);
  return results.some((result) => result);
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(page: Page, expectedUrl?: string) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(1000);

  if (expectedUrl) {
    const currentUrl = page.url();
    const urlMatches =
      currentUrl.includes(expectedUrl) ||
      currentUrl === new URL(expectedUrl, page.url()).href;
    return urlMatches;
  }

  return true;
}

/**
 * Social Features Testing Helpers
 */
export async function createTestSession(page: Page, sessionData = {}) {
  const defaultSession = {
    beach: "Test Beach",
    date: new Date().toISOString().split("T")[0],
    time: "08:00",
    duration: "2",
    notes: "Test session for automation",
    ...sessionData,
  };

  await page.goto("/log-session");
  await page.waitForTimeout(2000);

  if (page.url().includes("/auth")) {
    throw new Error("User not authenticated for session creation");
  }

  // Fill session form
  const beachInput = page.locator("#beach-input").first();
  if (await beachInput.isVisible()) {
    await beachInput.fill(defaultSession.beach);
  }

  const dateInput = page.locator("#session-date").first();
  if (await dateInput.isVisible()) {
    await dateInput.fill(defaultSession.date);
  }

  const timeInput = page.locator("#session-time").first();
  if (await timeInput.isVisible()) {
    await timeInput.fill(defaultSession.time);
  }

  const notesInput = page.getByLabel(/notes/i).first();
  if (await notesInput.isVisible()) {
    await notesInput.fill(defaultSession.notes);
  }

  // Submit form
  const saveButton = page.getByRole("button", { name: /save|log/i }).first();
  if ((await saveButton.isVisible()) && (await saveButton.isEnabled())) {
    await saveButton.click();
    await page.waitForTimeout(2000);
  }

  return defaultSession;
}

/**
 * Test if user can interact with social features
 */
export async function testSocialInteraction(
  page: Page,
  action: "like" | "comment" | "follow"
) {
  const selectors = {
    like: 'button[aria-label*="like"], .like-button, [data-testid*="like"]',
    comment:
      'button[aria-label*="comment"], .comment-button, [data-testid*="comment"]',
    follow:
      'button[aria-label*="follow"], .follow-button, [data-testid*="follow"]',
  };

  const button = page.locator(selectors[action]).first();
  if (await button.isVisible()) {
    const initialState = await button.textContent();
    await button.click();
    await page.waitForTimeout(1000);

    // Check if interaction was successful (button state changed)
    const newState = await button.textContent();
    return { success: initialState !== newState, initialState, newState };
  }

  return { success: false, error: `${action} button not found` };
}

/**
 * API Testing Helpers
 */
export async function testApiEndpoint(
  page: Page,
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    expectedStatus?: number;
    authenticated?: boolean;
  } = {}
) {
  const {
    method = "GET",
    body,
    expectedStatus = 200,
    authenticated = true,
  } = options;

  try {
    if (authenticated) {
      // Check authentication but don't throw error
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        console.log(
          "User not authenticated, testing with unauthenticated request"
        );
      }
    }

    const response = await page.request[
      method.toLowerCase() as "get" | "post" | "put" | "delete"
    ](endpoint, {
      data: body,
      headers: body ? { "Content-Type": "application/json" } : undefined,
    });

    const responseData = await response.json().catch(() => null);

    return {
      status: response.status(),
      data: responseData,
      success: response.status() === expectedStatus,
    };
  } catch (error) {
    console.log(`API test error for ${endpoint}:`, error);
    return {
      status: 0, // 0 indicates test framework error, not API response
      data: { error: error.message },
      success: false,
    };
  }
}

/**
 * Media/Photo Upload Helpers
 */
export async function uploadTestPhoto(page: Page, filePath = "test-image.jpg") {
  // Create a test image file
  const fileContent = Buffer.from("fake-image-content");

  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible()) {
    // Set the file for upload
    await fileInput.setInputFiles({
      name: filePath,
      mimeType: "image/jpeg",
      buffer: fileContent,
    });

    await page.waitForTimeout(2000); // Wait for upload processing
    return true;
  }

  return false;
}

/**
 * Real-time Testing Helpers
 */
export async function waitForRealtimeUpdate(
  page: Page,
  selector: string,
  expectedChange: string,
  timeout = 5000
) {
  return await page.waitForFunction(
    ({ selector, expectedChange }) => {
      const element = document.querySelector(selector);
      return element && element.textContent?.includes(expectedChange);
    },
    { selector, expectedChange },
    { timeout }
  );
}

/**
 * Ensure the page is authenticated using TEST_USER_EMAIL/TEST_USER_PASSWORD.
 * Returns true if authenticated, false if credentials are missing or login fails.
 */
export async function ensureAuthenticated(page: Page): Promise<boolean> {
  try {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    // If creds are not provided, cannot authenticate
    if (!testEmail || !testPassword) return false;

    // If already authenticated, avoid re-login by checking for auth pages
    const currentUrl = page.url();
    if (!currentUrl.includes("/auth")) {
      // Ping a protected page to verify; if redirect occurs, we'll handle below
      await page.goto("/profile");
      await page.waitForLoadState("load");
    }

    // If we are redirected to auth, perform sign in
    if (page.url().includes("/auth")) {
      await page.goto("/auth/sign-in");
      await page.waitForLoadState("load");

      const emailField = page
        .locator('input[type="email"], input[id="email"], input[name="email"]')
        .first();
      const passwordField = page
        .locator('input[type="password"], input[id="password"], input[name="password"]')
        .first();
      const submitButton = page
        .locator('button[type="submit"]')
        .filter({ hasText: /sign in/i });

      if (!(await emailField.isVisible().catch(() => false))) return false;
      if (!(await passwordField.isVisible().catch(() => false))) return false;

      await emailField.fill(testEmail);
      await passwordField.fill(testPassword);
      await submitButton.click();

      // Wait for redirect away from auth
      try {
        await page.waitForURL(
          (url) => !url.pathname.startsWith("/auth"),
          { timeout: 10000 }
        );
      } catch {
        return false;
      }
    }

    // Final sanity check: can we access a protected route without redirect?
    await page.goto("/profile");
    await page.waitForLoadState("load");
    if (page.url().includes("/auth")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Board Management Helpers
 */
export async function createTestBoard(page: Page, boardData = {}) {
  const defaultBoard = {
    name: "Test Board",
    length: "6'2\"",
    type: "shortboard",
    description: "Test board for automation",
    ...boardData,
  };

  await page.goto("/profile");
  await page.waitForTimeout(2000);

  // Navigate to quiver tab
  const quiverTab = page.getByRole("tab", { name: /quiver|boards/i });
  if (await quiverTab.isVisible()) {
    await quiverTab.click();
    await page.waitForTimeout(1000);
  }

  // Click add board button
  const addButton = page.getByRole("button", { name: /add.*board/i });
  if (await addButton.isVisible()) {
    await addButton.click();
    await page.waitForTimeout(1000);

    // Fill board form
    const nameInput = page.getByLabel(/name|brand/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill(defaultBoard.name);
    }

    const lengthInput = page.getByLabel(/length|size/i);
    if (await lengthInput.isVisible()) {
      await lengthInput.fill(defaultBoard.length);
    }

    const typeSelect = page.getByLabel(/type|category/i);
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption(defaultBoard.type);
    }

    const descInput = page.getByLabel(/description|notes/i);
    if (await descInput.isVisible()) {
      await descInput.fill(defaultBoard.description);
    }

    // Save board
    const saveButton = page.getByRole("button", { name: /save|add/i });
    if ((await saveButton.isVisible()) && (await saveButton.isEnabled())) {
      await saveButton.click();
      await page.waitForTimeout(2000);
    }
  }

  return defaultBoard;
}

/**
 * Session Conversion Helpers
 */
export async function createPlannedSession(page: Page, sessionData = {}) {
  const defaultSession = {
    beach: "Test Beach",
    date: new Date(Date.now() + 86400000).toISOString().split("T")[0], // Tomorrow
    time: "08:00",
    notes: "Planned test session",
    ...sessionData,
  };

  await page.goto("/plan-session");
  await page.waitForTimeout(2000);

  if (page.url().includes("/auth")) {
    throw new Error("User not authenticated for session planning");
  }

  // Fill planning form (similar to createTestSession but for future dates)
  const beachInput = page.locator("#beach-input").first();
  if (await beachInput.isVisible()) {
    await beachInput.fill(defaultSession.beach);
  }

  const dateInput = page.locator("#session-date").first();
  if (await dateInput.isVisible()) {
    await dateInput.fill(defaultSession.date);
  }

  const timeInput = page.locator("#session-time").first();
  if (await timeInput.isVisible()) {
    await timeInput.fill(defaultSession.time);
  }

  const notesInput = page.getByLabel(/notes/i).first();
  if (await notesInput.isVisible()) {
    await notesInput.fill(defaultSession.notes);
  }

  // Submit form
  const saveButton = page.getByRole("button", { name: /save|plan/i }).first();
  if ((await saveButton.isVisible()) && (await saveButton.isEnabled())) {
    await saveButton.click();
    await page.waitForTimeout(2000);
  }

  return defaultSession;
}

/**
 * Create a completed session for sharing tests
 */
export async function createCompletedSession(page: Page, sessionData = {}) {
  const defaultSession = {
    beach: "Test Beach",
    date: new Date().toISOString().split("T")[0], // Today
    time: "08:00",
    duration: "90",
    notes: "Completed test session for sharing",
    status: "completed",
    waveQuality: "4",
    ...sessionData,
  };

  await page.goto("/log-session");
  await waitForPageLoad(page);

  // Handle auth redirect
  const authStatus = await handleAuthRedirect(page);
  if (authStatus.isAuthPage) {
    throw new Error("User not authenticated for session logging");
  }

  // Fill out the session form with multiple fallback selectors
  const beachInput = page
    .getByLabel(/beach/i)
    .or(page.getByPlaceholder(/beach/i))
    .or(page.locator('input[name*="beach"]'))
    .or(page.getByTestId("beach-selector"))
    .or(page.locator('[data-testid="beach-selector"] input'))
    .first();

  if (await beachInput.isVisible()) {
    await beachInput.click();
    await beachInput.fill("Alfonsos"); // Use existing beach from database
    await page.waitForTimeout(1000); // Allow for autocomplete to load
    
    // Try to select from autocomplete dropdown
    const beachOption = page
      .getByText("Alfonsos")
      .or(page.locator('[role="option"]:has-text("Alfonsos")'))
      .first();
    
    const optionVisible = await beachOption.isVisible().catch(() => false);
    if (optionVisible) {
      await beachOption.click();
    } else {
      // Fallback: press Enter or Tab to confirm
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(500);
  }

  const dateInput = page
    .getByLabel(/date/i)
    .or(page.locator('input[type="date"]'))
    .first();

  if (await dateInput.isVisible()) {
    await dateInput.fill(defaultSession.date);
  }

  const timeInput = page
    .getByLabel(/time/i)
    .or(page.locator('input[type="time"]'))
    .first();

  if (await timeInput.isVisible()) {
    await timeInput.fill(defaultSession.time);
  }

  const durationInput = page
    .getByLabel(/duration/i)
    .or(page.locator('input[name*="duration"]'))
    .first();

  if (await durationInput.isVisible()) {
    await durationInput.fill(defaultSession.duration);
  }

  const notesInput = page
    .getByLabel(/notes/i)
    .or(page.locator('textarea[name*="notes"]'))
    .first();

  if (await notesInput.isVisible()) {
    await notesInput.fill(defaultSession.notes);
  }

  // Set wave quality if available
  const waveQualitySelect = page
    .getByLabel(/wave.*quality/i)
    .or(page.locator('select[name*="wave"]'))
    .first();

  if (await waveQualitySelect.isVisible()) {
    await waveQualitySelect.selectOption(defaultSession.waveQuality);
  }

  // Set status to completed
  const statusSelect = page
    .getByLabel(/status/i)
    .or(page.locator('select[name*="status"]'))
    .first();

  if (await statusSelect.isVisible()) {
    await statusSelect.selectOption(defaultSession.status);
  }

  // Submit the form
  const submitButton = page
    .getByRole("button", { name: /log session|save session|submit/i })
    .or(page.locator('button[type="submit"]'))
    .first();

  await waitForElementReady(submitButton);
  await safeClick(submitButton);
  await page.waitForTimeout(2000);

  return defaultSession;
}

/**
 * Navigate to the most recent session detail page
 */
export async function navigateToLatestSession(page: Page): Promise<string | null> {
  await page.goto("/profile");
  await waitForPageLoad(page);

  // Click journal/sessions tab if it exists
  const journalTab = page.getByRole("tab", { name: /journal|sessions/i });
  if (await journalTab.isVisible()) {
    await safeClick(journalTab);
    await page.waitForTimeout(1000);
  }

  // Find the most recent session link
  const sessionLink = page.locator('a[href*="/sessions/"]').first();
  if (await sessionLink.isVisible()) {
    const href = await sessionLink.getAttribute("href");
    await safeClick(sessionLink);
    await waitForPageLoad(page);
    
    // Extract session ID from href
    if (href) {
      const sessionId = href.split("/sessions/")[1]?.split("?")[0];
      return sessionId || null;
    }
  }

  return null;
}

/**
 * Open share modal for current session
 */
export async function openShareModal(page: Page) {
  // Be more specific to avoid multiple share buttons (e.g., in modal and page)
  const shareButton = page
    .getByTestId("share-button")
    .or(page.locator('button[data-testid="share-button"]'))
    .or(page.getByRole("button", { name: /share/i }).first())
    .first();

  await expect(shareButton).toBeVisible();
  await safeClick(shareButton);
  await page.waitForTimeout(1000);

  // Verify modal opened
  const shareModal = page
    .getByRole("dialog")
    .or(page.getByTestId("share-modal"))
    .or(page.locator('[role="dialog"]'))
    .first();

  await expect(shareModal).toBeVisible();
  return shareModal;
}

/**
 * Make session public if needed for sharing
 */
export async function ensureSessionIsPublic(page: Page) {
  const makeShareableButton = page
    .getByRole("button", { name: /make.*shareable|make.*public/i })
    .first();

  if (await makeShareableButton.isVisible()) {
    await safeClick(makeShareableButton);
    await page.waitForTimeout(2000);
    
    // Verify success
    const successToast = page.getByText(/session.*shareable|session.*public|success/i);
    const hasSuccessToast = await successToast.isVisible().catch(() => false);
    return hasSuccessToast;
  }
  
  return true; // Already public
}

/**
 * Wait for share image to generate
 */
export async function waitForShareImageGeneration(page: Page, timeout = 10000) {
  const imagePreview = page
    .locator('img[alt*="share"]')
    .or(page.locator('img[alt*="preview"]'))
    .first();

  // Wait for either image to appear or error state
  try {
    await imagePreview.waitFor({ state: "visible", timeout });
    return { success: true, hasImage: true };
  } catch {
    // Check for error state
    const errorMessage = page.getByText(/failed.*generate|error.*image/i);
    const hasError = await errorMessage.isVisible().catch(() => false);
    return { success: !hasError, hasImage: false, hasError };
  }
}

/**
 * Test share modal variant switching
 */
export async function testVariantSwitching(page: Page) {
  const storyTab = page.getByRole("tab", { name: /story/i });
  const squareTab = page.getByRole("tab", { name: /square/i });

  const results = {
    storyTabVisible: await storyTab.isVisible().catch(() => false),
    squareTabVisible: await squareTab.isVisible().catch(() => false),
    switchedToSquare: false,
    switchedToStory: false,
  };

  if (results.squareTabVisible) {
    await safeClick(squareTab);
    await page.waitForTimeout(1000);
    results.switchedToSquare = true;
  }

  if (results.storyTabVisible) {
    await safeClick(storyTab);
    await page.waitForTimeout(1000);
    results.switchedToStory = true;
  }

  return results;
}
