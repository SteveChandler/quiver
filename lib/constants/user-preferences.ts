/**
 * User preference constants for surf profile preferences
 * Used across ProfilePreferences, EditProfileForm, and preference displays
 */

export const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', emoji: '🏄‍♂️', description: 'Just getting started' },
  { value: 'intermediate', label: 'Intermediate', emoji: '🌊', description: 'Catching waves regularly' },
  { value: 'advanced', label: 'Advanced', emoji: '🏆', description: 'Experienced surfer' },
  { value: 'expert', label: 'Expert', emoji: '🔥', description: 'Highly skilled' },
] as const;

export const SURF_STYLES = [
  { value: 'longboard', label: 'Longboard', emoji: '🏄' },
  { value: 'shortboard', label: 'Shortboard', emoji: '🏄‍♀️' },
  { value: 'funboard', label: 'Funboard', emoji: '🏄‍♂️' },
  { value: 'bodyboard', label: 'Bodyboard', emoji: '🏊' },
  { value: 'sup', label: 'SUP', emoji: '🚣' },
  { value: 'foil', label: 'Foil', emoji: '✨' },
] as const;

// Type exports for TypeScript
export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number]['value'];
export type SurfStyle = typeof SURF_STYLES[number]['value'];

// TIME_PREFERENCES + TimePreference removed in plan E2. Oracle owns
// session-time selection via `SessionTimePreference` in
// `hooks/use-oracle-data.ts`; the onboarding step that used these
// constants was dropped as a zero-value-capture moment.
