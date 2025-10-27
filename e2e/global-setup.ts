import { chromium, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

/**
 * Global setup runs once before all tests
 * Creates authenticated session for tests that require authentication
 */
async function globalSetup(config: FullConfig) {
  // Load environment variables
  dotenv.config({ path: '.env.playwright' });
  dotenv.config(); // Fallback to .env

  const { baseURL, storageState } = config.projects[0].use;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Get test credentials from environment
  const testEmail = process.env.TEST_USER_EMAIL || 'test@quiver.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'testpassword123';

  console.log(`[Global Setup] Authenticating test user: ${testEmail}`);

  try {
    // Navigate to home page
    await page.goto(baseURL!);

    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check if already authenticated
    const isAuthenticated = await page.evaluate(() => {
      return document.cookie.includes('sb-') || localStorage.getItem('sb-');
    });

    if (!isAuthenticated) {
      console.log('[Global Setup] Not authenticated, attempting login...');

      // Look for login button
      const loginButton = page.getByRole('button', { name: /log in/i });
      const isVisible = await loginButton.isVisible().catch(() => false);

      if (isVisible) {
        await loginButton.click();

        // Wait for auth modal to appear
        await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

        // Click "Continue with Email" button to get to email/password form
        const emailButton = page.getByRole('button', { name: /continue with email|sign in with email/i }).first();
        const emailButtonVisible = await emailButton.isVisible().catch(() => false);

        if (emailButtonVisible) {
          await emailButton.click();
          await page.waitForTimeout(1000);
        }

        // Fill in email and password
        const emailInput = page.getByPlaceholder(/email/i);
        const passwordInput = page.getByLabel(/password/i);

        await emailInput.fill(testEmail);
        await passwordInput.fill(testPassword);

        // Submit login
        const submitButton = page.getByRole('button', { name: /log in|sign in/i }).last();
        await submitButton.click();

        // Wait for authentication to complete
        await page.waitForTimeout(3000);

        // Verify authentication succeeded
        const authSuccess = await page.evaluate(() => {
          return document.cookie.includes('sb-') || localStorage.getItem('sb-');
        });

        if (!authSuccess) {
          console.warn('[Global Setup] Authentication may have failed, but continuing...');
        } else {
          console.log('[Global Setup] Authentication successful');
        }
      }
    } else {
      console.log('[Global Setup] Already authenticated');
    }

    // Save authenticated state
    await context.storageState({ path: 'e2e/.auth/state.json' });
    console.log('[Global Setup] Saved authentication state to e2e/.auth/state.json');

  } catch (error) {
    console.error('[Global Setup] Error during authentication:', error);
    // Continue anyway - some tests may work without auth
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
