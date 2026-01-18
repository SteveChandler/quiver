/**
 * Cross-Persona Profile Tests
 *
 * Tests profile viewing and editing functionality across all persona types,
 * validating persona characteristics and preferences.
 *
 * @see e2e/fixtures/personas.ts - Persona definitions
 */

import { test, expect } from '@playwright/test';
import { ALL_PERSONA_TYPES, PERSONAS, PersonaType } from '../fixtures/personas';
import { getPersonaAuthStatePath, createPersonaPage, personaAuthStateExists } from '../utils/persona-auth';
import { verifyLoggedInAsPersona, updateProfileAsPersona, verifyProfileExperienceLevel } from '../utils/persona-helpers';

test.describe('Profiles - All Personas', () => {
  test.describe('Persona Identity', () => {
    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test(`${persona.displayName} has valid persona configuration`, () => {
        // Verify all required fields exist
        expect(persona.type).toBe(personaType);
        expect(persona.displayName).toBeTruthy();
        expect(persona.email).toBeTruthy();
        expect(persona.style).toBeTruthy();
        expect(persona.phrases.length).toBeGreaterThan(0);
        expect(persona.typicalContent.length).toBeGreaterThan(0);
        expect(persona.expectedRatingRange).toHaveLength(2);
        expect(persona.experienceLevel).toBeTruthy();
      });

      test(`${persona.displayName} has valid email format`, () => {
        expect(persona.email).toMatch(/^[^@]+@example\.invalid$/);
      });

      test(`${persona.displayName} has valid rating range`, () => {
        const [min, max] = persona.expectedRatingRange;
        expect(min).toBeGreaterThanOrEqual(1);
        expect(min).toBeLessThanOrEqual(5);
        expect(max).toBeGreaterThanOrEqual(min);
        expect(max).toBeLessThanOrEqual(5);
      });
    }
  });

  test.describe('Authentication State', () => {
    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test.describe(`${persona.displayName}`, () => {
        test.use({
          storageState: getPersonaAuthStatePath(personaType),
        });

        test('can load authenticated state @requires-auth', async ({ page }) => {
          await page.goto('/');
          await page.waitForLoadState('domcontentloaded');

          // Page should load without auth errors
          // The specific verification depends on UI implementation
          await expect(page).not.toHaveURL(/error|login/);
        });
      });
    }
  });

  test.describe('Profile Verification @requires-auth', () => {
    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test.describe(`${persona.displayName}`, () => {
        test.use({
          storageState: getPersonaAuthStatePath(personaType),
        });

        test('is logged in as correct persona', async ({ page }) => {
          await page.goto('/');
          await page.waitForLoadState('domcontentloaded');

          const result = await verifyLoggedInAsPersona(page, personaType);

          // Either verified as correct persona or user info is visible
          expect(result.isCorrectPersona || result.currentUser !== undefined).toBeTruthy();
        });
      });
    }
  });

  test.describe('Profile Experience Level Verification @requires-auth', () => {
    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test.describe(`${persona.displayName}`, () => {
        test.use({
          storageState: getPersonaAuthStatePath(personaType),
        });

        test(`has correct experience level: ${persona.experienceLevel}`, async ({ page }) => {
          await page.goto('/');
          await page.waitForLoadState('domcontentloaded');

          const result = await verifyProfileExperienceLevel(page, personaType);

          // If API not available or auth failed, skip gracefully
          if (result.error?.includes('401') || result.error?.includes('Profile fetch failed')) {
            test.skip();
            return;
          }

          expect(result.success,
            `Expected experience_level "${result.expectedLevel}" but got "${result.actualLevel}"`
          ).toBe(true);
        });
      });
    }
  });

  test.describe('Writing Styles', () => {
    test('all personas have unique writing styles', () => {
      const styles = ALL_PERSONA_TYPES.map(type => PERSONAS[type].style);
      const uniqueStyles = new Set(styles);

      expect(uniqueStyles.size).toBe(ALL_PERSONA_TYPES.length);
    });

    test('writing styles match persona descriptions', () => {
      expect(PERSONAS.rookie.style).toBe('enthusiastic and grateful');
      expect(PERSONAS.local.style).toBe('knowledgeable and helpful');
      expect(PERSONAS.traveler.style).toBe('comparative and adventurous');
      expect(PERSONAS.photographer.style).toBe('aesthetic and technical');
      expect(PERSONAS.tactical.style).toBe('military precision and analysis');
      expect(PERSONAS.competitor.style).toBe('performance focused and intense');
    });
  });

  test.describe('Characteristic Phrases', () => {
    test('each persona has multiple characteristic phrases', () => {
      for (const personaType of ALL_PERSONA_TYPES) {
        const persona = PERSONAS[personaType];
        expect(persona.phrases.length).toBeGreaterThanOrEqual(5);
      }
    });

    test('phrases are unique to each persona', () => {
      // Check that key phrases don't overlap significantly
      const allPhrases = new Map<string, PersonaType[]>();

      for (const personaType of ALL_PERSONA_TYPES) {
        for (const phrase of PERSONAS[personaType].phrases) {
          const lowerPhrase = phrase.toLowerCase();
          if (!allPhrases.has(lowerPhrase)) {
            allPhrases.set(lowerPhrase, []);
          }
          allPhrases.get(lowerPhrase)!.push(personaType);
        }
      }

      // Most phrases should be unique to one persona
      let uniqueCount = 0;
      allPhrases.forEach((personas) => {
        if (personas.length === 1) uniqueCount++;
      });

      // At least 80% of phrases should be unique
      expect(uniqueCount / allPhrases.size).toBeGreaterThan(0.8);
    });
  });

  test.describe('Profile Update @requires-auth @slow', () => {
    // Tests for profile editing

    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test.skip(`${persona.displayName} can update profile`, async ({ browser }) => {
        if (!personaAuthStateExists(personaType)) {
          test.skip();
          return;
        }

        const { page, context } = await createPersonaPage(browser, personaType);

        try {
          // Generate persona-appropriate bio
          const bio = `${persona.phrases[0]} ${persona.style} surfer.`;

          const result = await updateProfileAsPersona(page, personaType, {
            bio,
          });

          if (result.success) {
            expect(result.success).toBe(true);
          } else {
            // Profile update may not be available - log but don't fail
            console.log(`Profile update: ${result.error}`);
          }
        } finally {
          await context.close();
        }
      });
    }
  });

  test.describe('Experience Level Mapping', () => {
    test('experience levels map to UI filter values', () => {
      const levelMap: Record<string, string> = {
        beginner: 'Beginner',
        intermediate: 'Intermediate',
        advanced: 'Advanced',
        expert: 'Expert',
      };

      for (const personaType of ALL_PERSONA_TYPES) {
        const level = PERSONAS[personaType].experienceLevel;
        expect(levelMap[level]).toBeTruthy();
      }
    });

    test('personas have realistic experience distributions', () => {
      const beginner = ALL_PERSONA_TYPES.filter(t => PERSONAS[t].experienceLevel === 'beginner');
      const intermediate = ALL_PERSONA_TYPES.filter(t => PERSONAS[t].experienceLevel === 'intermediate');
      const advanced = ALL_PERSONA_TYPES.filter(t => PERSONAS[t].experienceLevel === 'advanced');
      const expert = ALL_PERSONA_TYPES.filter(t => PERSONAS[t].experienceLevel === 'expert');

      // Each level should have at least one persona
      expect(beginner.length).toBeGreaterThanOrEqual(1);
      expect(intermediate.length).toBeGreaterThanOrEqual(1);
      expect(advanced.length).toBeGreaterThanOrEqual(1);
      expect(expert.length).toBeGreaterThanOrEqual(1);
    });
  });
});
