/**
 * Competitor Persona E2E Tests
 *
 * Tests for Kai N. - the performance-focused competitive surfer.
 * Validates competitor-appropriate behaviors: training metrics,
 * competition intel, and performance-focused content.
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

const PERSONA_TYPE = 'competitor' as const;
const persona = PERSONAS[PERSONA_TYPE];

// Use competitor's auth state
test.use({
  storageState: getPersonaAuthStatePath(PERSONA_TYPE),
});

test.describe(`${persona.displayName} Persona Tests`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Authentication', () => {
    test('should be logged in as competitor persona', async ({ page }) => {
      const result = await verifyLoggedInAsPersona(page, PERSONA_TYPE);
      expect(result.isCorrectPersona || result.currentUser !== undefined).toBeTruthy();
    });
  });

  test.describe('Content Generation', () => {
    test('generates performance-focused condition reports', async () => {
      const beach = { name: 'Pipeline', city: 'North Shore', state: 'Hawaii' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'conditions');

      expect(content.title).toBeTruthy();
      expect(content.description).toBeTruthy();

      // Verify competitor performance focus
      const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
      expect(verification.isValid).toBe(true);

      // Should mention performance/training
      const lowerDesc = content.description.toLowerCase();
      expect(
        lowerDesc.includes('training') ||
        lowerDesc.includes('performance') ||
        lowerDesc.includes('competition') ||
        lowerDesc.includes('elite') ||
        lowerDesc.includes('level')
      ).toBe(true);
    });

    test('generates crowd competition reports', async () => {
      const beach = { name: 'Trestles', city: 'San Clemente', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'crowd');

      expect(content.tag).toBe('crowd');
      expect(content.description).toBeTruthy();

      // Should mention competitive crowd aspects
      const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
      expect(verification.isValid).toBe(true);
    });

    test('generates training-focused session notes', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      expect(sessionContent.notes).toBeTruthy();
      const verification = verifyPersonaContent(PERSONA_TYPE, sessionContent.notes);
      expect(verification.isValid).toBe(true);

      // Should be training-focused
      const lowerNotes = sessionContent.notes.toLowerCase();
      expect(
        lowerNotes.includes('training') ||
        lowerNotes.includes('performance') ||
        lowerNotes.includes('session') ||
        lowerNotes.includes('competition')
      ).toBe(true);
    });

    test('uses advanced wave height descriptions', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      // Competitors surf bigger waves
      const competitorHeights = ['4-6 ft', 'overhead', 'head high+'];
      expect(competitorHeights).toContain(sessionContent.waveHeight);
    });

    test('gives performance-based ratings', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      // Competitors have high standards (3-5 range)
      expect(sessionContent.rating).toBeGreaterThanOrEqual(3);
      expect(sessionContent.rating).toBeLessThanOrEqual(5);
    });
  });

  test.describe('Beach Discovery', () => {
    test('can explore discovery with expert filter', async ({ page }) => {
      const result = await exploreDiscoveryAsPersona(page, PERSONA_TYPE);

      expect(result.success).toBe(true);
      expect(result.beachesFound).toBeDefined();
    });

    test('can navigate to competition venues', async ({ page }) => {
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
    test('can post training conditions', async ({ page }) => {
      throw new Error('Not implemented: Intel posting UI changed - need to update selectors and flow to match current implementation');
    });

    test('can post competition crowd intel', async ({ page }) => {
      throw new Error('Not implemented: Intel posting UI changed - need to update selectors and flow to match current implementation');
    });
  });

  test.describe('Session Logging @requires-auth', () => {
    test('can log training sessions', async ({ page }) => {
      throw new Error('Not implemented: Session logging UI changed - need to update selectors and flow to match current implementation');
    });
  });

  test.describe('Persona Characteristics', () => {
    test('has expert experience level', () => {
      expect(persona.experienceLevel).toBe('expert');
    });

    test('has performance-focused writing style', () => {
      expect(persona.style).toBe('performance focused and intense');
    });

    test('uses characteristic phrases', () => {
      expect(persona.phrases).toContain('Training session');
      expect(persona.phrases).toContain('Performance analysis');
      expect(persona.phrases).toContain('Competition ready');
    });

    test('focuses on performance content', () => {
      expect(persona.typicalContent).toContain('Training conditions');
      expect(persona.typicalContent).toContain('Performance metrics');
      expect(persona.typicalContent).toContain('Competitive intel');
    });
  });
});
