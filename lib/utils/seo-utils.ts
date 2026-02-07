/**
 * SEO Utilities
 *
 * Shared utilities for SEO metadata formatting and optimization.
 */

/**
 * Truncate text to specified character limit for meta descriptions.
 *
 * Tries to break at word boundary to avoid cutting words in half.
 * Adds "..." if truncation occurs.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 160 characters for meta descriptions)
 * @returns Truncated text with "..." suffix if needed
 *
 * @example
 * truncateMetaDescription("Short text") // "Short text"
 * truncateMetaDescription("Very long text that exceeds 160 characters...") // "Very long text that exceeds 160 characters..."
 */
export function truncateMetaDescription(text: string, maxLength: number = 160): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find last space before maxLength - 3 (to allow for "...")
  const truncated = text.slice(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');

  // Only use word boundary if it's not too far back (>100 chars to avoid overly short truncation)
  if (lastSpace > 100) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}
