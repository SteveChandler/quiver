/**
 * Traveler Persona E2E Tests
 *
 * Tests for Tina C. - the adventurous traveling surfer.
 * Validates traveler-appropriate behaviors: beach comparisons,
 * travel insights, and discovery-focused exploration.
 *
 * @see e2e/fixtures/personas.ts - Persona definitions
 */

import { test, expect } from '@playwright/test';
import { PERSONAS } from '../fixtures/personas';
import { TEST_BEACHES } from '../fixtures/test-data';
import { getPersonaAuthStatePath } from '../utils/persona-auth';
import {
  createIntelPostAsPersona,
  logSessionAsPersona,
  navigateToBeach,
  verifyLoggedInAsPersona,
  exploreDiscoveryAsPersona,
} from '../utils/persona-helpers';
import {
  generateIntelContent,
  generateSessionContent,
  verifyPersonaContent,
} from '../utils/persona-content-generators';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from '../utils/error-detection';

const PERSONA_TYPE = 'traveler' as const;
const persona = PERSONAS[PERSONA_TYPE];

// Use traveler's auth state
test.use({
  storageState: getPersonaAuthStatePath(PERSONA_TYPE),
});

test.describe(`${persona.displayName} Persona Tests`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Authentication', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Authentication' });
  });

    test('should be logged in as traveler persona', async ({ page }) => {
      const result = await verifyLoggedInAsPersona(page, PERSONA_TYPE);
      expect(result.isCorrectPersona || result.currentUser !== undefined).toBeTruthy();
    });
  });

  test.describe('Content Generation', () => {
    test('generates comparative condition reports', async () => {
      const beach = { name: 'Trestles', city: 'San Clemente', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'conditions');

      expect(content.title).toBeTruthy();
      expect(content.description).toBeTruthy();

      // Verify traveler comparative tone
      const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
      expect(verification.isValid).toBe(true);
    });

    test('generates travel-focused parking info', async () => {
      const beach = { name: 'Rincon', city: 'Ventura', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'parking');

      expect(content.tag).toBe('parking');
      expect(content.description).toBeTruthy();

      // Should be helpful for visitors
      const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
      expect(verification.isValid).toBe(true);
    });

    test('generates access info for first-timers', async () => {
      const beach = { name: 'Malibu', city: 'Malibu', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'access');

      expect(content.tag).toBe('access');
      expect(content.description).toBeTruthy();
    });

    test('generates adventurous session notes', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      expect(sessionContent.notes).toBeTruthy();
      const verification = verifyPersonaContent(PERSONA_TYPE, sessionContent.notes);
      expect(verification.isValid).toBe(true);
    });

    test('uses varied wave height descriptions', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      // Travelers experience diverse conditions
      const travelerHeights = ['3-4 ft', '4-6 ft', 'overhead'];
      expect(travelerHeights).toContain(sessionContent.waveHeight);
    });
  });

  test.describe('Beach Discovery', () => {
    test('can explore discovery with intermediate filter', async ({ page }) => {
      const result = await exploreDiscoveryAsPersona(page, PERSONA_TYPE);

      expect(result.success).toBe(true);
      expect(result.beachesFound).toBeDefined();
    });

    test('can navigate to new beaches', async ({ page }) => {
      const beach = TEST_BEACHES.birdrock;

      await navigateToBeach(page, {
        name: beach.name,
        slug: beach.slug,
        city: beach.city,
        state: 'California',
      });

      await expect(page).toHaveURL(new RegExp(beach.slug));
    });
  });

  test.describe('Intel Posting @requires-auth', () => {
    test('can post first impressions', async ({ page }) => {
      throw new Error('Not implemented: Intel posting UI changed - need to update selectors and flow to match current implementation');
    });
  });

  test.describe('Persona Characteristics', () => {
    test('has intermediate experience level', () => {
      expect(persona.experienceLevel).toBe('intermediate');
    });

    test('has comparative writing style', () => {
      expect(persona.style).toBe('comparative and adventurous');
    });

    test('uses characteristic phrases', () => {
      expect(persona.phrases).toContain('Reminds me of');
      expect(persona.phrases).toContain('Worth the trip');
      expect(persona.phrases).toContain('Unlike anywhere else');
    });

    test('focuses on travel content', () => {
      expect(persona.typicalContent).toContain('Beach comparisons');
      expect(persona.typicalContent).toContain('Travel insights');
      expect(persona.typicalContent).toContain('New discoveries');
    });
  });
});
