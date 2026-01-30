/**
 * Persona Test Fixture with On-Demand Authentication
 *
 * Provides test fixtures that automatically generate auth state on-demand
 * if the persona's auth state file is missing or empty.
 *
 * @see e2e/fixtures/personas.ts - Persona definitions
 * @see e2e/utils/persona-auth.ts - Authentication utilities
 */

import { test as base, BrowserContext, Page } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import {
  PersonaType,
  PERSONAS,
} from './personas';
import {
  authenticatePersona,
  getPersonaAuthStatePath,
} from '../utils/persona-auth';

/**
 * Check if auth state file is valid (exists and has cookies)
 */
function isAuthStateValid(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const content = JSON.parse(readFileSync(path, 'utf-8'));
    return content.cookies && content.cookies.length > 0;
  } catch {
    return false;
  }
}

/**
 * Create a persona test fixture with on-demand authentication
 *
 * This fixture will automatically authenticate the persona if their
 * auth state file is missing or empty. This makes persona tests
 * self-contained and runnable without requiring global setup.
 *
 * @param personaType - The persona type to create the fixture for
 * @returns Extended test object with personaPage and personaContext fixtures
 *
 * @example
 * ```typescript
 * import { createPersonaTest } from '../fixtures/persona-test-fixture';
 * import { PERSONAS } from '../fixtures/personas';
 *
 * const PERSONA_TYPE = 'rookie' as const;
 * const persona = PERSONAS[PERSONA_TYPE];
 * const test = createPersonaTest(PERSONA_TYPE);
 *
 * test.describe(`${persona.displayName} Tests`, () => {
 *   test('should be logged in', async ({ personaPage }) => {
 *     await personaPage.goto('/');
 *     // Test authenticated persona behavior
 *   });
 * });
 * ```
 */
export function createPersonaTest(personaType: PersonaType) {
  return base.extend<{ personaPage: Page; personaContext: BrowserContext }>({
    personaPage: async ({ browser }, use) => {
      const authStatePath = getPersonaAuthStatePath(personaType);
      const baseURL = process.env.BASE_URL || 'http://localhost:3000';

      // Generate auth state on-demand if missing or empty
      if (!isAuthStateValid(authStatePath)) {
        console.log(`[Persona] Generating auth state for ${personaType}...`);
        const result = await authenticatePersona(personaType, baseURL, {
          maxAttempts: 2,
          verbose: false,
          vercelBypassToken: process.env.VERCEL_BYPASS_TOKEN,
        });

        if (!result.success) {
          throw new Error(`Failed to authenticate ${personaType}: ${result.error}`);
        }
        console.log(`[Persona] Auth state generated for ${personaType}`);
      }

      // Create context with auth state
      const context = await browser.newContext({
        storageState: authStatePath,
      });
      const page = await context.newPage();

      await use(page);

      await context.close();
    },

    personaContext: async ({ browser }, use) => {
      const authStatePath = getPersonaAuthStatePath(personaType);
      const baseURL = process.env.BASE_URL || 'http://localhost:3000';

      // Generate auth state on-demand if missing or empty
      if (!isAuthStateValid(authStatePath)) {
        console.log(`[Persona] Generating auth state for ${personaType}...`);
        const result = await authenticatePersona(personaType, baseURL, {
          maxAttempts: 2,
          verbose: false,
          vercelBypassToken: process.env.VERCEL_BYPASS_TOKEN,
        });

        if (!result.success) {
          throw new Error(`Failed to authenticate ${personaType}: ${result.error}`);
        }
        console.log(`[Persona] Auth state generated for ${personaType}`);
      }

      const context = await browser.newContext({
        storageState: authStatePath,
      });
      await use(context);
      await context.close();
    },
  });
}

/**
 * Get persona info for test descriptions
 */
export function getPersonaInfo(personaType: PersonaType) {
  return PERSONAS[personaType];
}
