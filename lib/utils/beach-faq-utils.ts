/**
 * Beach FAQ Generation Utilities
 *
 * Functions for generating FAQ structured data for beach pages.
 * @module lib/utils/beach-faq-utils
 */

import type { Beach } from '@/types/database';

export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * Generate standard FAQ items for a beach page.
 *
 * These FAQs target common search queries about surf spots and help
 * with SEO rich snippets in search results.
 *
 * @param beach - Beach entity with name and location data
 * @returns Array of FAQ items for structured data
 */
export function generateBeachFAQ(beach: Beach): FAQItem[] {
  const name = beach.name;
  const location = beach.city && beach.state ? `${beach.city}, ${beach.state}` : beach.city || '';

  return [
    {
      question: `What is the wave size at ${name}?`,
      answer: `Wave size at ${name} varies by season and swell direction. Check the daily surf report above for today's conditions including wave height, period, and swell direction.`,
    },
    {
      question: `When is the best time to surf ${name}?`,
      answer: `The best time to surf ${name} depends on wind, tide, and swell conditions. Our daily surf call analyzes all factors to recommend the optimal window each day.`,
    },
    {
      question: `Is ${name} good for beginners?`,
      answer: `${name}${location ? ` in ${location}` : ''} conditions vary daily. Check the surf report for current wave size and wind conditions to determine if today is suitable for your skill level.`,
    },
    {
      question: `What is the water temperature at ${name}?`,
      answer: `Water temperature at ${name} varies seasonally. Check local conditions and forecast data for current water temperature to plan your wetsuit choice.`,
    },
    {
      question: `What tide is best for ${name}?`,
      answer: `Optimal tide conditions at ${name} depend on the specific break. Our surf report factors in tide state when calculating the best window for your session.`,
    },
  ];
}
