/**
 * HTML utility functions for safe content rendering
 */

/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * This function should be used whenever user-provided or dynamic content
 * is rendered in HTML templates to prevent cross-site scripting attacks.
 *
 * @param str - The string to escape
 * @returns The escaped string safe for HTML insertion
 *
 * @example
 * ```typescript
 * const userInput = '<script>alert("xss")</script>';
 * const safe = escapeHtml(userInput);
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * ```
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
