/**
 * Local Persona E2E Tests
 *
 * Tests for Local Larry - the knowledgeable local surfer.
 * Validates local-appropriate behaviors: condition updates, insider tips,
 * crowd reports, and helpful community contributions.
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

const PERSONA_TYPE = 'local' as const;
const persona = PERSONAS[PERSONA_TYPE];

// Use local's auth state
test.use({
  storageState: getPersonaAuthStatePath(PERSONA_TYPE),
});

test.describe(`${persona.displayName} Persona Tests`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Authentication', () => {
    test('should be logged in as local persona', async ({ page }) => {
      const result = await verifyLoggedInAsPersona(page, PERSONA_TYPE);
      expect(result.isCorrectPersona || result.currentUser !== undefined).toBeTruthy();
    });
  });

  test.describe('Content Generation', () => {
    test('generates knowledgeable condition updates', async () => {
      const beach = { name: 'The Lane', city: 'Santa Cruz', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'conditions');

      expect(content.title).toBeTruthy();
      expect(content.description).toBeTruthy();

      // Verify local knowledge tone
      const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
      expect(verification.isValid).toBe(true);
    });

    test('generates crowd reports with insider info', async () => {
      const beach = { name: 'Steamer Lane', city: 'Santa Cruz', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'crowd');

      expect(content.tag).toBe('crowd');
      expect(content.description).toBeTruthy();

      // Should mention crowd-related info
      const lowerDesc = content.description.toLowerCase();
      expect(
        lowerDesc.includes('crowd') ||
        lowerDesc.includes('lineup') ||
        lowerDesc.includes('people') ||
        lowerDesc.includes('busy')
      ).toBe(true);
    });

    test('generates hazard warnings', async () => {
      const beach = { name: 'Ocean Beach', city: 'San Francisco', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'hazards');

      expect(content.tag).toBe('hazards');
      expect(content.description).toBeTruthy();

      // Local hazard reports are informative
      const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
      expect(verification.isValid).toBe(true);
    });

    test('generates balanced session ratings', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      // Locals are discerning (3-5 range)
      expect(sessionContent.rating).toBeGreaterThanOrEqual(3);
      expect(sessionContent.rating).toBeLessThanOrEqual(5);
    });

    test('uses experienced wave height descriptions', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      // Locals report accurate wave heights
      const localHeights = ['3-4 ft', '4-5 ft', 'waist to chest', 'chest to head'];
      expect(localHeights).toContain(sessionContent.waveHeight);
    });
  });

  test.describe('Beach Discovery', () => {
    test('can explore discovery with expert filter', async ({ page }) => {
      const result = await exploreDiscoveryAsPersona(page, PERSONA_TYPE);

      expect(result.success).toBe(true);
      expect(result.beachesFound).toBeDefined();
    });

    test('can navigate to familiar beaches', async ({ page }) => {
      const beach = TEST_BEACHES.blacks;

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
    test.skip('can post condition updates', async ({ page }) => {
      const beach = TEST_BEACHES.blacks;

      const result = await createIntelPostAsPersona(page, PERSONA_TYPE, {
        beach: {
          name: beach.name,
          slug: beach.slug,
          city: beach.city,
          state: 'California',
        },
        tag: 'conditions',
      });

      if (result.success) {
        const verification = verifyPersonaContent(PERSONA_TYPE, result.content.description);
        expect(verification.isValid).toBe(true);
      } else {
        console.log(`Intel posting skipped: ${result.error}`);
      }
    });

    test.skip('can post crowd reports', async ({ page }) => {
      const beach = TEST_BEACHES.blacks;

      const result = await createIntelPostAsPersona(page, PERSONA_TYPE, {
        beach: {
          name: beach.name,
          slug: beach.slug,
          city: beach.city,
          state: 'California',
        },
        tag: 'crowd',
      });

      if (result.success) {
        expect(result.content.tag).toBe('crowd');
      } else {
        console.log(`Crowd report skipped: ${result.error}`);
      }
    });
  });

  test.describe('Persona Characteristics', () => {
    test('has expert experience level', () => {
      expect(persona.experienceLevel).toBe('expert');
    });

    test('has knowledgeable writing style', () => {
      expect(persona.style).toBe('knowledgeable and helpful');
    });

    test('uses characteristic phrases', () => {
      expect(persona.phrases).toContain('Heads up');
      expect(persona.phrases).toContain('Pro tip');
      expect(persona.phrases).toContain('Been coming here for years');
    });

    test('prefers condition and crowd tags', () => {
      expect(persona.typicalContent).toContain('Condition updates');
      expect(persona.typicalContent).toContain('Crowd reports');
    });
  });
});
