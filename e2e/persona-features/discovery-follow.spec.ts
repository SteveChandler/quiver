/**
 * Cross-Persona Discovery and Follow Tests
 *
 * Tests discovery exploration and social following functionality
 * across all persona types.
 *
 * @see e2e/fixtures/personas.ts - Persona definitions
 */

import { test, expect } from '@playwright/test';
import { ALL_PERSONA_TYPES, PERSONAS } from '../fixtures/personas';
import { TEST_BEACHES } from '../fixtures/test-data';
import { getPersonaAuthStatePath, createPersonaPage, personaAuthStateExists } from '../utils/persona-auth';
import {
  exploreDiscoveryAsPersona,
  followUserAsPersona,
  navigateToBeach,
} from '../utils/persona-helpers';

test.describe('Discovery & Follow - All Personas', () => {
  test.describe('Discovery Exploration', () => {
    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test(`${persona.displayName} has appropriate experience level for filtering`, () => {
        // Verify experience levels are valid
        const validLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
        expect(validLevels).toContain(persona.experienceLevel);
      });
    }

    test('persona experience levels are distributed appropriately', () => {
      // Verify we have different experience levels across personas
      const levels = ALL_PERSONA_TYPES.map(type => PERSONAS[type].experienceLevel);
      const uniqueLevels = new Set(levels);

      // Should have at least 3 different experience levels
      expect(uniqueLevels.size).toBeGreaterThanOrEqual(3);

      // Verify specific personas have expected levels
      expect(PERSONAS.rookie.experienceLevel).toBe('beginner');
      expect(PERSONAS.local.experienceLevel).toBe('expert');
      expect(PERSONAS.competitor.experienceLevel).toBe('expert');
      expect(PERSONAS.tactical.experienceLevel).toBe('advanced');
    });
  });

  test.describe('Beach Navigation', () => {
    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test.describe(`${persona.displayName}`, () => {
        test.use({
          storageState: getPersonaAuthStatePath(personaType),
        });

        test('can navigate to test beaches', async ({ page }) => {
          const beach = TEST_BEACHES.beacons;

          await navigateToBeach(page, {
            name: beach.name,
            slug: beach.slug,
            city: beach.city,
            state: 'California',
          });

          // Verify URL contains beach slug
          await expect(page).toHaveURL(new RegExp(beach.slug));
        });
      });
    }
  });

  test.describe('Discovery UI @requires-auth', () => {
    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test.describe(`${persona.displayName}`, () => {
        test.use({
          storageState: getPersonaAuthStatePath(personaType),
        });

        test('can access discovery page', async ({ page }) => {
          const result = await exploreDiscoveryAsPersona(page, personaType);

          expect(result.success).toBe(true);
          // Beach count is informational - may be 0 if filters don't match
          expect(result.beachesFound).toBeDefined();
        });
      });
    }
  });

  test.describe('Social Following @requires-auth @slow', () => {
    // Tests for personas following each other
    // These tests create a social graph between personas

    test('rookie can follow local for tips', async ({ browser }) => {
      throw new Error('Not implemented: Persona follow functionality - requires persona authentication states and follow user interaction');
    });

    test('traveler can follow photographer for photo spots', async ({ browser }) => {
      throw new Error('Not implemented: Traveler persona follow - requires persona authentication and follow photographer interaction');
    });

    test('competitor can follow tactical for analysis', async ({ browser }) => {
      throw new Error('Not implemented: Competitor persona follow - requires persona authentication and follow tactical user interaction');
    });
  });

  test.describe('Persona Social Graph', () => {
    test('personas have distinct display names', () => {
      const names = ALL_PERSONA_TYPES.map(type => PERSONAS[type].displayName);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(ALL_PERSONA_TYPES.length);
    });

    test('personas have unique emails', () => {
      const emails = ALL_PERSONA_TYPES.map(type => PERSONAS[type].email);
      const uniqueEmails = new Set(emails);

      expect(uniqueEmails.size).toBe(ALL_PERSONA_TYPES.length);
    });

    test('all persona emails use example.invalid domain', () => {
      for (const personaType of ALL_PERSONA_TYPES) {
        const email = PERSONAS[personaType].email;
        expect(email).toMatch(/@example\.invalid$/);
      }
    });
  });
});
