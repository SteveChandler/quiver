/**
 * Multi-user authentication utilities for persona-based E2E testing
 *
 * Provides functions for authenticating multiple NPC personas and
 * managing their separate authentication states for parallel test execution.
 *
 * @see e2e/global-setup.ts - Base authentication pattern
 * @see e2e/fixtures/personas.ts - Persona definitions
 */

import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import {
  PersonaType,
  PERSONAS,
  getPersonaPassword,
} from '../fixtures/personas';
import {
  verifySupabaseAuth,
  waitForAuthCompletion,
  logAuthState,
  getAuthTokens,
  checkServerSession,
} from './auth-helpers';

/**
 * Get the auth state file path for a specific persona
 */
export function getPersonaAuthStatePath(type: PersonaType): string {
  return `e2e/.auth/${type}-state.json`;
}

/**
 * Check if a persona's auth state file exists
 */
export function personaAuthStateExists(type: PersonaType): boolean {
  return existsSync(getPersonaAuthStatePath(type));
}

/**
 * Check if a persona's auth state is valid (exists and not empty)
 */
export async function isPersonaAuthValid(type: PersonaType): Promise<boolean> {
  const path = getPersonaAuthStatePath(type);
  if (!existsSync(path)) {
    return false;
  }

  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(path, 'utf-8');
    const state = JSON.parse(content);

    // Check if state has cookies or origins with localStorage
    const hasCookies = state.cookies && state.cookies.length > 0;
    const hasOrigins = state.origins && state.origins.length > 0;

    return hasCookies || hasOrigins;
  } catch {
    return false;
  }
}

/**
 * Options for persona authentication
 */
export interface PersonaAuthOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Vercel bypass token for non-localhost environments */
  vercelBypassToken?: string;
}

/**
 * Result of persona authentication attempt
 */
export interface PersonaAuthResult {
  success: boolean;
  personaType: PersonaType;
  authStatePath: string;
  error?: string;
}

/**
 * Authenticate a single persona and save its auth state
 *
 * This reuses the authentication flow from global-setup.ts but
 * saves to persona-specific state files.
 *
 * @param type - The persona type to authenticate
 * @param baseURL - The base URL of the application
 * @param options - Authentication options
 * @returns Result of the authentication attempt
 */
