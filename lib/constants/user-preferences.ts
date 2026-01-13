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

export const WAVE_SIZES = [
  { value: 'small', label: 'Small', emoji: '🌊', description: '1-3 feet' },
  { value: 'medium', label: 'Medium', emoji: '🌊🌊', description: '3-6 feet' },
  { value: 'large', label: 'Large', emoji: '🌊🌊🌊', description: '6+ feet' },
  { value: 'any', label: 'Any Size', emoji: '🤙', description: "I'll surf anything" },
] as const;

export const BREAK_TYPES = [
  { value: 'beach', label: 'Beach Break', emoji: '🏖️', description: 'Sandy bottom' },
  { value: 'point', label: 'Point Break', emoji: '🪨', description: 'Rocky point' },
  { value: 'reef', label: 'Reef Break', emoji: '🪸', description: 'Coral or rock reef' },
  { value: 'any', label: 'Any Type', emoji: '✨', description: "I'll surf anywhere" },
] as const;

export const CROWD_PREFERENCES = [
  { value: 'social', label: 'Love the crew', emoji: '👥', description: 'Enjoy surfing with others' },
  { value: 'moderate', label: 'A few people is fine', emoji: '🧘', description: 'Small crowds are okay' },
  { value: 'solitude', label: 'Prefer solitude', emoji: '🏝️', description: 'Like uncrowded spots' },
] as const;

// Type exports for TypeScript
export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number]['value'];
export type SurfStyle = typeof SURF_STYLES[number]['value'];
export type WaveSize = typeof WAVE_SIZES[number]['value'];
export type BreakType = typeof BREAK_TYPES[number]['value'];
export type CrowdPreference = typeof CROWD_PREFERENCES[number]['value'];

// Board type to wave height matching ranges (in feet)
// Used for personalized dashboard recommendations
export const BOARD_WAVE_MATCHING = {
  shortboard: { min: 2, max: 8, label: 'Shortboard' },
  longboard: { min: 0.5, max: 4, label: 'Longboard' },
  fish: { min: 1, max: 5, label: 'Fish' },
  'mid-length': { min: 1.5, max: 6, label: 'Mid-Length' },
  funboard: { min: 1.5, max: 6, label: 'Funboard' },
  'step-up': { min: 4, max: 12, label: 'Step-Up' },
  softboard: { min: 0.5, max: 4, label: 'Softboard' },
  gun: { min: 6, max: 20, label: 'Gun' },
  sup: { min: 0.5, max: 4, label: 'SUP' },
} as const;

export type BoardTypeKey = keyof typeof BOARD_WAVE_MATCHING;
