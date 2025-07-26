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
 * Handle authentication redirects gracefully
 */
export async function handleAuthRedirect(page: Page) {
  await page.waitForTimeout(1000);

  const currentUrl = page.url();
  const isAuthPage =
    currentUrl.includes("/auth") || currentUrl.includes("/sign");

  try {
    const baseUrl = new URL(page.url()).origin;
    const homeUrl = baseUrl + "/";

    return {
      isAuthPage,
      isSignIn: currentUrl.includes("/sign-in"),
      isSignUp: currentUrl.includes("/sign-up"),
      isHome: currentUrl === homeUrl || currentUrl === baseUrl,
    };
  } catch (error) {
    // Fallback if URL parsing fails
    return {
      isAuthPage,
      isSignIn: currentUrl.includes("/sign-in"),
      isSignUp: currentUrl.includes("/sign-up"),
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

  if (authenticated) {
    // Ensure user is authenticated
    const authState = await handleAuthRedirect(page);
    if (authState.isAuthPage) {
      throw new Error("User must be authenticated for API testing");
    }
  }

  const response = await page.request[
    method.toLowerCase() as "get" | "post" | "put" | "delete"
  ](endpoint, {
    data: body,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });

  return {
    status: response.status(),
    data: await response.json().catch(() => null),
    success: response.status() === expectedStatus,
  };
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