export async function authenticatePersona(
  type: PersonaType,
  baseURL: string,
  options: PersonaAuthOptions = {}
): Promise<PersonaAuthResult> {
  const { maxAttempts = 3, verbose = false, vercelBypassToken } = options;

  const persona = PERSONAS[type];
  const storageStatePath = getPersonaAuthStatePath(type);
  const password = getPersonaPassword(baseURL);

  // Ensure auth directory exists
  const authDir = dirname(storageStatePath);
  if (!existsSync(authDir)) {
    mkdirSync(authDir, { recursive: true });
  }

  const log = (message: string) => {
    if (verbose) {
      console.log(`[Persona Auth: ${persona.displayName}] ${message}`);
    }
  };

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await chromium.launch();

    const isLocalhost =
      baseURL.includes('localhost') || baseURL.includes('127.0.0.1');
    const extraHTTPHeaders =
      !isLocalhost && vercelBypassToken
        ? { 'x-vercel-protection-bypass': vercelBypassToken }
        : undefined;

    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        ...(extraHTTPHeaders ?? {}),
      },
    });

    const page = await context.newPage();
    let authenticated = false;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts && !authenticated; attempt++) {
      try {
        log(`Authentication attempt ${attempt}/${maxAttempts}`);

        // Navigate to home page
        await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for React to hydrate
        try {
          await page.waitForSelector('body.js-loaded, body.authenticated', {
            timeout: 15000,
          });
        } catch {
          await page.waitForLoadState('load', { timeout: 15000 });
        }

        // Check if already authenticated (unlikely for persona tests)
        const isAlreadyAuth = await verifySupabaseAuth(page);
        if (isAlreadyAuth) {
          const serverCheck = await checkServerSession(page, { baseUrl: baseURL });
          if (serverCheck.hasSession) {
            log('Already authenticated (server-validated)');
            authenticated = true;
            break;
          }
        }

        log('Performing login...');

        // Wait for and click login button
        const loginButton = page.getByRole('button', { name: /log in/i });
        await loginButton.waitFor({ state: 'visible', timeout: 15000 });
        await loginButton.click({ force: true });

        // Wait for auth modal
        await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

        // Click "Continue with Email" if visible
        const emailButton = page
          .getByRole('button', { name: /continue with email|sign in with email/i })
          .first();
        const emailButtonVisible = await emailButton.isVisible().catch(() => false);

        if (emailButtonVisible) {
          await emailButton.click();
          // Wait for email/password form to appear after clicking email button
          await page.getByPlaceholder(/email/i).waitFor({ state: 'visible', timeout: 5000 });
        }

        // Fill credentials with persona's email
        const emailInput = page.getByPlaceholder(/email/i);
        const passwordInput = page.getByLabel(/password/i);

        await emailInput.fill(persona.email);
        await passwordInput.fill(password);
        log(`Filled credentials for persona: ${type}`);

        // Submit login
        const submitButton = page.getByRole('button', { name: /log in|sign in/i }).last();
        await submitButton.click();

        // Wait for authentication to complete
        await waitForAuthCompletion(page, 15000);

        // Server-validate session
        const serverCheck = await checkServerSession(page, { baseUrl: baseURL });
        if (!serverCheck.hasSession) {
          throw new Error(
            `Server session validation failed after login. status=${serverCheck.status}`
          );
        }

        authenticated = true;
        log('Authentication successful!');

        // Wait for modal to close
        try {
          await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });
        } catch {
          // Modal may still be visible but auth succeeded
        }
      } catch (error) {
        lastError = error as Error;
        log(`Attempt ${attempt} failed: ${lastError.message}`);

        if (attempt < maxAttempts) {
          await page.waitForTimeout(2000);
        }
      }
    }

    if (!authenticated) {
      const tokens = await getAuthTokens(page);
      return {
        success: false,
        personaType: type,
        authStatePath: storageStatePath,
        error: `Authentication failed after ${maxAttempts} attempts. Last error: ${lastError?.message}. Tokens: ${tokens.cookies.length} cookies, ${tokens.storage.length} storage entries.`,
      };
    }

    // Log and save auth state
    if (verbose) {
      await logAuthState(page, `${persona.displayName} Final State`);
    }

    await context.storageState({ path: storageStatePath });
    log(`Saved auth state to ${storageStatePath}`);

    return {
      success: true,
      personaType: type,
      authStatePath: storageStatePath,
    };
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

/**
 * Authenticate all personas in sequence
 *
 * @param baseURL - The base URL of the application
 * @param options - Authentication options
 * @returns Array of authentication results
 */
export async function authenticateAllPersonas(
  baseURL: string,
  options: PersonaAuthOptions = {}
): Promise<PersonaAuthResult[]> {
  const results: PersonaAuthResult[] = [];
  const personaTypes = Object.keys(PERSONAS) as PersonaType[];

  console.log(`[Persona Setup] Authenticating ${personaTypes.length} personas...`);

  for (const type of personaTypes) {
    const result = await authenticatePersona(type, baseURL, options);
    results.push(result);

    if (result.success) {
      console.log(`[Persona Setup] ${PERSONAS[type].displayName} authenticated`);
    } else {
      console.error(
        `[Persona Setup] ${PERSONAS[type].displayName} failed: ${result.error}`
      );
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(
    `[Persona Setup] Completed: ${successCount}/${personaTypes.length} personas authenticated`
  );

  return results;
}

/**
 * Get a browser context configured for a specific persona
 *
 * Use this in tests to get a context with the persona's auth state loaded.
 *
 * @param browser - Playwright browser instance
 * @param type - The persona type
 * @returns Configured browser context
 */
export async function getPersonaContext(
  browser: Browser,
  type: PersonaType
): Promise<BrowserContext> {
  const authStatePath = getPersonaAuthStatePath(type);

  if (!existsSync(authStatePath)) {
    throw new Error(
      `Auth state for persona '${type}' not found at ${authStatePath}. ` +
        `Run 'yarn test:e2e:persona-setup' first.`
    );
  }

  return browser.newContext({
    storageState: authStatePath,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
}

/**
 * Create a new page for a specific persona with their auth state
 *
 * Convenience function that creates a context and page for a persona.
 *
 * @param browser - Playwright browser instance
 * @param type - The persona type
 * @returns Configured page and context
 */
export async function createPersonaPage(
  browser: Browser,
  type: PersonaType
): Promise<{ page: Page; context: BrowserContext }> {
  const context = await getPersonaContext(browser, type);
  const page = await context.newPage();
  return { page, context };
}
