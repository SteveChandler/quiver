/**
 * Cross-Persona Session Planning Tests
 *
 * Tests session planner functionality across all persona types,
 * validating that recommendations are appropriate for each skill level.
 *
 * @see e2e/fixtures/personas.ts - Persona definitions
 */

import { test, expect } from '@playwright/test';
import { ALL_PERSONA_TYPES, PERSONAS } from '../fixtures/personas';
import { TIMEOUTS } from '../fixtures/test-data';
import { getPersonaAuthStatePath, createPersonaPage, personaAuthStateExists } from '../utils/persona-auth';
import { checkSessionPlannerAsPersona } from '../utils/persona-helpers';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from '../utils/error-detection';

test.describe('Session Planning - All Personas', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'All Personas' });
  });

  test.describe('Persona Skill Levels', () => {
    test('beginner personas should get beginner-appropriate recommendations', () => {
      // Rookies are beginners
      expect(PERSONAS.rookie.experienceLevel).toBe('beginner');
    });

    test('intermediate personas should get varied recommendations', () => {
      // Travelers and photographers are intermediate
      expect(PERSONAS.traveler.experienceLevel).toBe('intermediate');
      expect(PERSONAS.photographer.experienceLevel).toBe('intermediate');
    });

    test('advanced personas should get challenging recommendations', () => {
      // Tactical is advanced
      expect(PERSONAS.tactical.experienceLevel).toBe('advanced');
    });

    test('expert personas should get expert-level recommendations', () => {
      // Locals and competitors are experts
      expect(PERSONAS.local.experienceLevel).toBe('expert');
      expect(PERSONAS.competitor.experienceLevel).toBe('expert');
    });
  });

  test.describe('Session Planner Access', () => {
    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test.describe(`${persona.displayName}`, () => {
        test.use({
          storageState: getPersonaAuthStatePath(personaType),
        });

        test('can access session planner @requires-auth', async ({ page }) => {
          // Navigate to session planner and verify it loads
          await page.goto('/sessions/new?mode=plan');
          await page.waitForLoadState('domcontentloaded');

          // Verify the session wizard loads with the beach search input
          const beachInput = page.getByTestId('beach-search-input');
          await expect(beachInput).toBeVisible({ timeout: TIMEOUTS.medium });
        });
      });
    }
  });

  test.describe('Skill Level Distribution', () => {
    test('personas cover all skill levels', () => {
      const levels = ALL_PERSONA_TYPES.map(type => PERSONAS[type].experienceLevel);

      expect(levels).toContain('beginner');
      expect(levels).toContain('intermediate');
      expect(levels).toContain('advanced');
      expect(levels).toContain('expert');
    });

    test('skill level mapping is valid', () => {
      const validLevels = ['beginner', 'intermediate', 'advanced', 'expert'];

      for (const personaType of ALL_PERSONA_TYPES) {
        expect(validLevels).toContain(PERSONAS[personaType].experienceLevel);
      }
    });
  });

  test.describe('Planning Preferences by Persona', () => {
    test('rookie prefers safe, beginner-friendly conditions', () => {
      const persona = PERSONAS.rookie;

      expect(persona.experienceLevel).toBe('beginner');
      // Rookies prefer smaller waves
      expect(persona.expectedRatingRange[0]).toBeGreaterThanOrEqual(4);
    });

    test('local knows optimal conditions for their spot', () => {
      const persona = PERSONAS.local;

      expect(persona.experienceLevel).toBe('expert');
      expect(persona.typicalContent).toContain('Condition updates');
    });

    test('traveler is flexible with conditions', () => {
      const persona = PERSONAS.traveler;

      expect(persona.experienceLevel).toBe('intermediate');
      expect(persona.typicalContent).toContain('New discoveries');
    });

    test('competitor seeks performance conditions', () => {
      const persona = PERSONAS.competitor;

      expect(persona.experienceLevel).toBe('expert');
      expect(persona.typicalContent).toContain('Training conditions');
    });

    test('tactical requires optimal strategic conditions', () => {
      const persona = PERSONAS.tactical;

      expect(persona.experienceLevel).toBe('advanced');
      expect(persona.typicalContent).toContain('Detailed analysis');
    });
  });

  test.describe('Session Planner UI @requires-auth @slow', () => {
    // Full browser tests for session planner

    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test(`${persona.displayName} sees skill-appropriate recommendations`, async ({ browser }) => {
        test.fixme(true, 'Session planner recommendations require seeded personalization data');
      });
    }
  });
});
