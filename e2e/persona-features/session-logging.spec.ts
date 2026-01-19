/**
 * Cross-Persona Session Logging Tests
 *
 * Tests session logging functionality across all 6 persona types,
 * validating ratings, notes, and session details match persona expectations.
 *
 * @see e2e/fixtures/personas.ts - Persona definitions
 */

import { test, expect } from '@playwright/test';
import { ALL_PERSONA_TYPES, PERSONAS, PersonaType, getPersonaRating } from '../fixtures/personas';
import { TEST_BEACHES } from '../fixtures/test-data';
import { createPersonaPage, personaAuthStateExists } from '../utils/persona-auth';
import { logSessionAsPersona } from '../utils/persona-helpers';
import {
  generateSessionContent,
  generateSessionNotes,
  verifyPersonaContent,
} from '../utils/persona-content-generators';

test.describe('Session Logging - All Personas', () => {
  test.describe('Session Content Generation', () => {
    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test(`${persona.displayName} generates appropriate session content`, async () => {
        const content = generateSessionContent(personaType);

        expect(content.notes).toBeTruthy();
        expect(content.rating).toBeGreaterThanOrEqual(1);
        expect(content.rating).toBeLessThanOrEqual(5);
        expect(content.waveHeight).toBeTruthy();
        expect(content.crowdLevel).toBeGreaterThanOrEqual(1);
        expect(content.crowdLevel).toBeLessThanOrEqual(5);
      });

      test(`${persona.displayName} generates style-appropriate notes`, async () => {
        const notes = generateSessionNotes(personaType);

        expect(notes).toBeTruthy();
        expect(notes.length).toBeGreaterThan(20);

        const verification = verifyPersonaContent(personaType, notes);
        expect(verification.isValid).toBe(true);
      });
    }
  });

  test.describe('Rating Patterns', () => {
    test('rookies give high ratings (4-5)', async () => {
      const ratings: number[] = [];

      // Generate multiple ratings to verify pattern
      for (let i = 0; i < 10; i++) {
        ratings.push(getPersonaRating('rookie'));
      }

      // All ratings should be 4 or 5
      ratings.forEach(rating => {
        expect(rating).toBeGreaterThanOrEqual(4);
        expect(rating).toBeLessThanOrEqual(5);
      });
    });

    test('locals give balanced ratings (3-5)', async () => {
      const ratings: number[] = [];

      for (let i = 0; i < 10; i++) {
        ratings.push(getPersonaRating('local'));
      }

      ratings.forEach(rating => {
        expect(rating).toBeGreaterThanOrEqual(3);
        expect(rating).toBeLessThanOrEqual(5);
      });
    });

    test('tactical gives measured ratings (3-4)', async () => {
      const ratings: number[] = [];

      for (let i = 0; i < 10; i++) {
        ratings.push(getPersonaRating('tactical'));
      }

      ratings.forEach(rating => {
        expect(rating).toBeGreaterThanOrEqual(3);
        expect(rating).toBeLessThanOrEqual(4);
      });
    });

    test('competitors give performance-based ratings (3-5)', async () => {
      const ratings: number[] = [];

      for (let i = 0; i < 10; i++) {
        ratings.push(getPersonaRating('competitor'));
      }

      ratings.forEach(rating => {
        expect(rating).toBeGreaterThanOrEqual(3);
        expect(rating).toBeLessThanOrEqual(5);
      });
    });
  });

  test.describe('Wave Height Descriptions', () => {
    test('rookies report smaller waves', async () => {
      const content = generateSessionContent('rookie');
      const beginnerHeights = ['1-2 ft', '2-3 ft', 'knee to waist'];
      expect(beginnerHeights).toContain(content.waveHeight);
    });

    test('locals report accurate standard waves', async () => {
      const content = generateSessionContent('local');
      const localHeights = ['3-4 ft', '4-5 ft', 'waist to chest', 'chest to head'];
      expect(localHeights).toContain(content.waveHeight);
    });

    test('competitors report larger waves', async () => {
      const content = generateSessionContent('competitor');
      const competitorHeights = ['4-6 ft', 'overhead', 'head high+'];
      expect(competitorHeights).toContain(content.waveHeight);
    });

    test('tactical may use metric measurements', async () => {
      const content = generateSessionContent('tactical');
      const tacticalHeights = ['3-4 ft', '4-5 ft', '1.2-1.5 meters'];
      expect(tacticalHeights).toContain(content.waveHeight);
    });
  });

  test.describe('Session Notes Style', () => {
    test('rookie notes are enthusiastic and grateful', async () => {
      const notes = generateSessionNotes('rookie');
      const lowerNotes = notes.toLowerCase();

      expect(
        lowerNotes.includes('amazing') ||
        lowerNotes.includes('incredible') ||
        lowerNotes.includes('best') ||
        lowerNotes.includes('stoked') ||
        lowerNotes.includes('buzzing')
      ).toBe(true);
    });

    test('local notes are factual and helpful', async () => {
      const notes = generateSessionNotes('local');
      const lowerNotes = notes.toLowerCase();

      expect(
        lowerNotes.includes('conditions') ||
        lowerNotes.includes('waves') ||
        lowerNotes.includes('solid') ||
        lowerNotes.includes('classic') ||
        lowerNotes.includes('session') ||
        lowerNotes.includes('swell') ||
        lowerNotes.includes('home break') ||
        lowerNotes.includes('dawn patrol') ||
        lowerNotes.includes('quality')
      ).toBe(true);
    });

    test('tactical notes use mission terminology', async () => {
      const notes = generateSessionNotes('tactical');
      const lowerNotes = notes.toLowerCase();

      expect(
        lowerNotes.includes('mission') ||
        lowerNotes.includes('operational') ||
        lowerNotes.includes('parameters') ||
        lowerNotes.includes('objective') ||
        lowerNotes.includes('training')
      ).toBe(true);
    });

    test('competitor notes focus on performance', async () => {
      const notes = generateSessionNotes('competitor');
      const lowerNotes = notes.toLowerCase();

      expect(
        lowerNotes.includes('training') ||
        lowerNotes.includes('performance') ||
        lowerNotes.includes('session') ||
        lowerNotes.includes('working') ||
        lowerNotes.includes('competition')
      ).toBe(true);
    });
  });

  test.describe('Session Logging UI @requires-auth @slow', () => {
    // These tests require actual browser interaction
    // Skipped by default until UI supports session logging

    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test.skip(`${persona.displayName} can log session via UI`, async ({ browser }) => {
        if (!personaAuthStateExists(personaType)) {
          test.skip();
          return;
        }

        const { page, context } = await createPersonaPage(browser, personaType);

        try {
          const beach = TEST_BEACHES.beacons;

          const result = await logSessionAsPersona(page, personaType, {
            beach: {
              name: beach.name,
              slug: beach.slug,
              city: beach.city,
              state: 'California',
            },
          });

          if (result.success) {
            // Verify rating matches persona range
            const [minRating, maxRating] = persona.expectedRatingRange;
            expect(result.content.rating).toBeGreaterThanOrEqual(minRating);
            expect(result.content.rating).toBeLessThanOrEqual(maxRating);

            // Verify notes match persona style
            const verification = verifyPersonaContent(personaType, result.content.notes);
            expect(verification.isValid).toBe(true);
          }
        } finally {
          await context.close();
        }
      });
    }
  });
});
