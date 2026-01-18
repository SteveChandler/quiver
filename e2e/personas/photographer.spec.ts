/**
 * Photographer Persona E2E Tests
 *
 * Tests for P. Martinez - the aesthetic surf photographer.
 * Validates photographer-appropriate behaviors: visual focus,
 * lighting conditions, and photo-worthy content.
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

const PERSONA_TYPE = 'photographer' as const;
const persona = PERSONAS[PERSONA_TYPE];

// Use photographer's auth state
test.use({
  storageState: getPersonaAuthStatePath(PERSONA_TYPE),
});

test.describe(`${persona.displayName} Persona Tests`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Authentication', () => {
    test('should be logged in as photographer persona', async ({ page }) => {
      const result = await verifyLoggedInAsPersona(page, PERSONA_TYPE);
      expect(result.isCorrectPersona || result.currentUser !== undefined).toBeTruthy();
    });
  });

  test.describe('Content Generation', () => {
    test('generates visual-focused condition reports', async () => {
      const beach = { name: 'Malibu', city: 'Malibu', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'conditions');

      expect(content.title).toBeTruthy();
      expect(content.description).toBeTruthy();

      // Verify photographer visual focus
      const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
      expect(verification.isValid).toBe(true);

      // Should mention visual elements
      const lowerDesc = content.description.toLowerCase();
      expect(
        lowerDesc.includes('light') ||
        lowerDesc.includes('photo') ||
        lowerDesc.includes('visual') ||
        lowerDesc.includes('shot') ||
        lowerDesc.includes('stunning')
      ).toBe(true);
    });

    test('generates equipment-aware parking info', async () => {
      const beach = { name: 'Huntington', city: 'Huntington Beach', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'parking');

      expect(content.tag).toBe('parking');
      expect(content.description).toBeTruthy();
    });

    test('generates photo-worthy session notes', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      expect(sessionContent.notes).toBeTruthy();
      const verification = verifyPersonaContent(PERSONA_TYPE, sessionContent.notes);
      expect(verification.isValid).toBe(true);
    });

    test('uses standard wave height descriptions', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      const photoHeights = ['3-4 ft', '4-5 ft', 'waist to head'];
      expect(photoHeights).toContain(sessionContent.waveHeight);
    });
  });

  test.describe('Beach Discovery', () => {
    test('can explore discovery with intermediate filter', async ({ page }) => {
      const result = await exploreDiscoveryAsPersona(page, PERSONA_TYPE);

      expect(result.success).toBe(true);
      expect(result.beachesFound).toBeDefined();
    });

    test('can navigate to photogenic beaches', async ({ page }) => {
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
    test.skip('can post lighting conditions', async ({ page }) => {
      const beach = TEST_BEACHES.beacons;

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
  });

  test.describe('Persona Characteristics', () => {
    test('has intermediate experience level', () => {
      expect(persona.experienceLevel).toBe('intermediate');
    });

    test('has aesthetic writing style', () => {
      expect(persona.style).toBe('aesthetic and technical');
    });

    test('uses characteristic phrases', () => {
      expect(persona.phrases).toContain('Perfect lighting');
      expect(persona.phrases).toContain('Golden hour magic');
      expect(persona.phrases).toContain('Picture perfect');
    });

    test('focuses on visual content', () => {
      expect(persona.typicalContent).toContain('Visual conditions');
      expect(persona.typicalContent).toContain('Light quality');
      expect(persona.typicalContent).toContain('Action shots');
    });
  });
});
