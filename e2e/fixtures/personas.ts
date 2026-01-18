/**
 * Persona definitions for E2E testing with NPC accounts
 *
 * Maps the 6 NPC personality types to mock user accounts for
 * authenticated persona-based testing scenarios.
 *
 * @see scripts/seed-npc-reviews-and-intel.ts - Source of writing styles
 * @see scripts/seed-prod-mock-users.ts - Source of mock user emails
 */

/**
 * The 6 NPC personality types available for testing
 */
export type PersonaType =
  | 'rookie'
  | 'local'
  | 'traveler'
  | 'photographer'
  | 'tactical'
  | 'competitor';

/**
 * All available persona types for iteration
 */
export const ALL_PERSONA_TYPES: PersonaType[] = [
  'rookie',
  'local',
  'traveler',
  'photographer',
  'tactical',
  'competitor',
];

/**
 * Persona configuration interface
 */
export interface Persona {
  /** Unique persona type identifier */
  type: PersonaType;
  /** Display name for logs and test descriptions */
  displayName: string;
  /** Email address for authentication (from mock users) */
  email: string;
  /** Writing style description */
  style: string;
  /** Characteristic phrases used by this persona */
  phrases: string[];
  /** Types of content this persona typically creates */
  typicalContent: string[];
  /** Expected rating range [min, max] on 1-5 scale */
  expectedRatingRange: [number, number];
  /** Experience level for UI/feature testing context */
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

/**
 * Complete persona definitions mapped by type
 *
 * Writing styles and phrases sourced from:
 * @see scripts/seed-npc-reviews-and-intel.ts:63-118
 *
 * Mock user emails sourced from:
 * @see scripts/seed-prod-mock-users.ts:47-100
 */
export const PERSONAS: Record<PersonaType, Persona> = {
  rookie: {
    type: 'rookie',
    displayName: 'Riley R. (Rookie)',
    email: 'riley.r@example.invalid',
    style: 'enthusiastic and grateful',
    phrases: [
      'OMG!',
      'So stoked!',
      'Amazing!',
      "Can't believe it!",
      'Best day ever!',
      'This is incredible!',
      'Mind blown!',
      'Still buzzing!',
      'What a rush!',
      'Totally rad!',
      'Beyond excited!',
      'This is the dream!',
    ],
    typicalContent: [
      'First time experiences',
      'Learning progress',
      'Gratitude to community',
    ],
    expectedRatingRange: [4, 5],
    experienceLevel: 'beginner',
  },

  local: {
    type: 'local',
    displayName: 'Local Larry',
    email: 'local.larry@example.invalid',
    style: 'knowledgeable and helpful',
    phrases: [
      'Heads up',
      'Pro tip',
      'Been coming here for years',
      'Just a FYI',
      'Fair warning',
      'Quick update',
      'For those wondering',
      'Local knowledge',
      'Real talk',
      'From experience',
      'Worth mentioning',
      'Friendly reminder',
    ],
    typicalContent: ['Condition updates', 'Crowd reports', 'Local knowledge'],
    expectedRatingRange: [3, 5],
    experienceLevel: 'expert',
  },

  traveler: {
    type: 'traveler',
    displayName: 'Tina C. (Traveler)',
    email: 'tina.c@example.invalid',
    style: 'comparative and adventurous',
    phrases: [
      'Reminds me of',
      'Different from',
      'Never seen anything like',
      'Worth the trip',
      'Similar to',
      'Compares well to',
      'Unique compared to',
      'Unlike anywhere else',
      'First time experiencing',
      'Not what I expected',
      'Pleasantly surprised',
    ],
    typicalContent: ['Beach comparisons', 'Travel insights', 'New discoveries'],
    expectedRatingRange: [3, 5],
    experienceLevel: 'intermediate',
  },

  photographer: {
    type: 'photographer',
    displayName: 'P. Martinez (Photographer)',
    email: 'p.martinez@example.invalid',
    style: 'aesthetic and technical',
    phrases: [
      'Perfect lighting',
      'Great composition',
      'Amazing colors',
      'Photo worthy',
      'Beautiful framing',
      'Stunning visuals',
      'Epic backdrop',
      'Golden hour magic',
      'Picture perfect',
      'Incredible scenery',
      'Visual paradise',
    ],
    typicalContent: ['Visual conditions', 'Light quality', 'Action shots'],
    expectedRatingRange: [3, 5],
    experienceLevel: 'intermediate',
  },

  tactical: {
    type: 'tactical',
    displayName: 'Solid Snake (Tactical)',
    email: 'solid.snake@example.invalid',
    style: 'military precision and analysis',
    phrases: [
      'Tactical assessment',
      'Mission parameters',
      'Strategic advantage',
      'Optimal conditions',
      'Field report',
      'Reconnaissance complete',
      'Operational status',
      'Threat assessment',
      'Strategic position',
      'Mission critical',
      'Tactical superiority',
    ],
    typicalContent: [
      'Detailed analysis',
      'Strategic updates',
      'Precision reports',
    ],
    expectedRatingRange: [3, 4],
    experienceLevel: 'advanced',
  },

  competitor: {
    type: 'competitor',
    displayName: 'Kai N. (Competitor)',
    email: 'kai.n@example.invalid',
    style: 'performance focused and intense',
    phrases: [
      'Training session',
      'Performance analysis',
      'Competitive advantage',
      'Next level',
      'Pushing limits',
      'Peak performance',
      'Competition ready',
      'Maximum effort',
      'Elite conditions',
      'Championship form',
      'Performance metrics',
    ],
    typicalContent: [
      'Training conditions',
      'Performance metrics',
      'Competitive intel',
    ],
    expectedRatingRange: [3, 5],
    experienceLevel: 'expert',
  },
};

/**
 * Get a persona by type
 */
export function getPersona(type: PersonaType): Persona {
  return PERSONAS[type];
}

/**
 * Get a random phrase for a persona
 */
export function getRandomPhrase(type: PersonaType): string {
  const persona = PERSONAS[type];
  return persona.phrases[Math.floor(Math.random() * persona.phrases.length)];
}

/**
 * Get a random rating within the persona's expected range
 */
export function getPersonaRating(type: PersonaType): number {
  const persona = PERSONAS[type];
  const [min, max] = persona.expectedRatingRange;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Get default password for persona authentication
 * Uses environment variable or falls back to default
 */
export function getPersonaPassword(): string {
  return process.env.PERSONA_PASSWORD || 'testpassword123';
}

/**
 * Intel post tags available for testing
 */
export const INTEL_TAGS = [
  'conditions',
  'parking',
  'crowd',
  'hazards',
  'access',
] as const;

export type IntelTag = (typeof INTEL_TAGS)[number];

/**
 * Map of persona types to their preferred intel tags
 */
export const PERSONA_PREFERRED_TAGS: Record<PersonaType, IntelTag[]> = {
  rookie: ['conditions', 'access'],
  local: ['conditions', 'crowd', 'hazards'],
  traveler: ['conditions', 'parking', 'access'],
  photographer: ['conditions'],
  tactical: ['hazards', 'conditions', 'access'],
  competitor: ['conditions', 'crowd'],
};
