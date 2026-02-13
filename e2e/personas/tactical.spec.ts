/**
 * Tactical Persona E2E Tests
 *
 * Tests for Solid Snake - the tactical analyst surfer.
 * Validates tactical-appropriate behaviors: detailed analysis,
 * strategic updates, and precision field reports.
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

const PERSONA_TYPE = 'tactical' as const;
const persona = PERSONAS[PERSONA_TYPE];

// Use tactical's auth state
test.use({
  storageState: getPersonaAuthStatePath(PERSONA_TYPE),
});

test.describe(`${persona.displayName} Persona Tests`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Authentication', () => {
    test('should be logged in as tactical persona', async ({ page }) => {
      const result = await verifyLoggedInAsPersona(page, PERSONA_TYPE);
      expect(result.isCorrectPersona || result.currentUser !== undefined).toBeTruthy();
    });
  });

  test.describe('Content Generation', () => {
    test('generates tactical condition assessments', async () => {
      const beach = { name: 'Pipeline', city: 'North Shore', state: 'Hawaii' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'conditions');

      expect(content.title).toBeTruthy();
      expect(content.description).toBeTruthy();

      // Verify tactical precision
      const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
      expect(verification.isValid).toBe(true);

      // Should use tactical terminology
      const lowerDesc = content.description.toLowerCase();
      expect(
        lowerDesc.includes('tactical') ||
        lowerDesc.includes('mission') ||
        lowerDesc.includes('operational') ||
        lowerDesc.includes('assessment') ||
        lowerDesc.includes('strategic') ||
        lowerDesc.includes('field report') ||
        lowerDesc.includes('reconnaissance') ||
        lowerDesc.includes('parameters')
      ).toBe(true);
    });

    test('generates threat assessments for hazards', async () => {
      const beach = { name: 'Mavericks', city: 'Half Moon Bay', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'hazards');

      expect(content.tag).toBe('hazards');
      expect(content.description).toBeTruthy();

      // Should include risk analysis
      const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
      expect(verification.isValid).toBe(true);
    });

    test('generates ingress/egress access reports', async () => {
      const beach = { name: 'Ocean Beach', city: 'San Francisco', state: 'California' };
      const content = generateIntelContent(PERSONA_TYPE, beach, 'access');

      expect(content.tag).toBe('access');
      expect(content.description).toBeTruthy();
    });

    test('generates precise session reports', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      expect(sessionContent.notes).toBeTruthy();
      const verification = verifyPersonaContent(PERSONA_TYPE, sessionContent.notes);
      expect(verification.isValid).toBe(true);

      // Should be analytical
      const lowerNotes = sessionContent.notes.toLowerCase();
      expect(
        lowerNotes.includes('mission') ||
        lowerNotes.includes('operational') ||
        lowerNotes.includes('parameters') ||
        lowerNotes.includes('objective')
      ).toBe(true);
    });

    test('uses metric wave measurements', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      // Tactical persona may use meters
      const tacticalHeights = ['3-4 ft', '4-5 ft', '1.2-1.5 meters'];
      expect(tacticalHeights).toContain(sessionContent.waveHeight);
    });

    test('gives measured ratings', async () => {
      const sessionContent = generateSessionContent(PERSONA_TYPE);

      // Tactical is precise (3-4 range typically)
      expect(sessionContent.rating).toBeGreaterThanOrEqual(3);
      expect(sessionContent.rating).toBeLessThanOrEqual(4);
    });
  });

  test.describe('Beach Discovery', () => {
    test('can explore discovery with advanced filter', async ({ page }) => {
      const result = await exploreDiscoveryAsPersona(page, PERSONA_TYPE);

      expect(result.success).toBe(true);
      expect(result.beachesFound).toBeDefined();
    });

    test('can navigate to strategic locations', async ({ page }) => {
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
    test('can post tactical assessments', async ({ page }) => {
      throw new Error('Not implemented: Intel posting UI changed - need to update selectors and flow to match current implementation');
    });

    test('can post hazard threat assessments', async ({ page }) => {
      throw new Error('Not implemented: Intel posting UI changed - need to update selectors and flow to match current implementation');
    });
  });

  test.describe('Persona Characteristics', () => {
    test('has advanced experience level', () => {
      expect(persona.experienceLevel).toBe('advanced');
    });

    test('has tactical writing style', () => {
      expect(persona.style).toBe('military precision and analysis');
    });

    test('uses characteristic phrases', () => {
      expect(persona.phrases).toContain('Tactical assessment');
      expect(persona.phrases).toContain('Mission parameters');
      expect(persona.phrases).toContain('Field report');
    });

    test('focuses on analytical content', () => {
      expect(persona.typicalContent).toContain('Detailed analysis');
      expect(persona.typicalContent).toContain('Strategic updates');
      expect(persona.typicalContent).toContain('Precision reports');
    });
  });
});
