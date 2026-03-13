/**
 * Types and constants for the Report Conditions feature.
 *
 * A conditions report is a lightweight community contribution that captures
 * current wave size and overall vibe at a beach. It creates an intel_posts
 * record (with structured wave_size_range + vibe columns) and a minimal
 * sessions record for ML training.
 */

export type WaveSizeRange = '1-2ft' | '2-3ft' | '3-4ft' | '4-5ft' | '5+ft';

export type Vibe = 'firing' | 'fun' | 'meh' | 'rough';

export interface ConditionsReportInput {
  beachId: string;
  waveSizeRange: WaveSizeRange;
  vibe: Vibe;
  /** Optional free-text note. Max 280 characters. */
  note?: string;
}

export interface ConditionsReportData {
  id: string;
  beach_id: string;
  user_id: string;
  wave_size_range: WaveSizeRange;
  vibe: Vibe;
  /** The auto-generated content string stored on intel_posts, e.g. "3-4ft, Firing 🔥" */
  content: string;
  /** Optional user note */
  note: string | null;
  created_at: string;
  user: {
    full_name: string;
    avatar_url: string | null;
  };
}

// ---------------------------------------------------------------------------
// Display constants
// ---------------------------------------------------------------------------

export interface WaveSizeOption {
  value: WaveSizeRange;
  label: string;
}

export interface VibeOption {
  value: Vibe;
  label: string;
  emoji: string;
}

export const WAVE_SIZE_OPTIONS: WaveSizeOption[] = [
  { value: '1-2ft', label: '1-2ft' },
  { value: '2-3ft', label: '2-3ft' },
  { value: '3-4ft', label: '3-4ft' },
  { value: '4-5ft', label: '4-5ft' },
  { value: '5+ft', label: '5+ft' },
];

export const VIBE_OPTIONS: VibeOption[] = [
  { value: 'firing', label: 'Firing', emoji: '🔥' },
  { value: 'fun',    label: 'Fun',    emoji: '🤙' },
  { value: 'meh',    label: 'Meh',    emoji: '😑' },
  { value: 'rough',  label: 'Rough',  emoji: '💨' },
];

/** Returns the emoji for a given vibe value, or an empty string. */
export function getVibeEmoji(vibe: Vibe | string): string {
  return VIBE_OPTIONS.find((o) => o.value === vibe)?.emoji ?? '';
}

/** Builds the human-readable content string stored on intel_posts. */
export function buildConditionsContent(
  waveSizeRange: WaveSizeRange,
  vibe: Vibe,
  note?: string
): string {
  const vibeOpt = VIBE_OPTIONS.find((o) => o.value === vibe);
  const vibeLabel = vibeOpt ? `${vibeOpt.label} ${vibeOpt.emoji}` : vibe;
  const base = `${waveSizeRange}, ${vibeLabel}`;
  return note?.trim() ? `${base} — ${note.trim()}` : base;
}
