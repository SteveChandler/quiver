/**
 * Display name utilities for user-generated content.
 * Handles anonymization of test users and text cleaning.
 */

/**
 * Realistic surfer names used to anonymize "Test User" entries in production.
 * Deterministically selected via hashing to maintain consistency across renders.
 */
const SURFER_NAMES = [
  "Kai W.",
  "Sarah J.",
  "Mike T.",
  "Alana B.",
  "Rob S.",
  "Malia K.",
  "Jake C.",
  "Luna M.",
  "Tyler N.",
  "Sofia R.",
] as const;

/**
 * Simple djb2-based hash function for deterministic pseudo-random selection.
 *
 * @param str - String to hash
 * @returns Non-negative integer hash value
 *
 * @example
 * ```ts
 * hashString("post-123") // 1234567
 * hashString("post-123") // 1234567 (deterministic)
 * ```
 */
export function hashString(str: string): number {
  if (!str) return 0;

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    // djb2 hash: hash * 33 + char (using bitwise ops for performance)
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get display name for a user, anonymizing test users with realistic names.
 * Uses deterministic hashing to ensure consistent name assignment per seed.
 *
 * @param name - User's full name or display name
 * @param seed - Deterministic seed (e.g., post ID) for consistent name selection
 * @returns Display name, with "Test User" variants replaced by realistic names
 *
 * @example
 * ```ts
 * getDisplayName("Test User 1", "post-123") // "Kai W."
 * getDisplayName("Test User 1", "post-123") // "Kai W." (same seed = same name)
 * getDisplayName("John Doe", "post-456") // "John Doe" (real users unchanged)
 * ```
 */
export function getDisplayName(name: string, seed: string): string {
  if (!name) return "Anonymous";
  if (!seed) return name;

  // Match "Test User" in any case variation
  if (/test\s*user/i.test(name)) {
    const index = hashString(seed) % SURFER_NAMES.length;
    return SURFER_NAMES[index];
  }

  return name;
}

/**
 * Remove leading emoji from title if it matches the provided tag emoji.
 * Useful for cleaning duplicated emojis in user-generated titles.
 *
 * @param title - Post title that may contain leading emoji
 * @param tagEmoji - The tag emoji to remove if present at start
 * @returns Cleaned title with duplicate emoji removed and whitespace trimmed
 *
 * @example
 * ```ts
 * cleanTitle("🌊 Big waves today", "🌊") // "Big waves today"
 * cleanTitle("Big waves today", "🌊") // "Big waves today" (no change)
 * cleanTitle("🌊🌊 Double emoji", "🌊") // "🌊 Double emoji" (removes one)
 * ```
 */
export function cleanTitle(title: string, tagEmoji: string): string {
  if (!title) return "";
  if (!tagEmoji) return title.trimStart();

  const trimmed = title.trimStart();
  if (trimmed.startsWith(tagEmoji)) {
    return trimmed.slice(tagEmoji.length).trimStart();
  }

  return trimmed;
}
