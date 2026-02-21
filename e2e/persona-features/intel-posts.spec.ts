/**
 * Cross-Persona Intel Posts Tests
 *
 * Tests intel posting functionality across all 6 persona types,
 * validating that each persona's content matches their expected style.
 *
 * @see e2e/fixtures/personas.ts - Persona definitions
 */

import { test, expect, Browser } from '@playwright/test';
import { ALL_PERSONA_TYPES, PERSONAS, PersonaType } from '../fixtures/personas';
import { TEST_BEACHES } from '../fixtures/test-data';
import { createPersonaPage, personaAuthStateExists } from '../utils/persona-auth';
import { createIntelPostAsPersona, navigateToBeach } from '../utils/persona-helpers';
import {
  generateIntelContent,
  verifyPersonaContent,
} from '../utils/persona-content-generators';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from '../utils/error-detection';

test.describe('Intel Posts - All Personas', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'All Personas' });
  });

  test.describe('Content Generation Validation', () => {
    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test(`${persona.displayName} generates style-appropriate intel content`, async () => {
        const beach = { name: 'Test Beach', city: 'San Diego', state: 'California' };

        // Test conditions tag
        const conditionsContent = generateIntelContent(personaType, beach, 'conditions');
        expect(conditionsContent.title).toBeTruthy();
        expect(conditionsContent.description).toBeTruthy();
        expect(conditionsContent.tag).toBe('conditions');

        const verification = verifyPersonaContent(personaType, conditionsContent.description);
        expect(verification.isValid).toBe(true);
        expect(verification.matchedPhrases.length).toBeGreaterThan(0);
      });

      test(`${persona.displayName} generates content for all intel tags`, async () => {
        const beach = { name: 'Test Beach', city: 'San Diego', state: 'California' };
        const tags = ['conditions', 'parking', 'crowd', 'hazards', 'access'] as const;

        for (const tag of tags) {
          const content = generateIntelContent(personaType, beach, tag);

          expect(content.title).toBeTruthy();
          expect(content.description).toBeTruthy();
          expect(content.tag).toBe(tag);

          // Title should include beach name
          expect(content.title.toLowerCase()).toContain(beach.name.toLowerCase());
        }
      });
    }
  });

  test.describe('Content Style Verification', () => {
    test('rookie content is enthusiastic', async () => {
      const beach = { name: 'Beginner Beach', city: 'San Diego', state: 'California' };
      const content = generateIntelContent('rookie', beach, 'conditions');

      const verification = verifyPersonaContent('rookie', content.description);
      expect(verification.matchedPhrases.some(p =>
        p.toLowerCase().includes('amazing') ||
        p.toLowerCase().includes('incredible') ||
        p.toLowerCase().includes('stoked') ||
        p.includes('[keyword:')
      )).toBe(true);
    });

    test('local content is knowledgeable', async () => {
      const beach = { name: 'Local Spot', city: 'Santa Cruz', state: 'California' };
      const content = generateIntelContent('local', beach, 'conditions');

      const verification = verifyPersonaContent('local', content.description);
      expect(verification.matchedPhrases.some(p =>
        p.toLowerCase().includes('conditions') ||
        p.toLowerCase().includes('update') ||
        p.includes('[keyword:')
      )).toBe(true);
    });

    test('tactical content uses military terminology', async () => {
      const beach = { name: 'Strategic Point', city: 'Half Moon Bay', state: 'California' };
      const content = generateIntelContent('tactical', beach, 'conditions');

      const lowerDesc = content.description.toLowerCase();
      // Accept any military/tactical terminology from the templates
      expect(
        lowerDesc.includes('tactical') ||
        lowerDesc.includes('mission') ||
        lowerDesc.includes('operational') ||
        lowerDesc.includes('assessment') ||
        lowerDesc.includes('field report') ||
        lowerDesc.includes('reconnaissance') ||
        lowerDesc.includes('strategic')
      ).toBe(true);
    });

    test('competitor content is performance-focused', async () => {
      const beach = { name: 'Competition Venue', city: 'Huntington Beach', state: 'California' };
      const content = generateIntelContent('competitor', beach, 'conditions');

      const lowerDesc = content.description.toLowerCase();
      expect(
        lowerDesc.includes('training') ||
        lowerDesc.includes('performance') ||
        lowerDesc.includes('competition') ||
        lowerDesc.includes('elite')
      ).toBe(true);
    });
  });

  test.describe('Intel Posting UI @requires-auth @slow', () => {
    // These tests require actual browser interaction with persona contexts
    // Skipped because intel posting requires geolocation permission not available in CI

    for (const personaType of ALL_PERSONA_TYPES) {
      const persona = PERSONAS[personaType];

      test(`${persona.displayName} can post intel via UI`, async ({ browser }) => {
        test.fixme(true, 'Intel posting requires geolocation permission not available in CI');
      });
    }
  });

  test.describe('Tag Distribution by Persona', () => {
    test('personas have appropriate preferred tags', () => {
      // Rookies prefer simpler tags
      expect(PERSONAS.rookie.typicalContent).toContain('First time experiences');

      // Locals cover all important community info
      expect(PERSONAS.local.typicalContent).toContain('Condition updates');
      expect(PERSONAS.local.typicalContent).toContain('Crowd reports');

      // Tactical focuses on analysis
      expect(PERSONAS.tactical.typicalContent).toContain('Detailed analysis');

      // Competitor focuses on performance
      expect(PERSONAS.competitor.typicalContent).toContain('Training conditions');
    });
  });
});
